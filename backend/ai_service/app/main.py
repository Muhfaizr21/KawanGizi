"""AI service MBG: deteksi objek makanan + pengenal nama menu dan kesegaran.

Dipanggil oleh gateway Go (POST /api/scans) lewat POST /predict-tray
(dengan fallback POST /predict untuk foto utuh). Jalankan dari folder
backend/ai_service:
    uvicorn app.main:app --host 127.0.0.1 --port 8083

Arsitektur dua-tahap (two-stage):
  1. objek_deteksi.pt (detection, 11 kategori umum: buah, lauk, sayur, ...)
     melokalisasi tiap objek makanan pada foto sehingga recall lebih tinggi.
  2. makanan_indo.pt (detection, 29 kelas makanan Indonesia) menamai tiap
     crop hasil tahap 1 dengan nama makanan dalam bahasa Indonesia.

Kesegaran hidangan diprediksi model klasifikasi terpisah
(cooked_food_freshness_best.pt). Bila detektor tidak menemukan makanan,
dipakai pembagian grid nampan baku sebagai fallback; tiap sekat tetap
dinamai memakai makanan_indo.pt.
"""

from __future__ import annotations

import os
import time
from contextlib import asynccontextmanager

import cv2
import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from ultralytics import YOLO

from app import labels, tray

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.normpath(os.path.join(BASE_DIR, '..', '..', 'model_ai'))
# Model penamaan: detektor 29 kelas makanan Indonesia (nama sudah bahasa Indonesia).
MENU_MODEL_PATH = os.environ.get(
    'AI_MENU_MODEL_PATH',
    os.path.join(MODEL_DIR, 'makanan_indo.pt'),
)
# Model lokalisasi: detektor kategori umum makanan.
DETECTOR_MODEL_PATH = os.environ.get(
    'AI_DETECTOR_MODEL_PATH',
    os.path.join(MODEL_DIR, 'objek_deteksi.pt'),
)
FRESHNESS_MODEL_PATH = os.environ.get(
    'AI_FRESHNESS_MODEL_PATH',
    os.environ.get('AI_MODEL_PATH', os.path.join(MODEL_DIR, 'cooked_food_freshness_best.pt')),
)
IMG_SIZE = int(os.environ.get('AI_IMGSZ', '224'))
DET_IMGSZ = int(os.environ.get('AI_DET_IMGSZ', '640'))
DET_CONF = float(os.environ.get('AI_DET_CONF', '0.25'))
DET_IOU = float(os.environ.get('AI_DET_IOU', '0.45'))
# Kategori deteksi yang bukan makanan sehingga tidak dinamai menu.
NON_FOOD_CATEGORIES = {
    label.strip().lower()
    for label in os.environ.get('AI_NON_FOOD_CATEGORIES', 'uang').split(',')
    if label.strip()
}
# Folder split dataset (train/valid/test) kadang ikut tersimpan sebagai kelas.
INVALID_MENU_LABELS = {
    label.strip().lower()
    for label in os.environ.get('AI_INVALID_MENU_LABELS', 'train,valid,val,test').split(',')
    if label.strip()
}
MAX_COMPARTMENTS = int(os.environ.get('AI_MAX_COMPARTMENTS', '12'))

_menu_model: YOLO | None = None
_detector_model: YOLO | None = None
_freshness_model: YOLO | None = None
_menu_names: dict[int, str] = {}
_detector_names: dict[int, str] = {}
_freshness_names: dict[int, str] = {}
_valid_menu_ids: list[int] = []


