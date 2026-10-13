from fastapi.testclient import TestClient

from app.main import DETECTOR_MODEL_PATH, MENU_MODEL_PATH, NON_FOOD_CATEGORIES, _clamp_box, app


def test_clamp_box_keeps_coordinates_inside_image():
    assert _clamp_box(-10, -5, 500, 500, height=400, width=300) == (0, 0, 300, 400)


def test_clamp_box_fixes_inverted_or_degenerate_boxes():
    x1, y1, x2, y2 = _clamp_box(200, 100, 50, 40, height=400, width=300)
    assert (x1, y1) == (200, 100)
    assert x2 > x1 and y2 > y1

    x1, y1, x2, y2 = _clamp_box(299, 399, 999, 999, height=400, width=300)
    assert (x1, y1) == (299, 399)
    assert x2 == 300 and y2 == 400


def test_menu_model_defaults_to_indonesian_food_checkpoint():
    assert MENU_MODEL_PATH.endswith('makanan_indo.pt')


def test_detector_model_defaults_to_category_checkpoint():
    assert DETECTOR_MODEL_PATH.endswith('objek_deteksi.pt')


def test_non_food_categories_skip_classification():
    assert 'uang' in NON_FOOD_CATEGORIES


def test_predict_detect_returns_503_without_lifespan_models():
    client = TestClient(app)
    response = client.post('/predict-detect', files={'image': ('x.jpg', b'', 'image/jpeg')})
    assert response.status_code == 503
