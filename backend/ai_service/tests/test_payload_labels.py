from app import main


def test_whole_payload_keeps_raw_class_and_adds_indonesian_display(monkeypatch):
    # Model diganti stub agar uji ini murni memeriksa kontrak payload,
    # bukan bobot checkpoint.
    monkeypatch.setattr(
        main, '_predict_menu',
        lambda img: (18, 'chicken_curry', 0.88, {'chicken_curry': 0.88}),
    )
    monkeypatch.setattr(
        main, '_predict_freshness',
        lambda img: (0, 'Fresh', 0.93, {'Fresh': 0.93}),
    )

    payload = main._whole_payload(None, main.time.perf_counter())

    # Label mentah tidak boleh diubah: pemakaian Go (componentAliases)
    # melakukan pencocokan dengan kunci kelas Inggris.
    assert payload['menu_class_name'] == 'chicken_curry'
    assert payload['freshness_class_name'] == 'Fresh'
    assert payload['menu_display_name'] == 'kari ayam'
    assert payload['freshness_display_name'] == 'Segar'


def test_whole_payload_display_names_fall_back_for_unknown_class(monkeypatch):
    # Kelas hasil retrain di luar peta tampil apa adanya, bukan kosong.
    monkeypatch.setattr(
        main, '_predict_menu',
        lambda img: (3, 'menu_sppg_baru', 0.71, {'menu_sppg_baru': 0.71}),
    )
    monkeypatch.setattr(
        main, '_predict_freshness',
        lambda img: (1, 'Spoiled', 0.8, {'Spoiled': 0.8}),
    )

    payload = main._whole_payload(None, main.time.perf_counter())

    assert payload['menu_display_name'] == 'menu_sppg_baru'
    assert payload['freshness_display_name'] == 'Basi'