def _load_model() -> None:
    global _menu_model, _detector_model, _freshness_model
    global _menu_names, _detector_names, _freshness_names, _valid_menu_ids
    for path in (MENU_MODEL_PATH, DETECTOR_MODEL_PATH, FRESHNESS_MODEL_PATH):
        if not os.path.exists(path):
            raise FileNotFoundError(f'Model tidak ditemukan: {path}')

    _menu_model = YOLO(MENU_MODEL_PATH)
    _detector_model = YOLO(DETECTOR_MODEL_PATH)
    _freshness_model = YOLO(FRESHNESS_MODEL_PATH)
    if _menu_model.task != 'detect':
        raise RuntimeError('Model menu makanan_indo harus berupa checkpoint detection YOLO.')
    if _detector_model.task != 'detect':
        raise RuntimeError('Model deteksi objek harus berupa checkpoint detection YOLO.')
    if _freshness_model.task != 'classify':
        raise RuntimeError('Model kesegaran harus berupa checkpoint klasifikasi YOLO.')
    _menu_names = {int(k): str(v) for k, v in _menu_model.names.items()}
    _detector_names = {int(k): str(v) for k, v in _detector_model.names.items()}
    _freshness_names = {int(k): str(v) for k, v in _freshness_model.names.items()}
    if not _menu_names or not _detector_names or not _freshness_names:
        raise RuntimeError('Checkpoint tidak memiliki metadata kelas.')

    _valid_menu_ids = [
        class_id
        for class_id, class_name in sorted(_menu_names.items())
        if class_name.strip().lower() not in INVALID_MENU_LABELS
    ]
    if not _valid_menu_ids:
        raise RuntimeError('Checkpoint menu tidak memiliki kelas hidangan yang valid.')

    print(f'Model menu dimuat: {MENU_MODEL_PATH} ({len(_menu_names)} kelas: {_menu_names})')
    print(f'Model deteksi dimuat: {DETECTOR_MODEL_PATH} ({len(_detector_names)} kelas: {_detector_names})')
    print(f'Model kesegaran dimuat: {FRESHNESS_MODEL_PATH} ({len(_freshness_names)} kelas: {_freshness_names})')
    print(f'Kelas menu valid dipakai untuk prediksi: {len(_valid_menu_ids)}')


@asynccontextmanager
async def lifespan(app: FastAPI):
    _load_model()
    yield


app = FastAPI(title='MBG AI Service', version='1.0.0', lifespan=lifespan)


@app.get('/health')
def health() -> dict:
    loaded = _menu_model is not None and _detector_model is not None and _freshness_model is not None
    return {
        'status': 'ok' if loaded else 'unavailable',
        'model_loaded': loaded,
        'menu_model': {
            'loaded': _menu_model is not None,
            'path': MENU_MODEL_PATH,
            'task': _menu_model.task if _menu_model is not None else None,
            'classes': list(_menu_names.values()),
        },
        'detector_model': {
            'loaded': _detector_model is not None,
            'path': DETECTOR_MODEL_PATH,
            'task': _detector_model.task if _detector_model is not None else None,
            'classes': list(_detector_names.values()),
            'non_food_categories': sorted(NON_FOOD_CATEGORIES),
        },
        'freshness_model': {'loaded': _freshness_model is not None, 'classes': list(_freshness_names.values())},
        'tray': {
            'rows': tray.DEFAULT_ROWS,
            'cols': tray.DEFAULT_COLS,
            'max_compartments': MAX_COMPARTMENTS,
        },
    }


