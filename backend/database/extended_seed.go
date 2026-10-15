package database

import (
	"context"
	"fmt"
	"log"
)

// SeedExtended mengisikan data master dan operasional jika tabel masih kosong.
func SeedExtended(ctx context.Context) error {
	var count int
	if err := pool.QueryRow(ctx, "SELECT COUNT(*) FROM sppg_kitchens").Scan(&count); err != nil {
		return fmt.Errorf("cek sppg_kitchens: %w", err)
	}
	if count > 0 {
		return nil
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("memulai transaksi extended seed: %w", err)
	}
	defer tx.Rollback(ctx)

	// 1. Seed SPPG Kitchens
	sppgQueries := []string{
		`INSERT INTO sppg_kitchens (id, code, name, legal_entity, type, type_label, address, subdistrict, city, province, cluster, coordinates, manager_name, manager_nip, manager_phone, nutritionist_name, nutritionist_str, staff_count, kitchen_area, fleet_count, fleet_type, max_daily_portions, active_quota, safety_score, cold_chain_score, timeliness_score, composite_score, grade, status)
		VALUES 
		('SPPG-01', 'BGN-SPPG-001', 'SPPG Sentral Menteng 01', 'Satuan Pelayanan Pangan Mandiri BGN', 'sentral', 'Dapur Sentral BGN', 'Jl. Pegangsaan Barat No. 14, Menteng', 'Menteng', 'Jakarta Pusat', 'DKI Jakarta', 'Kluster Sentral DKI-01', '-6.1983, 106.8450', 'Chef Aris Munandar, A.Md.Par', '19820514 200801 1 002', '+62 812-8821-4401', 'Nur Aini, S.Gz', 'STR-GZ/2024/09881', 38, '520 m²', 6, 'Mobil Box Berpendingin (IoT Chiller 2-4°C)', 3500, 2800, 99.4, 98.7, 99.6, 99.2, 'A+', 'active'),
		('SPPG-001', 'BGN-SPPG-001', 'SPPG Sentral Menteng 01', 'Satuan Pelayanan Pangan Mandiri BGN', 'sentral', 'Dapur Sentral BGN', 'Jl. Pegangsaan Barat No. 14, Menteng', 'Menteng', 'Jakarta Pusat', 'DKI Jakarta', 'Kluster Sentral DKI-01', '-6.1983, 106.8450', 'Chef Aris Munandar, A.Md.Par', '19820514 200801 1 002', '+62 812-8821-4401', 'Nur Aini, S.Gz', 'STR-GZ/2024/09881', 38, '520 m²', 6, 'Mobil Box Berpendingin (IoT Chiller 2-4°C)', 3500, 2800, 99.4, 98.7, 99.6, 99.2, 'A+', 'active'),
		('SPPG-04', 'BGN-SPPG-004', 'SPPG Sentral Sukajadi Bandung', 'PT Pangan Madani Parahyangan', 'sentral', 'Dapur Sentral Mandiri', 'Jl. Sukajadi No. 182, Pasteur', 'Sukajadi', 'Kota Bandung', 'Jawa Barat', 'Kluster Bandung Raya-01', '-6.8842, 107.5961', 'Chef Dicky Suherman, S.ST', '19851120 201102 1 005', '+62 813-2209-1823', 'Rina Wulandari, S.Tr.Gz', 'STR-GZ/2023/11204', 32, '480 m²', 5, 'Mobil Chiller IoT Isuzu Traga (Box PU Foam 10cm)', 3000, 2450, 98.8, 97.9, 98.5, 98.4, 'A', 'active'),
		('SPPG-004', 'BGN-SPPG-004', 'SPPG Sentral Sukajadi Bandung', 'PT Pangan Madani Parahyangan', 'sentral', 'Dapur Sentral Mandiri', 'Jl. Sukajadi No. 182, Pasteur', 'Sukajadi', 'Kota Bandung', 'Jawa Barat', 'Kluster Bandung Raya-01', '-6.8842, 107.5961', 'Chef Dicky Suherman, S.ST', '19851120 201102 1 005', '+62 813-2209-1823', 'Rina Wulandari, S.Tr.Gz', 'STR-GZ/2023/11204', 32, '480 m²', 5, 'Mobil Chiller IoT Isuzu Traga (Box PU Foam 10cm)', 3000, 2450, 98.8, 97.9, 98.5, 98.4, 'A', 'active'),
		('SPPG-02', 'BGN-SPPG-002', 'SPPG Kebayoran Baru Mandiri', 'Koperasi Pegawai Pangan Selatan', 'rekanan', 'Dapur Rekanan Terakreditasi', 'Jl. Wijaya IX No. 22, Melawai', 'Kebayoran Baru', 'Jakarta Selatan', 'DKI Jakarta', 'Kluster Selatan DKI-02', '-6.2415, 106.7992', 'Budi Santoso, S.Par', '19800315 200501 1 001', '+62 811-9988-213', 'Maya Indriani, S.Gz', 'STR-GZ/2022/04512', 28, '410 m²', 4, 'Mobil Thermoking IoT -20°C s/d +10°C', 2500, 2100, 97.5, 98.1, 96.8, 97.5, 'A', 'active'),
		('SPPG-002', 'BGN-SPPG-002', 'SPPG Kebayoran Baru Mandiri', 'Koperasi Pegawai Pangan Selatan', 'rekanan', 'Dapur Rekanan Terakreditasi', 'Jl. Wijaya IX No. 22, Melawai', 'Kebayoran Baru', 'Jakarta Selatan', 'DKI Jakarta', 'Kluster Selatan DKI-02', '-6.2415, 106.7992', 'Budi Santoso, S.Par', '19800315 200501 1 001', '+62 811-9988-213', 'Maya Indriani, S.Gz', 'STR-GZ/2022/04512', 28, '410 m²', 4, 'Mobil Thermoking IoT -20°C s/d +10°C', 2500, 2100, 97.5, 98.1, 96.8, 97.5, 'A', 'active'),
		('SPPG-07', 'BGN-SPPG-007', 'SPPG Banyumanik Sejahtera Semarang', 'CV Berkah Boga Nusantara', 'sentral', 'Dapur Sentral Wilayah', 'Jl. Setiabudi No. 104, Srondol', 'Banyumanik', 'Kota Semarang', 'Jawa Tengah', 'Kluster Semarang Selatan-01', '-7.0621, 110.4189', 'Siti Rahmawati, S.Pd', '19870912 201403 2 004', '+62 815-7788-990', 'Farhan Maulana, S.Gz', 'STR-GZ/2024/15609', 24, '390 m²', 4, 'Armada Box Insulasi Thermo-Guard', 2200, 1950, 98.1, 96.9, 99.0, 98.0, 'A', 'active'),
		('SPPG-007', 'BGN-SPPG-007', 'SPPG Banyumanik Sejahtera Semarang', 'CV Berkah Boga Nusantara', 'sentral', 'Dapur Sentral Wilayah', 'Jl. Setiabudi No. 104, Srondol', 'Banyumanik', 'Kota Semarang', 'Jawa Tengah', 'Kluster Semarang Selatan-01', '-7.0621, 110.4189', 'Siti Rahmawati, S.Pd', '19870912 201403 2 004', '+62 815-7788-990', 'Farhan Maulana, S.Gz', 'STR-GZ/2024/15609', 24, '390 m²', 4, 'Armada Box Insulasi Thermo-Guard', 2200, 1950, 98.1, 96.9, 99.0, 98.0, 'A', 'active'),
		('SPPG-10', 'BGN-SPPG-010', 'SPPG Wonokromo Sehat Surabaya', 'PT Boga Jatim Mandiri', 'rekanan', 'Dapur Rekanan BGN', 'Jl. Raya Darmo No. 88, Wonokromo', 'Wonokromo', 'Kota Surabaya', 'Jawa Timur', 'Kluster Surabaya Selatan-01', '-7.2981, 112.7381', 'Ir. H. Gunawan Wibisono', '19750421 200112 1 003', '+62 812-3344-5566', 'Dr. dr. Anisa Putri, M.Gizi', 'STR-GZ/2021/08123', 35, '510 m²', 6, 'Armada Chiller Double Cabin IoT GPS', 3200, 2700, 96.5, 95.8, 97.2, 96.5, 'B+', 'active'),
		('SPPG-003', 'BGN-SPPG-003', 'SPPG Wonokromo Sehat Surabaya', 'PT Boga Jatim Mandiri', 'rekanan', 'Dapur Rekanan BGN', 'Jl. Raya Darmo No. 88, Wonokromo', 'Wonokromo', 'Kota Surabaya', 'Jawa Timur', 'Kluster Surabaya Selatan-01', '-7.2981, 112.7381', 'Ir. H. Gunawan Wibisono', '19750421 200112 1 003', '+62 812-3344-5566', 'Dr. dr. Anisa Putri, M.Gizi', 'STR-GZ/2021/08123', 35, '510 m²', 6, 'Armada Chiller Double Cabin IoT GPS', 3200, 2700, 96.5, 95.8, 97.2, 96.5, 'B+', 'active'),
		('SPPG-006', 'BGN-SPPG-006', 'SPPG Sentral Makassar', 'PT Pangan Timur Sejahtera', 'sentral', 'Dapur Sentral BGN', 'Jl. Sudirman No. 12, Ujung Pandang', 'Ujung Pandang', 'Kota Makassar', 'Sulawesi Selatan', 'Kluster Makassar-01', '-5.1477, 119.4327', 'Daeng Rahmat', '19830510 200902 1 003', '+62 852-4411-2299', 'Faisal Basri, S.Gz', 'STR-GZ/2023/07812', 25, '400 m²', 4, 'Box Termal Logistik', 2500, 2000, 96.0, 95.0, 97.0, 96.0, 'B+', 'active')
		ON CONFLICT (id) DO NOTHING;`,

	}
	for _, q := range sppgQueries {
		if _, err := tx.Exec(ctx, q); err != nil {
			return fmt.Errorf("seed sppg: %w", err)
		}
	}

	// 2. Seed Schools
	schoolQuery := `INSERT INTO schools (npsn, id, name, level, status, status_label, status_reason, address, city, district, lat, lng, principal_name, principal_nip, principal_phone, principal_email, total_students, total_calorie_target, dietary_notes, sppg_id, acceptance_rate, avg_arrival_time)
	VALUES 
	('33.210.130', 'SCH-JKT-01', 'SDN 01 Menteng Pagi', 'SD', 'active', 'Aktif Penuh', 'Operasional normal, penerimaan porsi lancar setiap 06:55 WIB.', 'Jl. Besuki No. 4, Menteng, Jakarta Pusat', 'Jakarta Pusat', 'Kec. Menteng', -6.198321, 106.832742, 'Dra. Hj. Sri Wahyuni, M.Pd', '19680412 199203 2 004', '0812-9843-1102', 'sri.wahyuni@sdn01menteng.sch.id', 480, 248000, '6 siswa bebas kacang & telur', 'SPPG-01', 99.4, '06:55 WIB'),
	('20219876', 'SCH-BDG-02', 'SMPN 2 Bandung Wetan', 'SMP', 'active', 'Aktif Penuh', 'Operasional normal jenjang SMP dengan porsi protein tinggi.', 'Jl. Sumatera No. 40, Citarum, Bandung Wetan', 'Kota Bandung', 'Kec. Bandung Wetan', -6.911245, 107.614892, 'Drs. H. Agus Mulyana, M.M.', '19710815 199702 1 003', '0813-2210-9941', 'agus.mulyana@smpn2bdg.sch.id', 650, 422500, 'Standar AKG Remaja 650 kkal terpenuhi', 'SPPG-04', 98.9, '07:05 WIB'),
	('20101456', 'SCH-JKT-03', 'SDN Gondangdia 01', 'SD', 'active', 'Aktif Penuh', 'Penerimaan porsi reguler setiap pagi.', 'Jl. Gondangdia Lama No. 12, Menteng', 'Jakarta Pusat', 'Kec. Menteng', -6.191200, 106.834100, 'Bapak Mulyadi, S.Pd', '19750312 200003 1 002', '0812-7788-9911', 'mulyadi@sdngondangdia.sch.id', 530, 274000, 'Semua menu lolos uji alergi', 'SPPG-01', 99.1, '07:15 WIB'),
	('20532109', 'SCH-SBY-04', 'SDN Wonokromo 1 Surabaya', 'SD', 'active', 'Aktif Penuh', 'Jadwal makan siang tepat pukul 09:30 WIB.', 'Jl. Wonokromo No. 45, Wonokromo', 'Kota Surabaya', 'Kec. Wonokromo', -7.299500, 112.739000, 'Ibu Hj. Retno Palupi, M.Pd', '19800214 200501 2 006', '0812-3321-4455', 'retno@sdnwonokromo1.sch.id', 520, 269000, '3 siswa intoleransi laktosa', 'SPPG-10', 98.5, '07:10 WIB'),
	('20401122', 'SCH-SMG-05', 'SDN Srondol Wetan 02 Semarang', 'SD', 'active', 'Aktif Penuh', 'Fasilitas UKS dan wastafel cuci tangan memadai.', 'Jl. Karangrejo No. 8, Banyumanik', 'Kota Semarang', 'Kec. Banyumanik', -7.065400, 110.419800, 'Drs. Bambang Sudarsono', '19730519 199803 1 004', '0815-4433-2211', 'bambang@sdnsrondol02.sch.id', 440, 227000, 'Menu non-pedas untuk kelas bawah', 'SPPG-07', 99.0, '06:50 WIB')
	ON CONFLICT (npsn) DO NOTHING;`
	if _, err := tx.Exec(ctx, schoolQuery); err != nil {
		return fmt.Errorf("seed schools: %w", err)
	}

	// 3. Seed Menu Packages (10 Siklus Nasional Paket A - J)
	menuQuery := `INSERT INTO menu_packages (id, cycle_code, day_slot, name, staple, protein_main, side_veggie, fruit, dairy_drink, calories, protein, carbs, fat, calcium, iron, zinc, cost_per_serving, allergens, halal_cert, slhs_cert, description)
	VALUES 
	('PKG-A', 'Paket A', 'Senin (Hari Ke-1)', 'Nasi Ayam Panggang Madu & Capcay Brokoli Organik', 'Nasi Putih Pandan Wangi (150g)', 'Ayam Panggang Madu Bumbu Kuning (85g)', 'Capcay Brokoli, Wortel & Jamur Kuping (90g)', 'Pisang Barangan Medan (1 buah - 100g)', 'Susu Sapi Segar Pasteurisasi (200ml)', 580, 28.5, 72.0, 14.5, 420, 5.8, 4.2, 14850, 'Laktosa (Susu Sapi)', 'ID00410000129381023', 'SLHS-BGN-2026-A1', 'Menu favorit siswa dengan kombinasi protein tinggi dari ayam panggang tanpa minyak jenuh berlebih dan sayuran kaya vitamin C.'),
	('PKG-B', 'Paket B', 'Selasa (Hari Ke-2)', 'Nasi Kuning Cakalang Asap & Sayur Urap Kelapa Sangrai', 'Nasi Kuning Gurih Rempah Alami (150g)', 'Suwir Ikan Cakalang Asap Bumbu Rica Lembut (90g)', 'Sayur Urap Daun Singkong & Kacang Panjang (85g)', 'Jeruk Manis Pontianak (1 buah - 110g)', 'Air Mineral Higienis + Susu Kedelai Fortifikasi (200ml)', 565, 29.0, 68.5, 15.0, 390, 6.2, 4.4, 14700, 'Kedelai, Ikan Laut', 'ID00410000129381024', 'SLHS-BGN-2026-A2', 'Kandungan asam lemak Omega-3 melimpah untuk menunjang daya konsentrasi belajar siswa usia pertumbuhan.'),
	('PKG-C', 'Paket C', 'Rabu (Hari Ke-3)', 'Nasi Ulen Empal Daging Suwir & Sayur Lodeh Labu Siam', 'Nasi Putih Organik Beras Cianjur (150g)', 'Empal Daging Sapi Suwir Lengkuas Gurih (75g)', 'Sayur Lodeh Labu Siam & Jagung Manis Pipil (95g)', 'Semangka Merah Potong Dingin (120g)', 'Susu Sapi Pasteurisasi Rasa Cokelat Ringan (200ml)', 590, 27.8, 74.0, 15.2, 410, 6.5, 4.8, 14950, 'Laktosa, Sapi', 'ID00410000129381025', 'SLHS-BGN-2026-A3', 'Zat besi heme yang tinggi dari daging sapi lokal untuk mencegah gejala anemia dan kelesuan pada anak di jam belajar.'),
	('PKG-D', 'Paket D', 'Kamis (Hari Ke-4)', 'Nasi Liwet Ikan Nila Bakar Madu & Tumis Buncis Jagung', 'Nasi Liwet Gurih Daun Salam Serai (150g)', 'Fillet Ikan Nila Bakar Madu Rendah Garam (85g)', 'Tumis Buncis Muda & Jagung Pipil Manis (85g)', 'Melon Madu Iris Segar (110g)', 'Yogurt Minum Probiotik Stroberi Alami (180ml)', 575, 28.2, 70.0, 13.8, 430, 5.2, 4.1, 14600, 'Laktosa, Ikan Air Tawar', 'ID00410000129381026', 'SLHS-BGN-2026-A4', 'Probiotik alami untuk menjaga kesehatan mikrobioma usus dan daya tahan tubuh anak sekolah.'),
	('PKG-E', 'Paket E', 'Jumat (Hari Ke-5)', 'Nasi Merah Rolade Ayam Sayur & Sup Bening Bayam Jagung', 'Nasi Merah Campur Beras Putih Pulen (150g)', 'Rolade Ayam Cincang Isi Wortel & Telur Puyuh (90g)', 'Sup Bening Bayam Hijau & Jagung Manis (100g)', 'Pepaya California Iris (120g)', 'Susu Pasteurisasi Full Cream Fortifikasi Vitamin D (200ml)', 555, 26.5, 73.0, 12.5, 450, 5.9, 4.0, 14400, 'Telur, Laktosa', 'ID00410000129381027', 'SLHS-BGN-2026-A5', 'Serat pangan tinggi dan antioksidan untuk stamina optimal menjelang akhir pekan.')
	ON CONFLICT (id) DO NOTHING;`
	if _, err := tx.Exec(ctx, menuQuery); err != nil {
		return fmt.Errorf("seed menu_packages: %w", err)
	}

	// 4. Seed Calendar Days
	calQuery := `INSERT INTO calendar_days (date, package_id, day_name, week_number, day_type, status, theme, notes, target_portions)
	VALUES 
	('2026-10-05', 'PKG-A', 'Senin', 1, 'regular', 'approved', 'Senin Berenergi - Protein Unggas Segar', 'Distribusi porsi serentak jam 06:45 WIB.', 550000),
	('2026-10-06', 'PKG-B', 'Selasa', 1, 'regular', 'approved', 'Selasa Cerdas - Omega 3 Ikan Laut', 'Pengawasan suhu cold-chain armada diperketat.', 550000),
	('2026-10-07', 'PKG-C', 'Rabu', 1, 'regular', 'approved', 'Rabu Kuat - Zat Besi Daging Sapi Pilihan', 'Hari ini berlangsung monitoring dashboard real-time.', 550000),
	('2026-10-08', 'PKG-D', 'Kamis', 1, 'regular', 'approved', 'Kamis Sehat - Ikan Air Tawar & Probiotik', 'Verifikasi gizi dan kepatuhan SOP dapur SPPG.', 550000),
	('2026-10-09', 'PKG-E', 'Jumat', 1, 'regular', 'approved', 'Jumat Berkah Serat - Sayur Bayam & Nasi Merah', 'Evaluasi mingguan penerimaan siswa dan audit BAST.', 550000)
	ON CONFLICT (date) DO NOTHING;`
	if _, err := tx.Exec(ctx, calQuery); err != nil {
		return fmt.Errorf("seed calendar_days: %w", err)
	}

	// 5. Seed SPPG Batches
	batchQuery := `INSERT INTO sppg_batches (id, sppg_id, package_id, cooking_date, cooking_start, cooking_end, target_portions, actual_portions, core_temp_c, cook_lead, qc_status, haccp_status, notes)
	VALUES 
	('BTH-0842-MNT', 'SPPG-01', 'PKG-C', '2026-10-07', '04:15 WIB', '05:45 WIB', 2800, 2800, 78.5, 'Chef Aris Munandar', 'passed', 'safe', 'Suhu inti daging sapi 78.5°C melampaui batas aman HACCP 74°C.'),
	('BTH-0843-BDG', 'SPPG-04', 'PKG-C', '2026-10-07', '04:30 WIB', '06:00 WIB', 2450, 2450, 79.2, 'Chef Dicky Suherman', 'passed', 'safe', 'QC organoleptik lulus sempurna.'),
	('BTH-0844-SMG', 'SPPG-07', 'PKG-C', '2026-10-07', '04:00 WIB', '05:30 WIB', 1950, 1950, 81.0, 'Siti Rahmawati', 'passed', 'safe', 'Packing box termo selesai tepat waktu.')
	ON CONFLICT (id) DO NOTHING;`
	if _, err := tx.Exec(ctx, batchQuery); err != nil {
		return fmt.Errorf("seed sppg_batches: %w", err)
	}

	// 6. Seed Deliveries
	delQuery := `INSERT INTO deliveries (id, batch_id, sppg_id, school_npsn, validator_name, scanned_at, scan_date, portions, target_portions, temp_c, temp_status, qr_token, qr_status, crypto_hash, menu_name, ai_verdict, ai_score, image_url, status)
	VALUES 
	('DEL-2026-JKT-0982', 'BTH-0842-MNT', 'SPPG-01', '33.210.130', 'Dr. Hendra Prasetyo', '07:12:45 WIB', '2026-10-07', 480, 480, 23.4, 'safe', 'MBG-QR-7719-X89A-001', 'verified', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'Nasi Ulen Empal Daging Suwir & Sayur Lodeh', 'layak', 99.4, '/img/samples/meal_sdn01.jpg', 'Tiba Sesuai Jadwal'),
	('DEL-2026-BDG-0412', 'BTH-0843-BDG', 'SPPG-04', '20219876', 'Ibu Siti Maryam', '07:05:12 WIB', '2026-10-07', 650, 650, 22.8, 'safe', 'MBG-QR-8820-Y12B-002', 'verified', 'b2a1c998e11849a99f123a41c9983de47ae41e4649b934ca495991b7852b855a', 'Nasi Ulen Empal Daging Suwir & Sayur Lodeh', 'layak', 98.9, '/img/samples/meal_smpn2.jpg', 'Tiba Sesuai Jadwal'),
	('DEL-2026-JKT-0985', 'BTH-0842-MNT', 'SPPG-01', '20101456', 'Bapak Mulyadi', '07:18:30 WIB', '2026-10-07', 530, 530, 24.1, 'safe', 'MBG-QR-7720-X89A-003', 'verified', 'c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4', 'Nasi Ulen Empal Daging Suwir & Sayur Lodeh', 'layak', 99.1, '/img/samples/meal_gondangdia.jpg', 'Tiba Sesuai Jadwal')
	ON CONFLICT (id) DO NOTHING;`
	if _, err := tx.Exec(ctx, delQuery); err != nil {
		return fmt.Errorf("seed deliveries: %w", err)
	}

	// 7. Seed Schedules (Ambil ID SPPG yang benar-benar ada di database agar tidak melanggar foreign key)
	var activeSppgID string
	_ = tx.QueryRow(ctx, "SELECT sppg_id FROM users WHERE role = 'sppg' AND sppg_id != '' LIMIT 1").Scan(&activeSppgID)
	if activeSppgID == "" {
		_ = tx.QueryRow(ctx, "SELECT id FROM sppg_kitchens ORDER BY id ASC LIMIT 1").Scan(&activeSppgID)
	}
	if activeSppgID == "" {
		activeSppgID = "SPPG-01"
	}

	getValidSPPG := func(preferred string) string {
		var exists bool
		_ = tx.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM sppg_kitchens WHERE id = $1)", preferred).Scan(&exists)
		if exists {
			return preferred
		}
		return activeSppgID
	}

	sppgJKT1 := getValidSPPG("SPPG-01")
	sppgBDG := getValidSPPG("SPPG-04")
	sppgSBY := getValidSPPG("SPPG-10")
	sppgYGY := getValidSPPG("SPPG-07")
	sppgMKS := getValidSPPG("SPPG-01")
	sppgMDN := getValidSPPG("SPPG-07")
	sppgJKT2 := getValidSPPG("SPPG-02")

	schedQuery := fmt.Sprintf(`INSERT INTO schedules (
		id, school_id, school_name, npsn, city, portions, sppg_id,
		route_name, fleet_name, license_plate, driver_name, driver_phone,
		departure_time, arrival_eta, total_portions, status, status_label,
		status_reason, corridor_name, distance_remaining_km, fleet,
		timestamps, validator_contact, target_schools, telemetry
	) VALUES 
	(
		'SCHED-001', 'SCH-JKT-01', 'SDN 01 Menteng Pagi', '20101456', 'Jakarta Pusat', 450, '%s',
		'Koridor Menteng - Cikini via Jl. Teuku Umar', 'Van Pendingin Berinsulasi (Cold Chain)', 'B 9842 SXZ', 'Hendra Setiawan', '0812-7711-2233',
		'06:28 WIB', '06:56 WIB', 450, 'on_time', 'Tepat Waktu',
		'Perjalanan lancar melalui Koridor Menteng - Cikini.', 'Koridor Menteng - Cikini via Jl. Teuku Umar', 0.8,
		'{"vehicleId": "FLT-JKT-01", "plateNumber": "B 9842 SXZ", "driverName": "Hendra Setiawan", "driverPhone": "0812-7711-2233", "vehicleType": "Van Pendingin Berinsulasi (Cold Chain)", "status": "moving", "currentSpeed": "28 km/h", "cargoTempCelsius": 64.2, "lastGpsPing": "1 menit yang lalu", "gpsLocation": "Jl. Cikini Raya (800m menuju gerbang sekolah)"}',
		'{"cookingStart": "04:45 WIB", "cookingDone": "06:10 WIB", "departedAt": "06:28 WIB", "targetArrival": "06:55 WIB", "currentEta": "06:56 WIB", "actualArrival": null, "delayMinutes": 1, "rescheduledReason": null}',
		'{"name": "Siti Rahmawati, S.Pd", "phone": "0813-2287-9914"}', '[]', '{}'
	),
	(
		'SCHED-002', 'SCH-BDG-02', 'SMPN 2 Bandung Wetan', '20219876', 'Bandung', 620, '%s',
		'Koridor Cihapit - Dago via Jl. Riau', 'Box Thermo Hybrid', 'D 8124 AC', 'Asep Ridwan', '0819-3322-1144',
		'06:25 WIB', '06:58 WIB', 620, 'arrived', 'Tiba di Sekolah',
		'Tiba 7 menit lebih cepat dari jadwal wajib. Telah serah terima validator.', 'Koridor Cihapit - Dago via Jl. Riau', 0.0,
		'{"vehicleId": "FLT-BDG-03", "plateNumber": "D 8124 AC", "driverName": "Asep Ridwan", "driverPhone": "0819-3322-1144", "vehicleType": "Box Thermo Hybrid", "status": "delivered", "currentSpeed": "0 km/h (Parkir)", "cargoTempCelsius": 63.8, "lastGpsPing": "Telah Tiba", "gpsLocation": "Halaman Belakang UKS SMPN 2 Bandung"}',
		'{"cookingStart": "04:30 WIB", "cookingDone": "06:05 WIB", "departedAt": "06:25 WIB", "targetArrival": "07:05 WIB", "currentEta": "06:58 WIB", "actualArrival": "06:58 WIB", "delayMinutes": 0, "rescheduledReason": null}',
		'{"name": "Rina Kusuma Dewi, S.Pd", "phone": "0857-9912-3341"}', '[]', '{}'
	),
	(
		'SCHED-003', 'SCH-SBY-03', 'SMPN 1 Surabaya Pusat', '20532109', 'Surabaya', 710, '%s',
		'Koridor Wonokromo - Genteng via Jl. Darmo', 'Box Cargo Termal Berinsulasi', 'L 9012 XP', 'Bambang Sugiono', '0813-8899-7711',
		'06:34 WIB', '07:44 WIB', 710, 'delayed_traffic', 'Peringatan Macet (+29m)',
		'Tertahan proyek perbaikan jalur trem Wonokromo. Prediksi terlambat 29 menit melampaui jam 07:30 WIB.', 'Koridor Wonokromo - Genteng via Jl. Darmo', 3.4,
		'{"vehicleId": "FLT-SBY-02", "plateNumber": "L 9012 XP", "driverName": "Bambang Sugiono", "driverPhone": "0813-8899-7711", "vehicleType": "Box Cargo Termal Berinsulasi", "status": "stuck", "currentSpeed": "6 km/h (Macet Padat)", "cargoTempCelsius": 61.5, "lastGpsPing": "2 menit yang lalu", "gpsLocation": "Pertigaan Darmo - Wonokromo (Antrean Padat)"}',
		'{"cookingStart": "04:35 WIB", "cookingDone": "06:12 WIB", "departedAt": "06:34 WIB", "targetArrival": "07:15 WIB", "currentEta": "07:44 WIB", "actualArrival": null, "delayMinutes": 29, "rescheduledReason": null}',
		'{"name": "Agus Subekti, S.Pd.Jas", "phone": "0812-7765-4321"}', '[]', '{}'
	),
	(
		'SCHED-004', 'SCH-YGY-04', 'SDN Percobaan 1 Sleman', '20401122', 'Sleman', 380, '%s',
		'Koridor Kaliurang - Ring Road Utara', 'Blind Van Insulated Eco', 'AB 1290 KZ', 'Sigit Purnomo', '0878-1122-3344',
		'06:20 WIB', '06:42 WIB', 380, 'arrived', 'Tiba di Sekolah',
		'Tiba tepat waktu pada gelombang pertama kedatangan.', 'Koridor Kaliurang - Ring Road Utara', 0.0,
		'{"vehicleId": "FLT-YGY-01", "plateNumber": "AB 1290 KZ", "driverName": "Sigit Purnomo", "driverPhone": "0878-1122-3344", "vehicleType": "Blind Van Insulated Eco", "status": "delivered", "currentSpeed": "0 km/h (Selesai)", "cargoTempCelsius": 65.0, "lastGpsPing": "Telah Tiba", "gpsLocation": "Lobby UKS SDN Percobaan 1 Sleman"}',
		'{"cookingStart": "04:30 WIB", "cookingDone": "06:00 WIB", "departedAt": "06:20 WIB", "targetArrival": "06:45 WIB", "currentEta": "06:42 WIB", "actualArrival": "06:42 WIB", "delayMinutes": 0, "rescheduledReason": null}',
		'{"name": "Rahmat Hidayat, S.Pd", "phone": "0877-3890-1122"}', '[]', '{}'
	),
	(
		'SCHED-005', 'SCH-MKS-06', 'SMPN 5 Makassar', '40305678', 'Makassar', 580, '%s',
		'Koridor Mariso - Ujung Pandang via Jl. Sudirman', 'Box Termal Logistik', 'DD 8841 XX', 'Daeng Rahmat', '0852-4411-2299',
		'06:32 WIB', '07:55 WIB (Darurat)', 580, 'fleet_breakdown', 'Armada Mogok (Re-route)',
		'Kendaraan katering mengalami kerusakan radiator mendadak di Jl. Haji Bau. Butuh pengiriman armada cadangan.', 'Koridor Mariso - Ujung Pandang via Jl. Sudirman', 2.1,
		'{"vehicleId": "FLT-MKS-04", "plateNumber": "DD 8841 XX", "driverName": "Daeng Rahmat", "driverPhone": "0852-4411-2299", "vehicleType": "Box Termal Logistik", "status": "breakdown", "currentSpeed": "0 km/h (Mogok)", "cargoTempCelsius": 59.8, "lastGpsPing": "3 menit yang lalu", "gpsLocation": "Jl. Haji Bau (Depan Rumah Jabatan Wagub) - Mesin Mati"}',
		'{"cookingStart": "04:40 WIB", "cookingDone": "06:14 WIB", "departedAt": "06:32 WIB", "targetArrival": "07:00 WIB", "currentEta": "07:55 WIB (Darurat)", "actualArrival": null, "delayMinutes": 55, "rescheduledReason": null}',
		'{"name": "Faisal Basri, S.Pd", "phone": "0852-9901-4478"}', '[]', '{}'
	),
	(
		'SCHED-006', 'SCH-MDN-07', 'MIN 2 Medan Petisah', '10204567', 'Medan', 400, '%s',
		'Koridor Medan - Petisah via Jl. S. Parman', 'Van Pendingin Berinsulasi', 'BK 7721 DS', 'Zulkifli Nasution', '0821-5588-9900',
		'06:30 WIB', '07:10 WIB', 400, 'on_time', 'Tepat Waktu',
		'Perjalanan stabil dalam koridor utama kota Medan.', 'Koridor Medan - Petisah via Jl. S. Parman', 1.2,
		'{"vehicleId": "FLT-MDN-02", "plateNumber": "BK 7721 DS", "driverName": "Zulkifli Nasution", "driverPhone": "0821-5588-9900", "vehicleType": "Van Pendingin Berinsulasi", "status": "moving", "currentSpeed": "36 km/h", "cargoTempCelsius": 63.4, "lastGpsPing": "1 menit yang lalu", "gpsLocation": "Jl. S. Parman (1.2 km menuju sekolah)"}',
		'{"cookingStart": "04:30 WIB", "cookingDone": "06:08 WIB", "departedAt": "06:30 WIB", "targetArrival": "07:08 WIB", "currentEta": "07:10 WIB", "actualArrival": null, "delayMinutes": 2, "rescheduledReason": null}',
		'{"name": "Aisyah Putri, S.Ag", "phone": "0821-6644-3321"}', '[]', '{}'
	),
	(
		'SCHED-007', 'SCH-JKT-08', 'SDN 05 Tebet Timur', '20108871', 'Jakarta Selatan', 420, '%s',
		'Koridor Menteng - Tebet via Manggarai', 'Box Thermo Hybrid', 'B 9133 TKQ', 'Wahyu Hidayat', '0812-9900-4455',
		'06:45 WIB', '07:40 WIB', 420, 'rescheduled', 'Jadwal Khusus (07:45)',
		'Jadwal dimundurkan resmi ke 07:45 WIB karena kegiatan senam kesegaran jasmani Jumat pagi.', 'Koridor Menteng - Tebet via Manggarai', 1.5,
		'{"vehicleId": "FLT-JKT-05", "plateNumber": "B 9133 TKQ", "driverName": "Wahyu Hidayat", "driverPhone": "0812-9900-4455", "vehicleType": "Box Thermo Hybrid", "status": "moving", "currentSpeed": "32 km/h", "cargoTempCelsius": 64.8, "lastGpsPing": "Baru saja", "gpsLocation": "Jl. Tebet Timur Dalam Raya"}',
		'{"cookingStart": "05:00 WIB", "cookingDone": "06:30 WIB", "departedAt": "06:45 WIB", "targetArrival": "07:45 WIB", "currentEta": "07:40 WIB", "actualArrival": null, "delayMinutes": 0, "rescheduledReason": "Penyesuaian Jadwal Hari Jumat (Senam Pagi Bersama 06:30 - 07:30 WIB)"}',
		'{"name": "Dewi Lestari, S.Pd", "phone": "0813-8899-0011"}', '[]', '{}'
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
		updated_at = NOW();`,
		sppgJKT1, sppgBDG, sppgSBY, sppgYGY, sppgMKS, sppgMDN, sppgJKT2,
	)
	if _, err := tx.Exec(ctx, schedQuery); err != nil {
		return fmt.Errorf("seed schedules: %w", err)
	}

	// 8. Seed Attendances
	attQuery := `INSERT INTO attendances (
		id, school_npsn, date, registered_students, present_students, delivered_portions, consumed_portions,
		surplus_portions, surplus_status, attendance_rate, finish_rate, reconciliation_status, target_tomorrow_quota,
		absent_details, consumption_eval, golden_window, discrepancy_count, head_validator, notes
	) VALUES 
	('ATT-20261007-01', '33.210.130', '2026-10-07', 480, 468, 480, 468, 12, 'available_for_redistribution', 97.5, 98.2, 'surplus_safe', 470, '{"sick": 10, "permission": 2, "unexplained": 0}', '{"finishRate": 98.2, "riceWastePct": 1.0, "proteinWastePct": 0.2, "veggieWastePct": 1.8, "feedbackNotes": "Porsi gizi dihabiskan dengan baik oleh siswa."}', '{"cookedAt": "05:45 WIB", "deliveredAt": "06:55 WIB", "lunchTime": "09:30 WIB", "safeUntil": "10:45 WIB", "minutesLeft": 45, "isSafeToRedistribute": true}', 0, 'Dr. Hendra Prasetyo', '12 siswa izin sakit. Porsi sisa utuh disimpan di suhu dingin untuk redistribusi aman.'),
	('ATT-20261007-02', '20219876', '2026-10-07', 650, 642, 642, 642, 0, 'zero_surplus', 98.8, 99.0, 'matched', 645, '{"sick": 5, "permission": 3, "unexplained": 0}', '{"finishRate": 99.0, "riceWastePct": 0.5, "proteinWastePct": 0.1, "veggieWastePct": 1.0, "feedbackNotes": "Konsumsi siswa jenjang SMP habis bersih."}', '{"cookedAt": "06:00 WIB", "deliveredAt": "07:05 WIB", "lunchTime": "09:45 WIB", "safeUntil": "10:30 WIB", "minutesLeft": 60, "isSafeToRedistribute": false}', 0, 'Siti Nurhaliza, S.Pd', 'Konsumsi siswa jenjang SMP habis bersih.'),
	('ATT-20261007-03', '20101456', '2026-10-07', 530, 521, 530, 521, 9, 'available_for_redistribution', 98.3, 97.9, 'surplus_safe', 525, '{"sick": 7, "permission": 2, "unexplained": 0}', '{"finishRate": 97.9, "riceWastePct": 1.2, "proteinWastePct": 0.3, "veggieWastePct": 1.5, "feedbackNotes": "Penerimaan tepat waktu tanpa insiden."}', '{"cookedAt": "06:15 WIB", "deliveredAt": "07:15 WIB", "lunchTime": "09:30 WIB", "safeUntil": "10:45 WIB", "minutesLeft": 30, "isSafeToRedistribute": true}', 0, 'Bambang Irawan, S.Kom', 'Penerimaan tepat waktu tanpa insiden.')
	ON CONFLICT (id) DO NOTHING;`
	if _, err := tx.Exec(ctx, attQuery); err != nil {
		return fmt.Errorf("seed attendances: %w", err)
	}

	// 9. Seed Notices
	notQuery := `INSERT INTO notices (
		id, ref_number, title, category, urgency, target_audience, scope_region,
		published_at, effective_date, author_name, author_role, content,
		is_flash_alert, requires_acknowledgement, status, status_label, status_reason,
		acknowledgement_stats, attachments
	)
	VALUES 
	('NOT-2026-001', 'BGN/SE/084/IX/2026', 'Peringatan Darurat: Penarikan Sementara Menu Olahan Kerang & Telur Puyuh SPPG Surabaya', 'seasonal', 'critical', 'all', 'Jawa Timur & Koridor Surabaya', '28 Sep 2026, 06:15 WIB', 'Berlaku Segera s.d 30 Sep 2026', 'Dr. apt. Hendra Gunawan, M.Epid', 'Direktur Kepatuhan Mutu & Keamanan Pangan BGN', 'Ditemukan indikasi kontaminasi cemaran mikrobiologis pada pasokan bahan baku kerang air tawar dan telur puyuh di klaster Jawa Timur. Seluruh Dapur SPPG diinstruksikan MENIADAKAN menu olahan tersebut dan menggantinya dengan daging ayam potong segar terakreditasi NKV.', true, true, 'active', 'Tayang Publik', 'Siaran Flash Alert Aktif. Aplikasi validator terkunci hingga konfirmasi diterima.', '{"totalRecipients": 420, "acknowledgedCount": 398, "complianceRate": 94.8}', '[{"fileName": "Surat_Edaran_Darurat_BGN_084_Penarikan_Bahan.pdf", "fileSize": "1.4 MB", "verifiedSignature": "Terverifikasi BSrE BSSN"}]'),
	('NOT-2026-002', 'BGN/SE/079/IX/2026', 'Surat Edaran BGN: Protokol Uji Suhu Termal Inti Makanan Min 60°C Saat Serah Terima', 'circular', 'important', 'validators', 'Nasional (Seluruh Satuan Pendidikan)', '26 Sep 2026, 14:00 WIB', 'Berlaku Permanen', 'Prof. Dr. Ir. Siti Nurjanah, M.Sc', 'Kepala Badan Gizi Nasional (BGN)', 'Berdasarkan evaluasi mingguan Satgas MBG, ditemukan potensi penurunan suhu makanan jika boks didiamkan lebih dari 45 menit tanpa tutup berinsulasi.', false, true, 'active', 'Tayang Publik', '', '{"totalRecipients": 1250, "acknowledgedCount": 1195, "complianceRate": 95.6}', '[{"fileName": "Pedoman_Suhu_Termal_Inti_MBG_Rev3.pdf", "fileSize": "2.8 MB", "verifiedSignature": "Terverifikasi BSrE BSSN"}]'),
	('NOT-2026-003', 'MBG/SYS/042/IX/2026', 'Pembaruan Sistem: Rilis AI Vision YOLOv8x v2.4 & Jadwal Pemeliharaan Server Tengah Malam', 'system', 'info', 'all', 'Seluruh Indonesia', '25 Sep 2026, 10:30 WIB', '29 Sep 2026, 01:00 – 03:00 WIB', 'Tim Arsitektur Komputasi KawanGizi', 'Pusat Operasi TI & AI Satgas MBG', 'Kami akan melakukan pemeliharaan server database terdistribusi pada hari Selasa, 29 September 2026 pukul 01:00 – 03:00 WIB (dini hari).', false, false, 'active', 'Tayang Publik', '', '{"totalRecipients": 3400, "acknowledgedCount": 2980, "complianceRate": 87.6}', '[{"fileName": "Changelog_YOLOv8x_MBG_v2.4_ReleaseNotes.pdf", "fileSize": "820 KB", "verifiedSignature": "Terverifikasi SHA-256"}]'),
	('NOT-2026-004', 'BGN/ADV/018/IX/2026', 'Advis Musim Pancaroba: Peningkatan Standar Filtrasi Air & Sanitasi Talenan Dapur SPPG', 'seasonal', 'important', 'sppg', 'Wilayah Barat & Tengah Indonesia', '24 Sep 2026, 09:15 WIB', '24 Sep – 15 Okt 2026', 'dr. Yudhi Prasetiyo, Sp.Ok', 'Ketua Tim Audit SLHS & Sanitasi Dapur BGN', 'Memasuki masa peralihan musim hujan, tingkat kekeruhan air tanah dan risiko cemaran coliform meningkat hingga 35%.', false, true, 'active', 'Tayang Publik', '', '{"totalRecipients": 180, "acknowledgedCount": 172, "complianceRate": 95.5}', '[{"fileName": "Instruksi_Audit_Sanitasi_Pancaroba_Dapur_SPPG.pdf", "fileSize": "3.1 MB", "verifiedSignature": "Terverifikasi BSrE BSSN"}]'),
	('NOT-2026-005', 'KEMENDIKBUD/SE/312/2026', 'Surat Edaran Kemendikbud: Integrasi Data Presensi Siswa Dapodik dengan Kuota Makan MBG', 'circular', 'info', 'validators', 'Nasional', '22 Sep 2026, 11:00 WIB', 'Berlaku Semester Genap 2026', 'Direktorat Jenderal PAUD Dikdasmen', 'Kemendikbudristek RI', 'Pemberitahuan kepada seluruh satuan pendidikan jenjang SD dan SMP penerima MBG agar menyinkronkan data presensi siswa di kelas sebelum jam 10:00 WIB setiap harinya.', false, false, 'active', 'Tayang Publik', '', '{"totalRecipients": 1250, "acknowledgedCount": 1180, "complianceRate": 94.4}', '[{"fileName": "Juknis_Sinkronisasi_Dapodik_MBG_2026.pdf", "fileSize": "1.9 MB", "verifiedSignature": "Terverifikasi BSrE BSSN"}]'),
	('NOT-2026-006', 'BGN/SE/066/VIII/2026', 'Maklumat Kedaluwarsa: Pedoman Menu Khusus Uji Coba Katering Wilayah 3T Tahap 1', 'circular', 'info', 'all', 'Wilayah Tertinggal, Terdepan, dan Terluar (3T)', '15 Agu 2026, 08:00 WIB', 'Berakhir 31 Agu 2026', 'Sekretariat Satgas MBG Pusat', 'Satuan Pelayanan Pangan Bergizi', 'Pedoman alokasi menu sementara pada masa uji coba rantai pasok daerah kepulauan dan pedalaman telah resmi digantikan oleh Pedoman Standar Porsi Nasional MBG Rev 3.', false, false, 'archived', 'Diarsipkan', 'Telah digantikan oleh Pedoman Standar Porsi Nasional MBG Rev 3.', '{"totalRecipients": 800, "acknowledgedCount": 760, "complianceRate": 95.0}', '[]')
	ON CONFLICT (id) DO NOTHING;`
	if _, err := tx.Exec(ctx, notQuery); err != nil {
		return fmt.Errorf("seed notices: %w", err)
	}

	// 10. Seed Feedbacks
	fbQuery := `INSERT INTO feedbacks (id, ticket_number, reported_at, school_npsn, school_name, sppg_id, batch_id, menu_package, severity, anomaly_type, affected_portions, reporter_name, reporter_role, reporter_phone, title, description, status, is_kill_switch_executed, evidence_photos, kill_switch_details, medical_escalation)
	VALUES 
	('TKT-2026-10-001', 'INC/BGN/JKT/1007/01', '2026-10-07 07:30 WIB', '33.210.130', 'SDN 01 Menteng Pagi', 'SPPG-01', 'BTH-0842-MNT', 'Paket C', 'level3', 'packaging_issue', 2, 'Ibu Siti Aminah, S.Pd', 'Validator Sekolah', '0812-9901-2211', 'Tutup Boks Sedikit Renggang pada 2 Porsi Kelas 1', 'Ditemukan dua boks makanan kemasan penutupnya sedikit bergeser saat transit. Makanan di dalamnya tetap segar, porsi diganti boks cadangan.', 'resolved', false, '[]', '{}', '{}')
	ON CONFLICT (id) DO NOTHING;`
	if _, err := tx.Exec(ctx, fbQuery); err != nil {
		return fmt.Errorf("seed feedbacks: %w", err)
	}

	// 11. Seed Reports
	repQuery := `INSERT INTO reports (id, report_code, title, period, category, author_name, status, file_size, file_format, kpi_metrics)
	VALUES 
	('REP-2026-10-01', 'BAST/BGN/OKT/2026/01', 'Berita Acara Rekapitulasi Penyaluran MBG Pekan I Oktober 2026', '01 - 07 Oktober 2026', 'BAST Keuangan & Penyaluran', 'Badan Gizi Nasional RI', 'verified', '2.4 MB', 'PDF', '{"totalPortions":3850000,"complianceRate":99.4,"fundDisbursed":57750000000}'),
	('REP-2026-09-02', 'AUDIT/GIZI/SEP/2026/04', 'Laporan Audit Kepatuhan Makronutrien dan Angka Kecukupan Gizi (AKG) September 2026', 'September 2026', 'Audit Gizi & Higienitas', 'Kemenkes RI & BGN', 'verified', '4.1 MB', 'PDF', '{"schoolsAudited":1250,"avgCalorie":578,"deficiencyRate":0.2}')
	ON CONFLICT (id) DO NOTHING;`
	if _, err := tx.Exec(ctx, repQuery); err != nil {
		return fmt.Errorf("seed reports: %w", err)
	}

	// 12. Seed Validator Profiles
	valQuery := `INSERT INTO validator_profiles (id, user_id, satgas_id, name, nip, npsn, role, device, device_id, certification, status, scans_today, quota_today, scan_logs)
	VALUES 
	('VAL-001', 'usr-validator-001', 'BGN-VLD-0042', 'Ibu Siti Aminah, S.Pd.', '19840312 200801 2 003', '33.210.130', 'Penanggung Jawab MBG Sekolah', 'Samsung Galaxy A54 5G', 'dev-samsung-001', 'Sertifikasi Higienitas Dasar (BNSP)', 'active', 48, 48, '[]')
	ON CONFLICT (id) DO NOTHING;`
	if _, err := tx.Exec(ctx, valQuery); err != nil {
		return fmt.Errorf("seed validator_profiles: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit extended seed: %w", err)
	}

	log.Println("✅ Extended seed tabel ekosistem MBG berhasil dimasukkan ke PostgreSQL")
	return nil
}
