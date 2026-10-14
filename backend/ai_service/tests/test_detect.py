from fastapi.testclient import TestClient

from app.main import (
    CROP_PAD,
    DETECTOR_MODEL_PATH,
    DRINK_CATEGORIES,
    MENU_MODEL_PATH,
    NON_FOOD_CATEGORIES,
    PERSON_MODEL_PATH,
    PRODUCE_CATEGORIES,
    PRODUCE_MODEL_PATH,
    STAPLE_CATEGORIES,
    _category_model,
    _clamp_box,
    _covered_by_person,
    _pad_box,
    app,
)


def test_clamp_box_keeps_coordinates_inside_image():
    assert _clamp_box(-10, -5, 500, 500, height=400, width=300) == (0, 0, 300, 400)


def test_clamp_box_fixes_inverted_or_degenerate_boxes():
    x1, y1, x2, y2 = _clamp_box(200, 100, 50, 40, height=400, width=300)
    assert (x1, y1) == (200, 100)
    assert x2 > x1 and y2 > y1

    x1, y1, x2, y2 = _clamp_box(299, 399, 999, 999, height=400, width=300)
    assert (x1, y1) == (299, 399)
    assert x2 == 300 and y2 == 400


def test_menu_model_defaults_to_food_drink_checkpoint():
    assert MENU_MODEL_PATH.endswith('makanan_minuman.pt')


def test_detector_model_defaults_to_category_checkpoint():
    assert DETECTOR_MODEL_PATH.endswith('objek_deteksi.pt')


def test_produce_model_defaults_to_fruit_vegetable_checkpoint():
    assert PRODUCE_MODEL_PATH.endswith('buah.pt')


def test_non_food_categories_skip_classification():
    assert 'uang' in NON_FOOD_CATEGORIES


def test_produce_categories_route_to_produce_model():
    assert {'buah', 'sayur'} <= PRODUCE_CATEGORIES


def test_drink_categories_route_to_drink_model():
    assert 'minuman' in DRINK_CATEGORIES


def test_staple_categories_route_to_staple_model():
    assert 'makanan_pokok' in STAPLE_CATEGORIES


def test_person_model_defaults_to_coco_filter_checkpoint():
    assert PERSON_MODEL_PATH.endswith('orang.pt')


def test_covered_by_person_drops_boxes_mostly_inside_person():
    persons = [(0, 0, 100, 100)]
    assert _covered_by_person((10, 10, 90, 90), persons) is True
    # Kotak makanan di samping orang tidak boleh dibuang.
    assert _covered_by_person((150, 150, 200, 200), persons) is False
    # Hanya bersinggungan sedikit tetap dipertahankan.
    assert _covered_by_person((90, 90, 200, 200), persons) is False
    assert _covered_by_person((10, 10, 90, 90), []) is False


def test_pad_box_expands_and_clamps_to_image():
    # CROP_PAD default 0.3 -> 30% tiap sisi; di-clamp ke batas citra.
    x1, y1, x2, y2 = _pad_box(100, 100, 200, 200, height=400, width=400)
    assert (x1, y1, x2, y2) == (70, 70, 230, 230)
    assert _pad_box(0, 0, 100, 100, height=400, width=400) == (0, 0, 130, 130)
    assert CROP_PAD >= 0


def test_category_model_only_routes_known_specialist_categories():
    assert _category_model('makanan_pokok') is not None
    assert _category_model('buah') is not None
    assert _category_model('sayur') is not None
    assert _category_model('minuman') is not None
    # Kategori lain harus pakai makanan_minuman.pt, bukan model khusus.
    assert _category_model('lauk') is None
    assert _category_model('kue') is None
    assert _category_model('sop') is None


def test_predict_detect_returns_503_without_lifespan_models():
    client = TestClient(app)
    response = client.post('/predict-detect', files={'image': ('x.jpg', b'', 'image/jpeg')})
    assert response.status_code == 503