def _decode(raw: bytes) -> np.ndarray:
    if not raw:
        raise HTTPException(status_code=400, detail='file gambar kosong')
    img = cv2.imdecode(np.frombuffer(raw, dtype=np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(status_code=400, detail='gambar tidak valid')
    return img


def _iter_boxes(result) -> list:
    boxes = getattr(result, 'boxes', None)
    return list(boxes) if boxes is not None else []


def _rank_menu(boxes) -> list[tuple[int, float]]:
    """Urutkan kelas makanan Indonesia valid dari confidence deteksi terbesar."""
    ranked: list[tuple[int, float]] = []
    if boxes is None:
        return ranked
    for index in range(len(boxes)):
        class_id = int(boxes.cls[index])
        if class_id not in _valid_menu_ids:
            continue
        ranked.append((class_id, float(boxes.conf[index])))
    ranked.sort(key=lambda item: item[1], reverse=True)
    return ranked


def _name_food(image) -> list[tuple[int, float]]:
    """Nama makanan Indonesia untuk satu gambar/crop memakai makanan_indo.pt."""
    result = _menu_model.predict(
        image, imgsz=DET_IMGSZ, conf=DET_CONF, iou=DET_IOU, device='cpu', verbose=False
    )[0]
    return _rank_menu(result.boxes)


def _best_food_crop(img: np.ndarray) -> np.ndarray | None:
    """Crop objek makanan dengan confidence deteksi tertinggi dari objek_deteksi.pt."""
    height, width = img.shape[:2]
    det = _detector_model.predict(
        img, imgsz=DET_IMGSZ, conf=DET_CONF, iou=DET_IOU, device='cpu', verbose=False
    )[0]
    best_conf = -1.0
    best_crop: np.ndarray | None = None
    for box in _iter_boxes(det):
        category = _detector_names.get(int(box.cls[0]), '')
        if category.strip().lower() in NON_FOOD_CATEGORIES:
            continue
        confidence = float(box.conf[0])
        if confidence <= best_conf:
            continue
        x1, y1, x2, y2 = _clamp_box(*(int(v) for v in box.xyxy[0].tolist()), height, width)
        crop = img[y1:y2, x1:x2]
        if crop.size == 0:
            continue
        best_conf = confidence
        best_crop = crop
    return best_crop


def _predict_menu(img: np.ndarray) -> tuple[int, str, float, dict[str, float]]:
    """Menu utama foto: lokalisasi objek lalu penamaan makanan Indonesia."""
    crop = _best_food_crop(img)
    ranked = _name_food(crop) if crop is not None else []
    if not ranked:
        ranked = _name_food(img)
    if not ranked:
        return -1, '', 0.0, {}
    class_id, confidence = ranked[0]
    class_name = _menu_names.get(class_id, '')
    probabilities = {_menu_names[idx]: value for idx, value in ranked if idx in _menu_names}
    return class_id, class_name, confidence, probabilities


def _predict_freshness(img: np.ndarray) -> tuple[int, str, float, dict[str, float]]:
    result = _freshness_model.predict(img, imgsz=IMG_SIZE, device='cpu', verbose=False)[0]
    probs = result.probs
    if probs is None:
        raise HTTPException(status_code=500, detail='model kesegaran tidak menghasilkan probabilitas')
    values = [float(p) for p in probs.data.tolist()]
    freshness_id = int(probs.top1)
    return (
        freshness_id,
        _freshness_names.get(freshness_id, str(freshness_id)),
        values[freshness_id],
        {_freshness_names.get(idx, str(idx)): prob for idx, prob in enumerate(values)},
    )


def _whole_payload(img: np.ndarray, started: float) -> dict:
    menu_id, menu_class, menu_confidence, menu_probs = _predict_menu(img)
    freshness_id, freshness_class, freshness_confidence, freshness_probs = _predict_freshness(img)
    return {
        'menu_class_id': menu_id,
        'menu_class_name': menu_class,
        'menu_display_name': labels.menu_label(menu_class),
        'menu_confidence': menu_confidence,
        'freshness_class_id': freshness_id,
        'freshness_class_name': freshness_class,
        'freshness_display_name': labels.freshness_label(freshness_class),
        'freshness_confidence': freshness_confidence,
        'menu_class_probabilities': menu_probs,
        'freshness_class_probabilities': freshness_probs,
        'latency_ms': round((time.perf_counter() - started) * 1000, 2),
    }


def _parse_grid(grid: str | None) -> tuple[int, int]:
    if not grid:
        return tray.DEFAULT_ROWS, tray.DEFAULT_COLS
    parts = [part for part in grid.replace(',', 'x').lower().split('x') if part.strip()]
    try:
        if len(parts) == 1:
            value = max(1, min(int(parts[0]), MAX_COMPARTMENTS))
            return value, 1
        rows = max(1, min(int(parts[0]), MAX_COMPARTMENTS))
        cols = max(1, min(int(parts[1]), MAX_COMPARTMENTS // rows))
        return rows, cols
    except ValueError:
        return tray.DEFAULT_ROWS, tray.DEFAULT_COLS


@app.post('/predict')
async def predict(image: UploadFile = File(...)) -> dict:
    if _menu_model is None or _detector_model is None or _freshness_model is None:
        raise HTTPException(status_code=503, detail='model belum dimuat')
    return _whole_payload(_decode(await image.read()), time.perf_counter())


def _normalized_box(
    x1: int, y1: int, x2: int, y2: int, height: int, width: int
) -> tuple[list[float], list[list[float]]]:
    """Kotak deteksi dalam koordinat normalisasi (0-1) foto asli."""
    nx1 = max(0.0, min(1.0, x1 / width))
    nx2 = max(0.0, min(1.0, x2 / width))
    ny1 = max(0.0, min(1.0, y1 / height))
    ny2 = max(0.0, min(1.0, y2 / height))
    bbox = [nx1, ny1, nx2, ny2]
    quad = [[nx1, ny1], [nx2, ny1], [nx2, ny2], [nx1, ny2]]
    return bbox, quad


def _detect_food_compartments(img: np.ndarray) -> list[dict] | None:
    """Pendekatan dua-tahap: objek_deteksi.pt melokalisasi tiap objek makanan,
    lalu tiap crop dinamai makanan_indo.pt. Kategori non-makanan (mis. uang)
    dilewati.

    Mengembalikan None bila tidak ada objek makanan terdeteksi sehingga caller
    dapat jatuh ke pembagian grid nampan.
    """
    height, width = img.shape[:2]
    det = _detector_model.predict(
        img, imgsz=DET_IMGSZ, conf=DET_CONF, iou=DET_IOU, device='cpu', verbose=False
    )[0]

    entries: list[dict] = []
    for box in _iter_boxes(det):
        category = _detector_names.get(int(box.cls[0]), '')
        if category.strip().lower() in NON_FOOD_CATEGORIES:
            continue
        x1, y1, x2, y2 = _clamp_box(*(int(v) for v in box.xyxy[0].tolist()), height, width)
        crop = img[y1:y2, x1:x2]
        if crop.size == 0 or (x2 - x1) * (y2 - y1) <= 0:
            continue
        entries.append(
            {
                'category': category,
                'detection_confidence': float(box.conf[0]),
                'box': (x1, y1, x2, y2),
                'crop': crop,
            }
        )

    if not entries:
        return None

    if len(entries) > MAX_COMPARTMENTS:
        entries = sorted(entries, key=lambda entry: entry['detection_confidence'], reverse=True)[
            :MAX_COMPARTMENTS
        ]
    # Urutkan sekat kiri->kanan, atas->bawah agar penomoran stabil.
    entries.sort(key=lambda entry: (entry['box'][1], entry['box'][0]))

    crops = [entry['crop'] for entry in entries]
    results = _menu_model.predict(
        crops, imgsz=DET_IMGSZ, conf=DET_CONF, iou=DET_IOU, device='cpu', verbose=False
    )

    compartments: list[dict] = []
    for index, (entry, result) in enumerate(zip(entries, results)):
        ranked = _rank_menu(result.boxes)
        top_id, top_conf = ranked[0] if ranked else (-1, 0.0)
        class_name = _menu_names.get(top_id, '')
        x1, y1, x2, y2 = entry['box']
        bbox_norm, quad = _normalized_box(x1, y1, x2, y2, height, width)
        ratio, texture = tray.occupancy(entry['crop'])
        compartments.append(
            {
                'index': index,
                'row': 0,
                'col': index,
                'cell': f'O{index + 1}',
                'bbox_norm': bbox_norm,
                'bbox_quad_norm': quad,
                'empty': False,
                'food_ratio': round(ratio, 4),
                'texture': round(texture, 2),
                'detected_category': entry['category'],
                'detection_confidence': round(entry['detection_confidence'], 4),
                'menu_class_id': top_id,
                'menu_class_name': class_name,
                'menu_display_name': labels.menu_label(class_name),
                'menu_confidence': round(top_conf, 4),
                'mixed': False,
                'alternatives': {_menu_names[idx]: value for idx, value in ranked[:3]},
            }
        )
    return compartments


def _grid_compartments(img: np.ndarray, cells: list[tray.Cell]) -> list[dict]:
    """Pembagian baku grid nampan; fallback bila detektor tidak menemukan
    objek makanan. Tiap sekat tetap dinamai memakai makanan_indo.pt."""
    rect = tray.find_tray(img)
    warped, _tray_detected, matrix = tray.normalize_tray(img, rect)

    crops: list[np.ndarray] = []
    occupancy: list[tuple[float, float]] = []
    for cell in cells:
        crop = tray.crop_cell(warped, cell)
        crops.append(crop)
        occupancy.append(tray.occupancy(crop))

    original_shape = img.shape
    warped_shape = warped.shape
    results = _menu_model.predict(
        crops, imgsz=DET_IMGSZ, conf=DET_CONF, iou=DET_IOU, device='cpu', verbose=False
    )
    compartments = []
    for index, (cell, crop, (ratio, texture), result) in enumerate(zip(cells, crops, occupancy, results)):
        empty = tray.is_empty(ratio, texture)
        quad = tray.cell_quad_norm(cell, matrix, warped_shape, original_shape)
        ranked = [] if empty else _rank_menu(result.boxes)
        if not ranked:
            compartments.append(
                {
                    'index': index,
                    'row': cell.row,
                    'col': cell.col,
                    'cell': cell.label,
                    'bbox_norm': list(cell.bbox),
                    'bbox_quad_norm': quad,
                    'empty': empty,
                    'food_ratio': round(ratio, 4),
                    'texture': round(texture, 2),
                    'menu_class_id': -1,
                    'menu_class_name': '',
                    'menu_display_name': '',
                    'menu_confidence': 0.0,
                    'mixed': False,
                    'alternatives': {},
                }
            )
            continue

        top_id, top_conf = ranked[0]
        class_name = _menu_names.get(top_id, '')
        compartments.append(
            {
                'index': index,
                'row': cell.row,
                'col': cell.col,
                'cell': cell.label,
                'bbox_norm': list(cell.bbox),
                'bbox_quad_norm': quad,
                'empty': False,
                'food_ratio': round(ratio, 4),
                'texture': round(texture, 2),
                'menu_class_id': top_id,
                'menu_class_name': class_name,
                'menu_display_name': labels.menu_label(class_name),
                'menu_confidence': round(top_conf, 4),
                'mixed': False,
                'alternatives': {_menu_names[idx]: value for idx, value in ranked[:3]},
            }
        )
    return compartments


@app.post('/predict-tray')
async def predict_tray(
    image: UploadFile = File(...),
    grid: str | None = Form(None),
) -> dict:
    """Prediksi seluruh foto sekaligus per sekat nampan.

    Objek makanan dilokalisasi objek_deteksi.pt lalu tiap crop dinamai
    makanan_indo.pt; bila detektor tidak menemukan makanan, dipakai grid
    nampan baku sebagai fallback. Koordinat sekat dikembalikan dalam persentase
    terhadap foto asli agar stabil walau resolusi berbeda.
    """
    if _menu_model is None or _detector_model is None or _freshness_model is None:
        raise HTTPException(status_code=503, detail='model belum dimuat')

    started = time.perf_counter()
    img = _decode(await image.read())
    rows, cols = _parse_grid(grid)
    cells = tray.build_grid(rows, cols)
    if len(cells) > MAX_COMPARTMENTS:
        raise HTTPException(status_code=400, detail=f'grid {rows}x{cols} melebihi batas {MAX_COMPARTMENTS} sekat')

    compartments = _detect_food_compartments(img)
    tray_detected = compartments is not None
    if compartments is None:
        compartments = _grid_compartments(img, cells)

    payload = _whole_payload(img, started)
    payload.update(
        {
            'tray_detected': tray_detected,
            'grid': {'rows': rows, 'cols': cols},
            'compartments': compartments,
            'latency_ms': round((time.perf_counter() - started) * 1000, 2),
        }
    )
    return payload


def _clamp_box(x1: int, y1: int, x2: int, y2: int, height: int, width: int) -> tuple[int, int, int, int]:
    x1 = max(0, min(x1, width - 1))
    y1 = max(0, min(y1, height - 1))
    x2 = max(0, min(x2, width))
    y2 = max(0, min(y2, height))
    if x2 <= x1:
        x2 = min(width, x1 + 1)
    if y2 <= y1:
        y2 = min(height, y1 + 1)
    return x1, y1, x2, y2


@app.post('/predict-detect')
async def predict_detect(image: UploadFile = File(...), conf: str | None = Form(None)) -> dict:
    """Pendekatan dua-tahap: objek_deteksi.pt melokalisasi bbox + kategori umum,
    tiap crop dinamai makanan_indo.pt untuk nama makanan Indonesia. Kategori
    non-makanan (mis. uang) dilewati tahap penamaan.
    """
    if _menu_model is None or _detector_model is None:
        raise HTTPException(status_code=503, detail='model belum dimuat')

    try:
        min_conf = float(conf) if conf not in (None, '') else DET_CONF
    except ValueError:
        raise HTTPException(status_code=400, detail='conf harus berupa angka')
    min_conf = max(0.0, min(min_conf, 1.0))

    started = time.perf_counter()
    img = _decode(await image.read())
    height, width = img.shape[:2]

    det = _detector_model.predict(
        img, imgsz=DET_IMGSZ, conf=min_conf, iou=DET_IOU, device='cpu', verbose=False
    )[0]

    boxes: list[dict] = []
    for box in _iter_boxes(det):
        category = _detector_names.get(int(box.cls[0]), '')
        x1, y1, x2, y2 = _clamp_box(*(int(v) for v in box.xyxy[0].tolist()), height, width)
        crop = img[y1:y2, x1:x2]
        if crop.size == 0:
            continue
        boxes.append(
            {
                'kategori_umum': category,
                'confidence_deteksi': round(float(box.conf[0]), 4),
                'box': [x1, y1, x2, y2],
                'crop': crop,
            }
        )

    # Tahap 2: penamaan seluruh crop sekaligus (batch) agar latensi minimal.
    name_index: list[int] = []
    name_crops: list[np.ndarray] = []
    for index, entry in enumerate(boxes):
        if entry['kategori_umum'].strip().lower() in NON_FOOD_CATEGORIES:
            continue
        name_index.append(index)
        name_crops.append(entry['crop'])

    named: dict[int, tuple[int, str, float, dict[str, float]]] = {}
    if name_crops:
        results = _menu_model.predict(
            name_crops, imgsz=DET_IMGSZ, conf=DET_CONF, iou=DET_IOU, device='cpu', verbose=False
        )
        for index, result in zip(name_index, results):
            ranked = _rank_menu(result.boxes)
            top_id, top_conf = ranked[0] if ranked else (-1, 0.0)
            named[index] = (
                top_id,
                _menu_names.get(top_id, ''),
                top_conf,
                {_menu_names[idx]: value for idx, value in ranked[:3]},
            )

    items = []
    for index, entry in enumerate(boxes):
        top_id, class_name, top_conf, alternatives = named.get(index, (-1, '', 0.0, {}))
        items.append(
            {
                'kategori_umum': entry['kategori_umum'],
                'nama_spesifik': labels.menu_label(class_name),
                'nama_spesifik_asli': class_name,
                'confidence_deteksi': entry['confidence_deteksi'],
                'confidence_klasifikasi': round(top_conf, 4),
                'alternatives': alternatives,
                'box': entry['box'],
            }
        )

    return {
        'status': 'success',
        'total_item': len(items),
        'data': items,
        'latency_ms': round((time.perf_counter() - started) * 1000, 2),
    }
