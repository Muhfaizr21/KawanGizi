-- Seed Schedules untuk Dashboard Jadwal Distribusi MBG
INSERT INTO schedules (
    id, school_id, school_name, npsn, city, portions, sppg_id,
    route_name, fleet_name, license_plate, driver_name, driver_phone,
    departure_time, arrival_eta, total_portions, status, status_label,
    status_reason, corridor_name, distance_remaining_km, fleet,
    timestamps, validator_contact, target_schools, telemetry
) VALUES 
(
    'SCHED-001', 'SCH-JKT-01', 'SDN 01 Menteng Pagi', '20101456', 'Jakarta Pusat', 450, 'SPPG-01',
    'Koridor Menteng - Cikini via Jl. Teuku Umar', 'Van Pendingin Berinsulasi (Cold Chain)', 'B 9842 SXZ', 'Hendra Setiawan', '0812-7711-2233',
    '06:28 WIB', '06:56 WIB', 450, 'on_time', 'Tepat Waktu',
    'Perjalanan lancar melalui Koridor Menteng - Cikini.', 'Koridor Menteng - Cikini via Jl. Teuku Umar', 0.8,
    '{"vehicleId": "FLT-JKT-01", "plateNumber": "B 9842 SXZ", "driverName": "Hendra Setiawan", "driverPhone": "0812-7711-2233", "vehicleType": "Van Pendingin Berinsulasi (Cold Chain)", "status": "moving", "currentSpeed": "28 km/h", "cargoTempCelsius": 64.2, "lastGpsPing": "1 menit yang lalu", "gpsLocation": "Jl. Cikini Raya (800m menuju gerbang sekolah)"}',
    '{"cookingStart": "04:45 WIB", "cookingDone": "06:10 WIB", "departedAt": "06:28 WIB", "targetArrival": "06:55 WIB", "currentEta": "06:56 WIB", "actualArrival": null, "delayMinutes": 1, "rescheduledReason": null}',
    '{"name": "Siti Rahmawati, S.Pd", "phone": "0813-2287-9914"}',
    '[]', '{}'
),
(
    'SCHED-002', 'SCH-BDG-02', 'SMPN 2 Bandung Wetan', '20219876', 'Bandung', 620, 'SPPG-04',
    'Koridor Cihapit - Dago via Jl. Riau', 'Box Thermo Hybrid', 'D 8124 AC', 'Asep Ridwan', '0819-3322-1144',
    '06:25 WIB', '06:58 WIB', 620, 'arrived', 'Tiba di Sekolah',
    'Tiba 7 menit lebih cepat dari jadwal wajib. Telah serah terima validator.', 'Koridor Cihapit - Dago via Jl. Riau', 0.0,
    '{"vehicleId": "FLT-BDG-03", "plateNumber": "D 8124 AC", "driverName": "Asep Ridwan", "driverPhone": "0819-3322-1144", "vehicleType": "Box Thermo Hybrid", "status": "delivered", "currentSpeed": "0 km/h (Parkir)", "cargoTempCelsius": 63.8, "lastGpsPing": "Telah Tiba", "gpsLocation": "Halaman Belakang UKS SMPN 2 Bandung"}',
    '{"cookingStart": "04:30 WIB", "cookingDone": "06:05 WIB", "departedAt": "06:25 WIB", "targetArrival": "07:05 WIB", "currentEta": "06:58 WIB", "actualArrival": "06:58 WIB", "delayMinutes": 0, "rescheduledReason": null}',
    '{"name": "Rina Kusuma Dewi, S.Pd", "phone": "0857-9912-3341"}',
    '[]', '{}'
),
(
    'SCHED-003', 'SCH-SBY-03', 'SMPN 1 Surabaya Pusat', '20532109', 'Surabaya', 710, 'SPPG-10',
    'Koridor Wonokromo - Genteng via Jl. Darmo', 'Box Cargo Termal Berinsulasi', 'L 9012 XP', 'Bambang Sugiono', '0813-8899-7711',
    '06:34 WIB', '07:44 WIB', 710, 'delayed_traffic', 'Peringatan Macet (+29m)',
    'Tertahan proyek perbaikan jalur trem Wonokromo. Prediksi terlambat 29 menit melampaui jam 07:30 WIB.', 'Koridor Wonokromo - Genteng via Jl. Darmo', 3.4,
    '{"vehicleId": "FLT-SBY-02", "plateNumber": "L 9012 XP", "driverName": "Bambang Sugiono", "driverPhone": "0813-8899-7711", "vehicleType": "Box Cargo Termal Berinsulasi", "status": "stuck", "currentSpeed": "6 km/h (Macet Padat)", "cargoTempCelsius": 61.5, "lastGpsPing": "2 menit yang lalu", "gpsLocation": "Pertigaan Darmo - Wonokromo (Antrean Padat)"}',
    '{"cookingStart": "04:35 WIB", "cookingDone": "06:12 WIB", "departedAt": "06:34 WIB", "targetArrival": "07:15 WIB", "currentEta": "07:44 WIB", "actualArrival": null, "delayMinutes": 29, "rescheduledReason": null}',
    '{"name": "Agus Subekti, S.Pd.Jas", "phone": "0812-7765-4321"}',
    '[]', '{}'
),
(
    'SCHED-004', 'SCH-YGY-04', 'SDN Percobaan 1 Sleman', '20401122', 'Sleman', 380, 'SPPG-07',
    'Koridor Kaliurang - Ring Road Utara', 'Blind Van Insulated Eco', 'AB 1290 KZ', 'Sigit Purnomo', '0878-1122-3344',
    '06:20 WIB', '06:42 WIB', 380, 'arrived', 'Tiba di Sekolah',
    'Tiba tepat waktu pada gelombang pertama kedatangan.', 'Koridor Kaliurang - Ring Road Utara', 0.0,
    '{"vehicleId": "FLT-YGY-01", "plateNumber": "AB 1290 KZ", "driverName": "Sigit Purnomo", "driverPhone": "0878-1122-3344", "vehicleType": "Blind Van Insulated Eco", "status": "delivered", "currentSpeed": "0 km/h (Selesai)", "cargoTempCelsius": 65.0, "lastGpsPing": "Telah Tiba", "gpsLocation": "Lobby UKS SDN Percobaan 1 Sleman"}',
    '{"cookingStart": "04:30 WIB", "cookingDone": "06:00 WIB", "departedAt": "06:20 WIB", "targetArrival": "06:45 WIB", "currentEta": "06:42 WIB", "actualArrival": "06:42 WIB", "delayMinutes": 0, "rescheduledReason": null}',
    '{"name": "Rahmat Hidayat, S.Pd", "phone": "0877-3890-1122"}',
    '[]', '{}'
),
(
    'SCHED-005', 'SCH-MKS-06', 'SMPN 5 Makassar', '40305678', 'Makassar', 580, 'SPPG-01',
    'Koridor Mariso - Ujung Pandang via Jl. Sudirman', 'Box Termal Logistik', 'DD 8841 XX', 'Daeng Rahmat', '0852-4411-2299',
    '06:32 WIB', '07:55 WIB (Darurat)', 580, 'fleet_breakdown', 'Armada Mogok (Re-route)',
    'Kendaraan katering mengalami kerusakan radiator mendadak di Jl. Haji Bau. Butuh pengiriman armada cadangan.', 'Koridor Mariso - Ujung Pandang via Jl. Sudirman', 2.1,
    '{"vehicleId": "FLT-MKS-04", "plateNumber": "DD 8841 XX", "driverName": "Daeng Rahmat", "driverPhone": "0852-4411-2299", "vehicleType": "Box Termal Logistik", "status": "breakdown", "currentSpeed": "0 km/h (Mogok)", "cargoTempCelsius": 59.8, "lastGpsPing": "3 menit yang lalu", "gpsLocation": "Jl. Haji Bau (Depan Rumah Jabatan Wagub) - Mesin Mati"}',
    '{"cookingStart": "04:40 WIB", "cookingDone": "06:14 WIB", "departedAt": "06:32 WIB", "targetArrival": "07:00 WIB", "currentEta": "07:55 WIB (Darurat)", "actualArrival": null, "delayMinutes": 55, "rescheduledReason": null}',
    '{"name": "Faisal Basri, S.Pd", "phone": "0852-9901-4478"}',
    '[]', '{}'
),
(
    'SCHED-006', 'SCH-MDN-07', 'MIN 2 Medan Petisah', '10204567', 'Medan', 400, 'SPPG-07',
    'Koridor Medan - Petisah via Jl. S. Parman', 'Van Pendingin Berinsulasi', 'BK 7721 DS', 'Zulkifli Nasution', '0821-5588-9900',
    '06:30 WIB', '07:10 WIB', 400, 'on_time', 'Tepat Waktu',
    'Perjalanan stabil dalam koridor utama kota Medan.', 'Koridor Medan - Petisah via Jl. S. Parman', 1.2,
    '{"vehicleId": "FLT-MDN-02", "plateNumber": "BK 7721 DS", "driverName": "Zulkifli Nasution", "driverPhone": "0821-5588-9900", "vehicleType": "Van Pendingin Berinsulasi", "status": "moving", "currentSpeed": "36 km/h", "cargoTempCelsius": 63.4, "lastGpsPing": "1 menit yang lalu", "gpsLocation": "Jl. S. Parman (1.2 km menuju sekolah)"}',
    '{"cookingStart": "04:30 WIB", "cookingDone": "06:08 WIB", "departedAt": "06:30 WIB", "targetArrival": "07:08 WIB", "currentEta": "07:10 WIB", "actualArrival": null, "delayMinutes": 2, "rescheduledReason": null}',
    '{"name": "Aisyah Putri, S.Ag", "phone": "0821-6644-3321"}',
    '[]', '{}'
),
(
    'SCHED-007', 'SCH-JKT-08', 'SDN 05 Tebet Timur', '20108871', 'Jakarta Selatan', 420, 'SPPG-02',
    'Koridor Menteng - Tebet via Manggarai', 'Box Thermo Hybrid', 'B 9133 TKQ', 'Wahyu Hidayat', '0812-9900-4455',
    '06:45 WIB', '07:40 WIB', 420, 'rescheduled', 'Jadwal Khusus (07:45)',
    'Jadwal dimundurkan resmi ke 07:45 WIB karena kegiatan senam kesegaran jasmani Jumat pagi.', 'Koridor Menteng - Tebet via Manggarai', 1.5,
    '{"vehicleId": "FLT-JKT-05", "plateNumber": "B 9133 TKQ", "driverName": "Wahyu Hidayat", "driverPhone": "0812-9900-4455", "vehicleType": "Box Thermo Hybrid", "status": "moving", "currentSpeed": "32 km/h", "cargoTempCelsius": 64.8, "lastGpsPing": "Baru saja", "gpsLocation": "Jl. Tebet Timur Dalam Raya"}',
    '{"cookingStart": "05:00 WIB", "cookingDone": "06:30 WIB", "departedAt": "06:45 WIB", "targetArrival": "07:45 WIB", "currentEta": "07:40 WIB", "actualArrival": null, "delayMinutes": 0, "rescheduledReason": "Penyesuaian Jadwal Hari Jumat (Senam Pagi Bersama 06:30 - 07:30 WIB)"}',
    '{"name": "Dewi Lestari, S.Pd", "phone": "0813-8899-0011"}',
    '[]', '{}'
)
ON CONFLICT (id) DO UPDATE SET
    school_id = EXCLUDED.school_id,
    school_name = EXCLUDED.school_name,
    npsn = EXCLUDED.npsn,
    city = EXCLUDED.city,
    portions = EXCLUDED.portions,
    sppg_id = EXCLUDED.sppg_id,
    route_name = EXCLUDED.route_name,
    fleet_name = EXCLUDED.fleet_name,
    license_plate = EXCLUDED.license_plate,
    driver_name = EXCLUDED.driver_name,
    driver_phone = EXCLUDED.driver_phone,
    departure_time = EXCLUDED.departure_time,
    arrival_eta = EXCLUDED.arrival_eta,
    total_portions = EXCLUDED.total_portions,
    status = EXCLUDED.status,
    status_label = EXCLUDED.status_label,
    status_reason = EXCLUDED.status_reason,
    corridor_name = EXCLUDED.corridor_name,
    distance_remaining_km = EXCLUDED.distance_remaining_km,
    fleet = EXCLUDED.fleet,
    timestamps = EXCLUDED.timestamps,
    validator_contact = EXCLUDED.validator_contact,
    updated_at = NOW();
