package database

import (
	"context"
	"fmt"
)

const extendedSchema = `
-- 1. SPPG Kitchens (Dapur Sentral & Rekanan BGN)
CREATE TABLE IF NOT EXISTS sppg_kitchens (
	id VARCHAR(64) PRIMARY KEY,
	code VARCHAR(64) NOT NULL DEFAULT '',
	name VARCHAR(255) NOT NULL,
	legal_entity VARCHAR(255) NOT NULL DEFAULT '',
	type VARCHAR(32) NOT NULL DEFAULT 'sentral',
	type_label VARCHAR(64) NOT NULL DEFAULT '',
	address TEXT NOT NULL DEFAULT '',
	subdistrict VARCHAR(100) NOT NULL DEFAULT '',
	city VARCHAR(100) NOT NULL DEFAULT '',
	province VARCHAR(100) NOT NULL DEFAULT '',
	cluster VARCHAR(100) NOT NULL DEFAULT '',
	coordinates VARCHAR(100) NOT NULL DEFAULT '',
	manager_name VARCHAR(150) NOT NULL DEFAULT '',
	manager_nip VARCHAR(50) NOT NULL DEFAULT '',
	manager_phone VARCHAR(50) NOT NULL DEFAULT '',
	nutritionist_name VARCHAR(150) NOT NULL DEFAULT '',
	nutritionist_str VARCHAR(100) NOT NULL DEFAULT '',
	staff_count INT NOT NULL DEFAULT 0,
	kitchen_area VARCHAR(50) NOT NULL DEFAULT '',
	fleet_count INT NOT NULL DEFAULT 0,
	fleet_type TEXT NOT NULL DEFAULT '',
	max_daily_portions INT NOT NULL DEFAULT 0,
	active_quota INT NOT NULL DEFAULT 0,
	safety_score DOUBLE PRECISION NOT NULL DEFAULT 100,
	cold_chain_score DOUBLE PRECISION NOT NULL DEFAULT 100,
	timeliness_score DOUBLE PRECISION NOT NULL DEFAULT 100,
	composite_score DOUBLE PRECISION NOT NULL DEFAULT 100,
	grade VARCHAR(10) NOT NULL DEFAULT 'A',
	status VARCHAR(32) NOT NULL DEFAULT 'active',
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Schools (Sekolah Binaan Penerima MBG)
CREATE TABLE IF NOT EXISTS schools (
	npsn VARCHAR(32) PRIMARY KEY,
	id VARCHAR(64) NOT NULL UNIQUE,
	name VARCHAR(255) NOT NULL,
	level VARCHAR(32) NOT NULL DEFAULT 'SD',
	status VARCHAR(32) NOT NULL DEFAULT 'active',
	status_label VARCHAR(64) NOT NULL DEFAULT 'Aktif Penuh',
	status_reason TEXT NOT NULL DEFAULT '',
	address TEXT NOT NULL DEFAULT '',
	city VARCHAR(100) NOT NULL DEFAULT '',
	district VARCHAR(100) NOT NULL DEFAULT '',
	lat DOUBLE PRECISION NOT NULL DEFAULT 0,
	lng DOUBLE PRECISION NOT NULL DEFAULT 0,
	principal_name VARCHAR(150) NOT NULL DEFAULT '',
	principal_nip VARCHAR(50) NOT NULL DEFAULT '',
	principal_phone VARCHAR(50) NOT NULL DEFAULT '',
	principal_email VARCHAR(150) NOT NULL DEFAULT '',
	total_students INT NOT NULL DEFAULT 0,
	total_calorie_target INT NOT NULL DEFAULT 0,
	dietary_notes TEXT NOT NULL DEFAULT '',
	sppg_id VARCHAR(64) REFERENCES sppg_kitchens(id) ON DELETE SET NULL,
	acceptance_rate DOUBLE PRECISION NOT NULL DEFAULT 100,
	avg_arrival_time VARCHAR(50) NOT NULL DEFAULT '',
	demographics JSONB NOT NULL DEFAULT '{}',
	emergency_contacts JSONB NOT NULL DEFAULT '{}',
	transit_details JSONB NOT NULL DEFAULT '{}',
	last_audit_date VARCHAR(50) NOT NULL DEFAULT '26 Sep 2026',
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Menu Packages (Paket Siklus Menu Standar BGN)
CREATE TABLE IF NOT EXISTS menu_packages (
	id VARCHAR(64) PRIMARY KEY,
	cycle_code VARCHAR(50) NOT NULL DEFAULT '',
	day_slot VARCHAR(100) NOT NULL DEFAULT '',
	name VARCHAR(255) NOT NULL,
	staple VARCHAR(255) NOT NULL DEFAULT '',
	protein_main VARCHAR(255) NOT NULL DEFAULT '',
	side_veggie VARCHAR(255) NOT NULL DEFAULT '',
	fruit VARCHAR(255) NOT NULL DEFAULT '',
	dairy_drink VARCHAR(255) NOT NULL DEFAULT '',
	calories DOUBLE PRECISION NOT NULL DEFAULT 0,
	protein DOUBLE PRECISION NOT NULL DEFAULT 0,
	carbs DOUBLE PRECISION NOT NULL DEFAULT 0,
	fat DOUBLE PRECISION NOT NULL DEFAULT 0,
	calcium DOUBLE PRECISION NOT NULL DEFAULT 0,
	iron DOUBLE PRECISION NOT NULL DEFAULT 0,
	zinc DOUBLE PRECISION NOT NULL DEFAULT 0,
	cost_per_serving DOUBLE PRECISION NOT NULL DEFAULT 0,
	allergens TEXT NOT NULL DEFAULT '',
	halal_cert VARCHAR(100) NOT NULL DEFAULT '',
	slhs_cert VARCHAR(100) NOT NULL DEFAULT '',
	description TEXT NOT NULL DEFAULT '',
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Calendar Days (Kalender MBG Operasional & Siklus Harian)
CREATE TABLE IF NOT EXISTS calendar_days (
	date DATE PRIMARY KEY,
	package_id VARCHAR(64) REFERENCES menu_packages(id) ON DELETE SET NULL,
	day_name VARCHAR(50) NOT NULL DEFAULT '',
	week_number INT NOT NULL DEFAULT 1,
	day_type VARCHAR(32) NOT NULL DEFAULT 'regular',
	status VARCHAR(32) NOT NULL DEFAULT 'approved',
	theme VARCHAR(255) NOT NULL DEFAULT '',
	notes TEXT NOT NULL DEFAULT '',
	target_portions INT NOT NULL DEFAULT 0,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. SPPG Recipes (Resep Masakan & SOP TKPI)
CREATE TABLE IF NOT EXISTS sppg_recipes (
	id VARCHAR(64) PRIMARY KEY,
	name VARCHAR(255) NOT NULL,
	category VARCHAR(100) NOT NULL DEFAULT '',
	portion_size_g INT NOT NULL DEFAULT 0,
	prep_time_minutes INT NOT NULL DEFAULT 0,
	cooking_temp_c DOUBLE PRECISION NOT NULL DEFAULT 0,
	sop_haccp TEXT NOT NULL DEFAULT '',
	ingredients JSONB NOT NULL DEFAULT '[]',
	nutrients JSONB NOT NULL DEFAULT '{}',
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. SPPG Batches (Batch Masak Dapur & Kontrol Suhu)
CREATE TABLE IF NOT EXISTS sppg_batches (
	id VARCHAR(64) PRIMARY KEY,
	sppg_id VARCHAR(64) REFERENCES sppg_kitchens(id) ON DELETE CASCADE,
	package_id VARCHAR(64) REFERENCES menu_packages(id) ON DELETE SET NULL,
	cooking_date DATE NOT NULL DEFAULT CURRENT_DATE,
	cooking_start VARCHAR(50) NOT NULL DEFAULT '',
	cooking_end VARCHAR(50) NOT NULL DEFAULT '',
	target_portions INT NOT NULL DEFAULT 0,
	actual_portions INT NOT NULL DEFAULT 0,
	core_temp_c DOUBLE PRECISION NOT NULL DEFAULT 0,
	cook_lead VARCHAR(150) NOT NULL DEFAULT '',
	qc_status VARCHAR(32) NOT NULL DEFAULT 'passed',
	haccp_status VARCHAR(32) NOT NULL DEFAULT 'safe',
	notes TEXT NOT NULL DEFAULT '',
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Deliveries (Telemetri Pengiriman & Hasil YOLOv8)
CREATE TABLE IF NOT EXISTS deliveries (
	id VARCHAR(64) PRIMARY KEY,
	batch_id VARCHAR(64) REFERENCES sppg_batches(id) ON DELETE SET NULL,
	sppg_id VARCHAR(64) REFERENCES sppg_kitchens(id) ON DELETE SET NULL,
	school_npsn VARCHAR(32) REFERENCES schools(npsn) ON DELETE CASCADE,
	validator_name VARCHAR(150) NOT NULL DEFAULT '',
	scanned_at VARCHAR(50) NOT NULL DEFAULT '',
	scan_date DATE NOT NULL DEFAULT CURRENT_DATE,
	portions INT NOT NULL DEFAULT 0,
	target_portions INT NOT NULL DEFAULT 0,
	temp_c DOUBLE PRECISION NOT NULL DEFAULT 0,
	temp_status VARCHAR(32) NOT NULL DEFAULT 'safe',
	qr_token VARCHAR(255) NOT NULL DEFAULT '',
	qr_status VARCHAR(32) NOT NULL DEFAULT 'verified',
	crypto_hash VARCHAR(255) NOT NULL DEFAULT '',
	menu_name VARCHAR(255) NOT NULL DEFAULT '',
	ai_verdict VARCHAR(32) NOT NULL DEFAULT 'layak',
	ai_score DOUBLE PRECISION NOT NULL DEFAULT 0,
	image_url TEXT NOT NULL DEFAULT '',
	status VARCHAR(64) NOT NULL DEFAULT 'Tiba Sesuai Jadwal',
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Schedules (Jadwal Rute & Armada Pengantaran)
CREATE TABLE IF NOT EXISTS schedules (
	id VARCHAR(64) PRIMARY KEY,
	sppg_id VARCHAR(64) REFERENCES sppg_kitchens(id) ON DELETE CASCADE,
	route_name VARCHAR(255) NOT NULL DEFAULT '',
	fleet_name VARCHAR(100) NOT NULL DEFAULT '',
	license_plate VARCHAR(50) NOT NULL DEFAULT '',
	driver_name VARCHAR(150) NOT NULL DEFAULT '',
	driver_phone VARCHAR(50) NOT NULL DEFAULT '',
	departure_time VARCHAR(50) NOT NULL DEFAULT '',
	arrival_eta VARCHAR(50) NOT NULL DEFAULT '',
	total_portions INT NOT NULL DEFAULT 0,
	status VARCHAR(50) NOT NULL DEFAULT 'on_time',
	target_schools JSONB NOT NULL DEFAULT '[]',
	telemetry JSONB NOT NULL DEFAULT '{}',
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Attendances (Rekonsiliasi Kehadiran Siswa & Porsi Tiba)
CREATE TABLE IF NOT EXISTS attendances (
	id VARCHAR(64) PRIMARY KEY,
	school_npsn VARCHAR(32) REFERENCES schools(npsn) ON DELETE CASCADE,
	date DATE NOT NULL DEFAULT CURRENT_DATE,
	registered_students INT NOT NULL DEFAULT 0,
	present_students INT NOT NULL DEFAULT 0,
	delivered_portions INT NOT NULL DEFAULT 0,
	consumed_portions INT NOT NULL DEFAULT 0,
	surplus_portions INT NOT NULL DEFAULT 0,
	surplus_status VARCHAR(64) NOT NULL DEFAULT 'available_for_redistribution',
	attendance_rate DOUBLE PRECISION NOT NULL DEFAULT 100,
	finish_rate DOUBLE PRECISION NOT NULL DEFAULT 100,
	reconciliation_status VARCHAR(64) NOT NULL DEFAULT 'surplus_safe',
	target_tomorrow_quota INT NOT NULL DEFAULT 0,
	absent_details JSONB NOT NULL DEFAULT '{"sick": 0, "permission": 0, "unexplained": 0}',
	consumption_eval JSONB NOT NULL DEFAULT '{"finishRate": 100, "riceWastePct": 0, "proteinWastePct": 0, "veggieWastePct": 0, "feedbackNotes": ""}',
	golden_window JSONB NOT NULL DEFAULT '{"cookedAt": "06:00 WIB", "deliveredAt": "07:00 WIB", "lunchTime": "09:30 WIB", "safeUntil": "10:30 WIB", "minutesLeft": 60, "isSafeToRedistribute": true}',
	discrepancy_count INT NOT NULL DEFAULT 0,
	head_validator VARCHAR(150) NOT NULL DEFAULT '',
	redistribution_log JSONB,
	notes TEXT NOT NULL DEFAULT '',
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. Notices (Papan Pengumuman & Edaran Darurat Satgas MBG)
CREATE TABLE IF NOT EXISTS notices (
	id VARCHAR(64) PRIMARY KEY,
	ref_number VARCHAR(100) NOT NULL DEFAULT '',
	title VARCHAR(255) NOT NULL,
	category VARCHAR(50) NOT NULL DEFAULT 'circular',
	urgency VARCHAR(32) NOT NULL DEFAULT 'info',
	target_audience VARCHAR(50) NOT NULL DEFAULT 'all',
	scope_region VARCHAR(150) NOT NULL DEFAULT 'Nasional',
	published_at VARCHAR(100) NOT NULL DEFAULT '',
	effective_date VARCHAR(100) NOT NULL DEFAULT '',
	author_name VARCHAR(150) NOT NULL DEFAULT '',
	author_role VARCHAR(150) NOT NULL DEFAULT '',
	content TEXT NOT NULL DEFAULT '',
	is_flash_alert BOOLEAN NOT NULL DEFAULT FALSE,
	requires_acknowledgement BOOLEAN NOT NULL DEFAULT FALSE,
	status VARCHAR(32) NOT NULL DEFAULT 'active',
	status_label VARCHAR(64) NOT NULL DEFAULT 'Tayang Publik',
	status_reason TEXT NOT NULL DEFAULT '',
	acknowledgement_stats JSONB NOT NULL DEFAULT '{"totalRecipients": 0, "acknowledgedCount": 0, "complianceRate": 0}',
	attachments JSONB NOT NULL DEFAULT '[]',
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE notices ADD COLUMN IF NOT EXISTS status VARCHAR(32) NOT NULL DEFAULT 'active';
ALTER TABLE notices ADD COLUMN IF NOT EXISTS category VARCHAR(50) NOT NULL DEFAULT 'circular';
ALTER TABLE notices ADD COLUMN IF NOT EXISTS urgency VARCHAR(32) NOT NULL DEFAULT 'info';
ALTER TABLE notices ADD COLUMN IF NOT EXISTS target_audience VARCHAR(50) NOT NULL DEFAULT 'all';
CREATE INDEX IF NOT EXISTS idx_notices_status ON notices(status);
CREATE INDEX IF NOT EXISTS idx_notices_category ON notices(category);
CREATE INDEX IF NOT EXISTS idx_notices_urgency ON notices(urgency);
CREATE INDEX IF NOT EXISTS idx_notices_target_audience ON notices(target_audience);

-- 11. Feedbacks (Pusat Aduan & Triage Insiden)
CREATE TABLE IF NOT EXISTS feedbacks (
	id VARCHAR(64) PRIMARY KEY,
	ticket_number VARCHAR(100) NOT NULL DEFAULT '',
	reported_at VARCHAR(100) NOT NULL DEFAULT '',
	school_npsn VARCHAR(32) REFERENCES schools(npsn) ON DELETE SET NULL,
	school_name VARCHAR(255) NOT NULL DEFAULT '',
	sppg_id VARCHAR(64) REFERENCES sppg_kitchens(id) ON DELETE SET NULL,
	batch_id VARCHAR(64) NOT NULL DEFAULT '',
	menu_package VARCHAR(255) NOT NULL DEFAULT '',
	severity VARCHAR(32) NOT NULL DEFAULT 'level3',
	anomaly_type VARCHAR(64) NOT NULL DEFAULT 'other',
	affected_portions INT NOT NULL DEFAULT 0,
	reporter_name VARCHAR(150) NOT NULL DEFAULT '',
	reporter_role VARCHAR(100) NOT NULL DEFAULT '',
	reporter_phone VARCHAR(50) NOT NULL DEFAULT '',
	title VARCHAR(255) NOT NULL,
	description TEXT NOT NULL DEFAULT '',
	status VARCHAR(32) NOT NULL DEFAULT 'open',
	is_kill_switch_executed BOOLEAN NOT NULL DEFAULT FALSE,
	evidence_photos JSONB NOT NULL DEFAULT '[]',
	kill_switch_details JSONB NOT NULL DEFAULT '{}',
	medical_escalation JSONB NOT NULL DEFAULT '{}',
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. Reports (Arsip Laporan BAST & Audit BGN)
CREATE TABLE IF NOT EXISTS reports (
	id VARCHAR(64) PRIMARY KEY,
	report_code VARCHAR(100) NOT NULL DEFAULT '',
	title VARCHAR(255) NOT NULL,
	period VARCHAR(100) NOT NULL DEFAULT '',
	category VARCHAR(100) NOT NULL DEFAULT '',
	author_name VARCHAR(150) NOT NULL DEFAULT '',
	status VARCHAR(50) NOT NULL DEFAULT 'verified',
	file_size VARCHAR(50) NOT NULL DEFAULT '',
	file_format VARCHAR(20) NOT NULL DEFAULT 'PDF',
	kpi_metrics JSONB NOT NULL DEFAULT '{}',
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. SPPG Billings (Klaim Invoice BAST ke BGN)
CREATE TABLE IF NOT EXISTS sppg_billings (
	id VARCHAR(64) PRIMARY KEY,
	sppg_id VARCHAR(64) REFERENCES sppg_kitchens(id) ON DELETE CASCADE,
	invoice_number VARCHAR(100) NOT NULL UNIQUE,
	period_label VARCHAR(100) NOT NULL DEFAULT '',
	total_portions INT NOT NULL DEFAULT 0,
	rate_per_portion INT NOT NULL DEFAULT 15000,
	total_amount BIGINT NOT NULL DEFAULT 0,
	status VARCHAR(50) NOT NULL DEFAULT 'pending',
	due_date VARCHAR(50) NOT NULL DEFAULT '',
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. SPPG Incidents (Log Kendala Teknis Dapur)
CREATE TABLE IF NOT EXISTS sppg_incidents (
	id VARCHAR(64) PRIMARY KEY,
	sppg_id VARCHAR(64) REFERENCES sppg_kitchens(id) ON DELETE CASCADE,
	title VARCHAR(255) NOT NULL,
	incident_type VARCHAR(100) NOT NULL DEFAULT '',
	severity VARCHAR(32) NOT NULL DEFAULT 'medium',
	occurred_at VARCHAR(100) NOT NULL DEFAULT '',
	description TEXT NOT NULL DEFAULT '',
	resolution TEXT NOT NULL DEFAULT '',
	status VARCHAR(32) NOT NULL DEFAULT 'resolved',
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 15. Validator Profiles (Kredensial & Audit Validator Sekolah)
CREATE TABLE IF NOT EXISTS validator_profiles (
	id VARCHAR(64) PRIMARY KEY,
	user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
	satgas_id VARCHAR(100) NOT NULL DEFAULT '',
	name VARCHAR(150) NOT NULL,
	nip VARCHAR(50) NOT NULL DEFAULT '',
	npsn VARCHAR(32) REFERENCES schools(npsn) ON DELETE CASCADE,
	role VARCHAR(100) NOT NULL DEFAULT '',
	device VARCHAR(100) NOT NULL DEFAULT '',
	device_id VARCHAR(100) NOT NULL DEFAULT '',
	certification VARCHAR(255) NOT NULL DEFAULT '',
	status VARCHAR(32) NOT NULL DEFAULT 'active',
	scans_today INT NOT NULL DEFAULT 0,
	quota_today INT NOT NULL DEFAULT 0,
	scan_logs JSONB NOT NULL DEFAULT '[]',
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Relasi dan Indeks Pendukung
-- Surat peringatan resmi BGN terhadap dapur SPPG (SP-1, SP-2, penangguhan).
-- Dipisah dari sppg_kitchens karena sebuah dapur bisa punya beberapa surat
-- dan setiap surat adalah dokumen dengan nomornya sendiri.
CREATE TABLE IF NOT EXISTS sppg_warning_letters (
	id             VARCHAR(64) PRIMARY KEY,
	sppg_id        VARCHAR(64) REFERENCES sppg_kitchens(id) ON DELETE CASCADE,
	letter_type    VARCHAR(32) NOT NULL CHECK (letter_type IN ('SP-1','SP-2','SUSPENSION')),
	letter_number  VARCHAR(100) NOT NULL,
	reason         TEXT NOT NULL DEFAULT '',
	deadline_label VARCHAR(100) NOT NULL DEFAULT '',
	status         VARCHAR(64) NOT NULL DEFAULT '',
	issued_by      VARCHAR(64) NOT NULL DEFAULT '',
	created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sppg_warning_letters_sppg ON sppg_warning_letters(sppg_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deliveries_sppg_scan_date ON deliveries(sppg_id, scan_date);

-- Status audit resep, penangguhan, dan perubahan kuota pada dapurnya.
ALTER TABLE sppg_kitchens ADD COLUMN IF NOT EXISTS tkpi_status VARCHAR(32) NOT NULL DEFAULT 'PENDING';
ALTER TABLE sppg_kitchens ADD COLUMN IF NOT EXISTS avg_deviation_pct DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE sppg_kitchens ADD COLUMN IF NOT EXISTS recipe_audited_at TIMESTAMPTZ;
ALTER TABLE sppg_kitchens ADD COLUMN IF NOT EXISTS recipe_auditor VARCHAR(150) NOT NULL DEFAULT '';
ALTER TABLE sppg_kitchens ADD COLUMN IF NOT EXISTS suspended_reason TEXT NOT NULL DEFAULT '';
ALTER TABLE sppg_kitchens ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;
ALTER TABLE sppg_kitchens ADD COLUMN IF NOT EXISTS quota_updated_at TIMESTAMPTZ;
ALTER TABLE sppg_kitchens ADD COLUMN IF NOT EXISTS quota_updated_by VARCHAR(64) NOT NULL DEFAULT '';

-- Kolom superadmin override AI dan audit uji petik laboratorium Dinkes untuk pengiriman MBG
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS override_by VARCHAR(150) NOT NULL DEFAULT '';
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS override_reason TEXT NOT NULL DEFAULT '';
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS overridden_at TIMESTAMPTZ;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS lab_target VARCHAR(150) NOT NULL DEFAULT '';
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS lab_notes TEXT NOT NULL DEFAULT '';
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS lab_ordered_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_schools_sppg ON schools(sppg_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_school ON deliveries(school_npsn);
CREATE INDEX IF NOT EXISTS idx_deliveries_batch ON deliveries(batch_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_sppg ON deliveries(sppg_id);
CREATE INDEX IF NOT EXISTS idx_attendances_school ON attendances(school_npsn);
CREATE INDEX IF NOT EXISTS idx_feedbacks_school ON feedbacks(school_npsn);
CREATE INDEX IF NOT EXISTS idx_feedbacks_sppg ON feedbacks(sppg_id);
CREATE INDEX IF NOT EXISTS idx_schedules_sppg ON schedules(sppg_id);
CREATE INDEX IF NOT EXISTS idx_sppg_batches_sppg ON sppg_batches(sppg_id);
CREATE INDEX IF NOT EXISTS idx_sppg_billings_sppg ON sppg_billings(sppg_id);
CREATE INDEX IF NOT EXISTS idx_validator_profiles_npsn ON validator_profiles(npsn);

-- Kolom tambahan untuk audit hasil pindai & batch penugasan validator.
-- CREATE TABLE di atas hanya berlaku untuk database baru; ADD COLUMN IF NOT EXISTS
-- menambal database yang sudah termigrasi sebelumnya.
ALTER TABLE scan_logs            ADD COLUMN IF NOT EXISTS duration_ms INT;
ALTER TABLE scan_logs            ADD COLUMN IF NOT EXISTS school_npsn VARCHAR(32) DEFAULT '';
ALTER TABLE scan_logs            ADD COLUMN IF NOT EXISTS sppg_id VARCHAR(64) DEFAULT '';
ALTER TABLE scan_logs            ADD COLUMN IF NOT EXISTS menu_name TEXT NOT NULL DEFAULT '';
ALTER TABLE scan_logs            ADD COLUMN IF NOT EXISTS menu_class TEXT NOT NULL DEFAULT '';
ALTER TABLE scan_logs            ADD COLUMN IF NOT EXISTS menu_display TEXT NOT NULL DEFAULT '';
ALTER TABLE scan_logs            ADD COLUMN IF NOT EXISTS menu_confidence DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE validator_profiles   ADD COLUMN IF NOT EXISTS backup_validator_id VARCHAR(64) REFERENCES validator_profiles(id) ON DELETE SET NULL;
ALTER TABLE validator_profiles   ADD COLUMN IF NOT EXISTS warning_count INT NOT NULL DEFAULT 0;
ALTER TABLE validator_profiles   ADD COLUMN IF NOT EXISTS last_warning_at TIMESTAMPTZ;
ALTER TABLE validator_profiles   ADD COLUMN IF NOT EXISTS last_warning_note TEXT NOT NULL DEFAULT '';

-- Kolom profil sekolah yang dipakai repository sekolah (SELECT & INSERT) tetapi belum
-- ada pada database yang dibuat sebelum schema ini diperluas.
ALTER TABLE schools              ADD COLUMN IF NOT EXISTS demographics JSONB NOT NULL DEFAULT '{}';
ALTER TABLE schools              ADD COLUMN IF NOT EXISTS emergency_contacts JSONB NOT NULL DEFAULT '{}';
ALTER TABLE schools              ADD COLUMN IF NOT EXISTS transit_details JSONB NOT NULL DEFAULT '{}';
ALTER TABLE schools              ADD COLUMN IF NOT EXISTS last_audit_date VARCHAR(50) NOT NULL DEFAULT '26 Sep 2026';

-- Kolom jadwal distribusi operasional MBG & cold-chain
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'on_time';
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS school_id VARCHAR(64) DEFAULT '';
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS school_name VARCHAR(255) DEFAULT '';
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS npsn VARCHAR(50) DEFAULT '';
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS city VARCHAR(100) DEFAULT '';
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS portions INT DEFAULT 0;
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS status_label VARCHAR(100) DEFAULT '';
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS status_reason TEXT DEFAULT '';
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS corridor_name VARCHAR(255) DEFAULT '';
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS distance_remaining_km NUMERIC(5,2) DEFAULT 0.0;
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS timestamps JSONB NOT NULL DEFAULT '{}';
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS fleet JSONB NOT NULL DEFAULT '{}';
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS validator_contact JSONB NOT NULL DEFAULT '{}';
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Kolom pelindung untuk notices dan reports jika tabel sudah ada sebelumnya
ALTER TABLE notices ADD COLUMN IF NOT EXISTS status VARCHAR(32) NOT NULL DEFAULT 'active';
ALTER TABLE reports ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'verified';
ALTER TABLE reports ADD COLUMN IF NOT EXISTS category VARCHAR(100) NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_schedules_city ON schedules(city);
CREATE INDEX IF NOT EXISTS idx_schedules_status ON schedules(status);
CREATE INDEX IF NOT EXISTS idx_schedules_npsn ON schedules(npsn);

-- Kolom Kalender Operasional MBG & Siklus Menu Nasional
ALTER TABLE calendar_days ADD COLUMN IF NOT EXISTS day_number INT NOT NULL DEFAULT 1;
ALTER TABLE calendar_days ADD COLUMN IF NOT EXISTS month_year VARCHAR(50) NOT NULL DEFAULT 'Oktober 2026';
ALTER TABLE calendar_days ADD COLUMN IF NOT EXISTS day_type_label VARCHAR(100) NOT NULL DEFAULT 'Hari Operasional Reguler';
ALTER TABLE calendar_days ADD COLUMN IF NOT EXISTS title VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE calendar_days ADD COLUMN IF NOT EXISTS menu_status VARCHAR(32) NOT NULL DEFAULT 'locked';
ALTER TABLE calendar_days ADD COLUMN IF NOT EXISTS menu_status_label VARCHAR(100) NOT NULL DEFAULT 'Menu Terkunci & Valid';
ALTER TABLE calendar_days ADD COLUMN IF NOT EXISTS is_operational_blackout BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE calendar_days ADD COLUMN IF NOT EXISTS blackout_reason TEXT;
ALTER TABLE calendar_days ADD COLUMN IF NOT EXISTS active_kitchens INT NOT NULL DEFAULT 180;
ALTER TABLE calendar_days ADD COLUMN IF NOT EXISTS has_inspection BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE calendar_days ADD COLUMN IF NOT EXISTS inspection_detail JSONB;
ALTER TABLE calendar_days ADD COLUMN IF NOT EXISTS has_substitution BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE calendar_days ADD COLUMN IF NOT EXISTS substitution_id VARCHAR(64);
ALTER TABLE calendar_days ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS menu_substitutions (
	id VARCHAR(64) PRIMARY KEY,
	date DATE NOT NULL,
	cycle_code VARCHAR(32) NOT NULL,
	region VARCHAR(255) NOT NULL,
	original_ingredient TEXT NOT NULL,
	substitute_ingredient TEXT NOT NULL,
	reason TEXT NOT NULL,
	nutrition_comparison JSONB NOT NULL DEFAULT '{}',
	nutritionist_review TEXT NOT NULL DEFAULT '',
	status VARCHAR(32) NOT NULL DEFAULT 'pending',
	status_label VARCHAR(100) NOT NULL DEFAULT 'Menunggu Otorisasi Superadmin',
	approved_at VARCHAR(100),
	approved_by VARCHAR(150),
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calendar_days_date ON calendar_days(date);
CREATE INDEX IF NOT EXISTS idx_calendar_days_month_year ON calendar_days(month_year);
CREATE INDEX IF NOT EXISTS idx_calendar_days_day_type ON calendar_days(day_type);
CREATE INDEX IF NOT EXISTS idx_calendar_days_menu_status ON calendar_days(menu_status);
ALTER TABLE menu_substitutions ADD COLUMN IF NOT EXISTS status VARCHAR(32) NOT NULL DEFAULT 'pending';
CREATE INDEX IF NOT EXISTS idx_menu_substitutions_date ON menu_substitutions(date);
CREATE INDEX IF NOT EXISTS idx_menu_substitutions_status ON menu_substitutions(status);

-- Kolom Ekstensi Katalog Dokumen Laporan Resmi MBG
ALTER TABLE reports ADD COLUMN IF NOT EXISTS scope VARCHAR(255) NOT NULL DEFAULT '38 Provinsi (514 Kab/Kota)';
ALTER TABLE reports ADD COLUMN IF NOT EXISTS total_portions INT NOT NULL DEFAULT 250000;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS success_rate NUMERIC(5,2) NOT NULL DEFAULT 99.4;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS file_formats JSONB NOT NULL DEFAULT '["PDF","XLSX","CSV"]'::jsonb;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS file_size_pdf VARCHAR(50) NOT NULL DEFAULT '3.4 MB';
ALTER TABLE reports ADD COLUMN IF NOT EXISTS file_size_xlsx VARCHAR(50) NOT NULL DEFAULT '1.8 MB';
ALTER TABLE reports ADD COLUMN IF NOT EXISTS file_size_csv VARCHAR(50) NOT NULL DEFAULT '620 KB';
ALTER TABLE reports ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
ALTER TABLE reports ADD COLUMN IF NOT EXISTS signee VARCHAR(255) NOT NULL DEFAULT 'Satgas MBG Pusat & BGN';
ALTER TABLE reports ADD COLUMN IF NOT EXISTS audit_badge VARCHAR(100) NOT NULL DEFAULT 'BPK Ready';

-- Berkas Berita Acara Serah Terima Digital (BAST Digital)
CREATE TABLE IF NOT EXISTS digital_basts (
	id VARCHAR(64) PRIMARY KEY,
	ref_number VARCHAR(100) NOT NULL UNIQUE,
	date VARCHAR(50) NOT NULL,
	delivery_time VARCHAR(50) NOT NULL DEFAULT '',
	school_name VARCHAR(255) NOT NULL,
	npsn VARCHAR(50) NOT NULL,
	sppg_name VARCHAR(255) NOT NULL,
	sppg_id VARCHAR(64) NOT NULL,
	menu_package VARCHAR(255) NOT NULL,
	ordered_portions INT NOT NULL DEFAULT 0,
	verified_ai_portions INT NOT NULL DEFAULT 0,
	rejected_portions INT NOT NULL DEFAULT 0,
	thermal_temp_arrive VARCHAR(100) NOT NULL DEFAULT '',
	lead_validator VARCHAR(255) NOT NULL DEFAULT '',
	driver_name VARCHAR(255) NOT NULL DEFAULT '',
	sha256_hash VARCHAR(100) NOT NULL DEFAULT '',
	qr_token_verified BOOLEAN NOT NULL DEFAULT true,
	bsre_status VARCHAR(100) NOT NULL DEFAULT 'Simulasi: stempel tidak diverifikasi',
	payment_clearance_status VARCHAR(50) NOT NULL DEFAULT 'cleared',
	payment_clearance_label VARCHAR(100) NOT NULL DEFAULT 'Disetujui Cair (100% Valid)',
	subtotal_amount BIGINT NOT NULL DEFAULT 0,
	approval_notes TEXT NOT NULL DEFAULT '',
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Rekapitulasi Tagihan Katering & Payment Clearance (Otorisasi SP2D)
CREATE TABLE IF NOT EXISTS vendor_invoices (
	id VARCHAR(64) PRIMARY KEY,
	invoice_number VARCHAR(100) NOT NULL UNIQUE,
	sppg_name VARCHAR(255) NOT NULL,
	sppg_id VARCHAR(64) NOT NULL,
	vendor_company VARCHAR(255) NOT NULL,
	bank_account VARCHAR(255) NOT NULL,
	period VARCHAR(100) NOT NULL,
	total_claimed_portions INT NOT NULL DEFAULT 0,
	total_claimed_amount BIGINT NOT NULL DEFAULT 0,
	verified_bast_portions INT NOT NULL DEFAULT 0,
	rejected_deduction_portions INT NOT NULL DEFAULT 0,
	penalty_deduction_amount BIGINT NOT NULL DEFAULT 0,
	approved_payment_amount BIGINT NOT NULL DEFAULT 0,
	bast_completeness_rate NUMERIC(5,2) NOT NULL DEFAULT 100.0,
	status VARCHAR(50) NOT NULL DEFAULT 'ready_to_sign',
	status_label VARCHAR(100) NOT NULL DEFAULT 'Siap Otorisasi Superadmin',
	sp2d_number VARCHAR(100),
	notes TEXT NOT NULL DEFAULT '',
	signed_at VARCHAR(100),
	signed_by VARCHAR(255),
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Temuan Audit Forensik Anggaran (Forensic Audit Discrepancy Findings)
CREATE TABLE IF NOT EXISTS forensic_audit_findings (
	id VARCHAR(64) PRIMARY KEY,
	invoice_ref VARCHAR(100) NOT NULL,
	sppg_name VARCHAR(255) NOT NULL,
	date_logged VARCHAR(100) NOT NULL,
	finding_type VARCHAR(100) NOT NULL,
	finding_type_label VARCHAR(255) NOT NULL,
	claimed_portions INT NOT NULL DEFAULT 0,
	ai_valid_portions INT NOT NULL DEFAULT 0,
	discrepancy_count INT NOT NULL DEFAULT 0,
	potential_loss_amount BIGINT NOT NULL DEFAULT 0,
	severity VARCHAR(50) NOT NULL DEFAULT 'warning',
	severity_label VARCHAR(100) NOT NULL DEFAULT '',
	explanation TEXT NOT NULL DEFAULT '',
	action_taken TEXT NOT NULL DEFAULT '',
	status VARCHAR(50) NOT NULL DEFAULT 'safeguarded',
	status_label VARCHAR(100) NOT NULL DEFAULT 'Anggaran Terselamatkan',
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_category ON reports(category);
CREATE INDEX IF NOT EXISTS idx_digital_basts_date ON digital_basts(date);
CREATE INDEX IF NOT EXISTS idx_digital_basts_npsn ON digital_basts(npsn);
ALTER TABLE vendor_invoices ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'ready_to_sign';
ALTER TABLE forensic_audit_findings ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'safeguarded';
CREATE INDEX IF NOT EXISTS idx_vendor_invoices_status ON vendor_invoices(status);
CREATE INDEX IF NOT EXISTS idx_forensic_findings_status ON forensic_audit_findings(status);

-- ============================================================================
-- SPPG RECIPES & MULTI-TENANT KITCHEN SPACE
-- ============================================================================

-- 1. Resep & Paket Menu SPPG (Mendukung Multi-Tenant & Template Nasional BGN)
CREATE TABLE IF NOT EXISTS sppg_menu_packages (
	id VARCHAR(64) PRIMARY KEY,
	sppg_id VARCHAR(64) REFERENCES sppg_kitchens(id) ON DELETE CASCADE, -- NULL jika Template Nasional BGN
	code VARCHAR(50) NOT NULL,
	name VARCHAR(255) NOT NULL,
	tagline VARCHAR(255) NOT NULL DEFAULT '',
	day_name VARCHAR(100) NOT NULL DEFAULT '',
	cycle VARCHAR(100) NOT NULL DEFAULT 'Siklus Menu Nasional Minggu I',
	description TEXT NOT NULL DEFAULT '',
	allergens JSONB NOT NULL DEFAULT '[]',
	haccp_point TEXT NOT NULL DEFAULT '',
	serving_temp_standard TEXT NOT NULL DEFAULT '',
	calories DOUBLE PRECISION NOT NULL DEFAULT 0,
	protein DOUBLE PRECISION NOT NULL DEFAULT 0,
	carbs DOUBLE PRECISION NOT NULL DEFAULT 0,
	fat DOUBLE PRECISION NOT NULL DEFAULT 0,
	fiber DOUBLE PRECISION NOT NULL DEFAULT 0,
	iron DOUBLE PRECISION NOT NULL DEFAULT 0,
	calcium DOUBLE PRECISION NOT NULL DEFAULT 0,
	ingredients JSONB NOT NULL DEFAULT '[]',
	is_national BOOLEAN NOT NULL DEFAULT false,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sppg_menu_packages_sppg ON sppg_menu_packages(sppg_id);
CREATE INDEX IF NOT EXISTS idx_sppg_menu_packages_national ON sppg_menu_packages(is_national);

-- 2. State Operasional Harian Resep per-SPPG
CREATE TABLE IF NOT EXISTS sppg_recipe_daily_states (
	sppg_id VARCHAR(64) NOT NULL REFERENCES sppg_kitchens(id) ON DELETE CASCADE,
	date DATE NOT NULL DEFAULT CURRENT_DATE,
	selected_package_id VARCHAR(64) NOT NULL,
	active_cohort VARCHAR(32) NOT NULL DEFAULT 'sd_atas',
	portion_count INT NOT NULL DEFAULT 2500,
	is_locked BOOLEAN NOT NULL DEFAULT false,
	locked_at TIMESTAMPTZ,
	locked_by VARCHAR(150),
	verified_by VARCHAR(255) NOT NULL DEFAULT 'Satgas MBG Wilayah Pusat',
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	PRIMARY KEY (sppg_id, date)
);

-- 3. Log Penelusuran Batch Bahan Baku per Gudang Dapur
CREATE TABLE IF NOT EXISTS sppg_ingredient_batches (
	id VARCHAR(64) PRIMARY KEY,
	sppg_id VARCHAR(64) NOT NULL REFERENCES sppg_kitchens(id) ON DELETE CASCADE,
	commodity VARCHAR(150) NOT NULL,
	batch_no VARCHAR(100) NOT NULL,
	supplier VARCHAR(255) NOT NULL,
	nkv_number VARCHAR(100) NOT NULL DEFAULT '',
	halal_cert_no VARCHAR(100) NOT NULL DEFAULT '',
	incoming_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	expiry_date VARCHAR(100) NOT NULL,
	storage_temp VARCHAR(100) NOT NULL DEFAULT '',
	qc_inspector VARCHAR(150) NOT NULL DEFAULT '',
	qc_result TEXT NOT NULL DEFAULT '',
	qc_status VARCHAR(32) NOT NULL DEFAULT 'VERIFIED',
	quantity_received VARCHAR(100) NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sppg_ing_batches_sppg ON sppg_ingredient_batches(sppg_id);

-- 4. Penguatan relasi menu_substitutions dengan sppg_id
ALTER TABLE menu_substitutions ADD COLUMN IF NOT EXISTS sppg_id VARCHAR(64) REFERENCES sppg_kitchens(id) ON DELETE CASCADE;
ALTER TABLE menu_substitutions ADD COLUMN IF NOT EXISTS menu_code VARCHAR(50) NOT NULL DEFAULT '';
ALTER TABLE menu_substitutions ADD COLUMN IF NOT EXISTS evidence_photo_url TEXT NOT NULL DEFAULT '';
ALTER TABLE menu_substitutions ADD COLUMN IF NOT EXISTS evidence_file_name VARCHAR(255) NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_menu_substitutions_sppg ON menu_substitutions(sppg_id);

-- 5. Penguatan tabel sppg_batches untuk modul Batch & Label QR
ALTER TABLE sppg_batches ADD COLUMN IF NOT EXISTS token VARCHAR(120) NOT NULL DEFAULT '';
ALTER TABLE sppg_batches ADD COLUMN IF NOT EXISTS seq INT NOT NULL DEFAULT 1;
ALTER TABLE sppg_batches ADD COLUMN IF NOT EXISTS school_id VARCHAR(64) NOT NULL DEFAULT '';
ALTER TABLE sppg_batches ADD COLUMN IF NOT EXISTS school_code VARCHAR(32) NOT NULL DEFAULT '';
ALTER TABLE sppg_batches ADD COLUMN IF NOT EXISTS school_name VARCHAR(150) NOT NULL DEFAULT '';
ALTER TABLE sppg_batches ADD COLUMN IF NOT EXISTS menu_code VARCHAR(50) NOT NULL DEFAULT '';
ALTER TABLE sppg_batches ADD COLUMN IF NOT EXISTS menu_name VARCHAR(200) NOT NULL DEFAULT '';
ALTER TABLE sppg_batches ADD COLUMN IF NOT EXISTS box_count INT NOT NULL DEFAULT 0;
ALTER TABLE sppg_batches ADD COLUMN IF NOT EXISTS cooked_at VARCHAR(20) NOT NULL DEFAULT '';
ALTER TABLE sppg_batches ADD COLUMN IF NOT EXISTS consume_by VARCHAR(20) NOT NULL DEFAULT '';
ALTER TABLE sppg_batches ADD COLUMN IF NOT EXISTS cook_temp DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE sppg_batches ADD COLUMN IF NOT EXISTS allergens JSONB NOT NULL DEFAULT '[]';
ALTER TABLE sppg_batches ADD COLUMN IF NOT EXISTS status VARCHAR(32) NOT NULL DEFAULT 'draft';
ALTER TABLE sppg_batches ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE sppg_batches ADD COLUMN IF NOT EXISTS checksum VARCHAR(128) NOT NULL DEFAULT '';
ALTER TABLE sppg_batches ADD COLUMN IF NOT EXISTS quarantine_reason TEXT NOT NULL DEFAULT '';
ALTER TABLE sppg_batches ADD COLUMN IF NOT EXISTS quarantined_by VARCHAR(150) NOT NULL DEFAULT '';
ALTER TABLE sppg_batches ADD COLUMN IF NOT EXISTS quarantined_at TIMESTAMPTZ;
ALTER TABLE sppg_batches ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_sppg_batches_token ON sppg_batches(token);
CREATE INDEX IF NOT EXISTS idx_sppg_batches_date ON sppg_batches(cooking_date);
CREATE INDEX IF NOT EXISTS idx_sppg_batches_status ON sppg_batches(status);

-- 6. Tabel Kontrol Mutu HACCP & Uji Sensori SPPG
CREATE TABLE IF NOT EXISTS sppg_quality_temp_logs (
	id VARCHAR(64) PRIMARY KEY,
	sppg_id VARCHAR(64) REFERENCES sppg_kitchens(id) ON DELETE CASCADE,
	point_id VARCHAR(32) NOT NULL,
	batch_token VARCHAR(120) NOT NULL,
	value DOUBLE PRECISION NOT NULL,
	hold_minutes INT NOT NULL DEFAULT 0,
	measured_at VARCHAR(20) NOT NULL,
	measured_by VARCHAR(150) NOT NULL,
	evidence_name VARCHAR(255) NOT NULL DEFAULT 'tanpa foto',
	pass BOOLEAN NOT NULL DEFAULT true,
	verdict VARCHAR(32) NOT NULL DEFAULT 'LOLOS',
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sppg_quality_temp_sppg ON sppg_quality_temp_logs(sppg_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sppg_quality_temp_token ON sppg_quality_temp_logs(batch_token);

CREATE TABLE IF NOT EXISTS sppg_quality_signoffs (
	id VARCHAR(64) PRIMARY KEY,
	sppg_id VARCHAR(64) REFERENCES sppg_kitchens(id) ON DELETE CASCADE,
	batch_token VARCHAR(120) NOT NULL,
	aspects JSONB NOT NULL DEFAULT '{}',
	note TEXT NOT NULL DEFAULT '',
	signer VARCHAR(150) NOT NULL,
	signed_at VARCHAR(50) NOT NULL,
	layak BOOLEAN NOT NULL DEFAULT true,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sppg_quality_signoffs_sppg ON sppg_quality_signoffs(sppg_id, created_at DESC);

CREATE TABLE IF NOT EXISTS sppg_quality_samples (
	id VARCHAR(64) PRIMARY KEY,
	sppg_id VARCHAR(64) REFERENCES sppg_kitchens(id) ON DELETE CASCADE,
	batch_token VARCHAR(120) NOT NULL,
	rack_no VARCHAR(32) NOT NULL,
	stored_at VARCHAR(50) NOT NULL,
	stored_by VARCHAR(150) NOT NULL,
	status VARCHAR(32) NOT NULL DEFAULT 'tersimpan',
	destroyed_at TIMESTAMPTZ,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sppg_quality_samples_sppg ON sppg_quality_samples(sppg_id, created_at DESC);

-- 7. Tabel Logistik Rute & Armada SPPG
CREATE TABLE IF NOT EXISTS sppg_fleets (
	id VARCHAR(64) PRIMARY KEY,
	sppg_id VARCHAR(64) NOT NULL REFERENCES sppg_kitchens(id) ON DELETE CASCADE,
	plate VARCHAR(32) NOT NULL,
	vehicle_type VARCHAR(100) NOT NULL,
	driver_name VARCHAR(150) NOT NULL,
	driver_phone VARCHAR(50) NOT NULL DEFAULT '',
	emergency_phone VARCHAR(50) NOT NULL DEFAULT '',
	school_id VARCHAR(64) NOT NULL DEFAULT '',
	school_name VARCHAR(255) NOT NULL DEFAULT '',
	school_lat DOUBLE PRECISION NOT NULL DEFAULT 0,
	school_lng DOUBLE PRECISION NOT NULL DEFAULT 0,
	batch_token VARCHAR(120) NOT NULL DEFAULT '',
	box_count INT NOT NULL DEFAULT 0,
	distance_km DOUBLE PRECISION NOT NULL DEFAULT 0,
	speed_kph INT NOT NULL DEFAULT 0,
	depart_at VARCHAR(20) NOT NULL DEFAULT '',
	progress DOUBLE PRECISION NOT NULL DEFAULT 0,
	status VARCHAR(32) NOT NULL DEFAULT 'jalan',
	box_temp_c DOUBLE PRECISION NOT NULL DEFAULT 63.5,
	is_backup BOOLEAN NOT NULL DEFAULT FALSE,
	current_lat DOUBLE PRECISION NOT NULL DEFAULT 0,
	current_lng DOUBLE PRECISION NOT NULL DEFAULT 0,
	temp_series JSONB NOT NULL DEFAULT '[]',
	dispatched_at TIMESTAMPTZ,
	dispatched_by VARCHAR(150) NOT NULL DEFAULT '',
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sppg_fleets_sppg ON sppg_fleets(sppg_id);
CREATE INDEX IF NOT EXISTS idx_sppg_fleets_status ON sppg_fleets(status);

CREATE TABLE IF NOT EXISTS sppg_delivery_notifications (
	id VARCHAR(64) PRIMARY KEY,
	sppg_id VARCHAR(64) NOT NULL REFERENCES sppg_kitchens(id) ON DELETE CASCADE,
	fleet_id VARCHAR(64) NOT NULL REFERENCES sppg_fleets(id) ON DELETE CASCADE,
	school_id VARCHAR(64) NOT NULL DEFAULT '',
	school_name VARCHAR(255) NOT NULL,
	recipient_phone VARCHAR(50) NOT NULL DEFAULT '',
	message TEXT NOT NULL,
	sent_by VARCHAR(150) NOT NULL,
	sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sppg_deliv_notif_sppg ON sppg_delivery_notifications(sppg_id);

CREATE TABLE IF NOT EXISTS sppg_school_quotas (
	id VARCHAR(64) PRIMARY KEY,
	sppg_id VARCHAR(64) NOT NULL REFERENCES sppg_kitchens(id) ON DELETE CASCADE,
	school_id VARCHAR(64) NOT NULL,
	npsn VARCHAR(32) NOT NULL,
	school_name VARCHAR(255) NOT NULL,
	address TEXT NOT NULL DEFAULT '',
	level VARCHAR(64) NOT NULL DEFAULT 'SD',
	lat DOUBLE PRECISION NOT NULL DEFAULT 0,
	lng DOUBLE PRECISION NOT NULL DEFAULT 0,
	enrolled INT NOT NULL DEFAULT 0,
	present INT NOT NULL DEFAULT 0,
	reduce_special INT NOT NULL DEFAULT 0,
	absence_note TEXT NOT NULL DEFAULT '',
	present_updated_at VARCHAR(10) NOT NULL DEFAULT '',
	specials JSONB NOT NULL DEFAULT '[]'::jsonb,
	principal_name VARCHAR(150) NOT NULL DEFAULT '',
	validator_name VARCHAR(150) NOT NULL DEFAULT '',
	validator_phone VARCHAR(50) NOT NULL DEFAULT '',
	droppoint TEXT NOT NULL DEFAULT '',
	fleet_assigned VARCHAR(64) NOT NULL DEFAULT '',
	date DATE NOT NULL DEFAULT CURRENT_DATE,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sppg_school_quotas_sppg ON sppg_school_quotas(sppg_id);
CREATE INDEX IF NOT EXISTS idx_sppg_school_quotas_npsn ON sppg_school_quotas(npsn);
CREATE INDEX IF NOT EXISTS idx_sppg_school_quotas_date ON sppg_school_quotas(date);

CREATE TABLE IF NOT EXISTS sppg_handovers (
	id VARCHAR(64) PRIMARY KEY,
	sppg_id VARCHAR(64) NOT NULL REFERENCES sppg_kitchens(id) ON DELETE CASCADE,
	school_id VARCHAR(64) NOT NULL,
	school_npsn VARCHAR(32) NOT NULL,
	school_name VARCHAR(255) NOT NULL,
	batch_token VARCHAR(100) NOT NULL,
	sent INT NOT NULL DEFAULT 0,
	scanned INT NOT NULL DEFAULT 0,
	stage VARCHAR(32) NOT NULL DEFAULT 'menunggu',
	rejected JSONB NOT NULL DEFAULT '[]'::jsonb,
	courier_sign VARCHAR(150) NOT NULL DEFAULT '',
	teacher_sign VARCHAR(150) NOT NULL DEFAULT '',
	bast_no VARCHAR(100) NOT NULL DEFAULT '',
	bast_at VARCHAR(20) NOT NULL DEFAULT '',
	bast_hash VARCHAR(255) NOT NULL DEFAULT '',
	date DATE NOT NULL DEFAULT CURRENT_DATE,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sppg_handovers_sppg ON sppg_handovers(sppg_id);
CREATE INDEX IF NOT EXISTS idx_sppg_handovers_date ON sppg_handovers(date);
CREATE INDEX IF NOT EXISTS idx_sppg_handovers_stage ON sppg_handovers(stage);

CREATE TABLE IF NOT EXISTS sppg_handover_settings (
	sppg_id VARCHAR(64) PRIMARY KEY REFERENCES sppg_kitchens(id) ON DELETE CASCADE,
	safety_stock INT NOT NULL DEFAULT 40,
	bast_seq INT NOT NULL DEFAULT 1,
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Modul Insiden & Respon Aduan SPPG (SPPG.md Bab 8)
CREATE TABLE IF NOT EXISTS sppg_incident_tickets (
	id VARCHAR(64) PRIMARY KEY,
	sppg_id VARCHAR(64) NOT NULL REFERENCES sppg_kitchens(id) ON DELETE CASCADE,
	school_id VARCHAR(64) NOT NULL DEFAULT '',
	school_name VARCHAR(255) NOT NULL,
	batch_token VARCHAR(100) NOT NULL,
	level INT NOT NULL DEFAULT 1,
	category VARCHAR(100) NOT NULL,
	message TEXT NOT NULL,
	created_at_clock VARCHAR(20) NOT NULL DEFAULT '07:00',
	status VARCHAR(32) NOT NULL DEFAULT 'baru',
	responses JSONB NOT NULL DEFAULT '[]'::jsonb,
	resolution TEXT NOT NULL DEFAULT '',
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sppg_inc_tickets_sppg ON sppg_incident_tickets(sppg_id);
CREATE INDEX IF NOT EXISTS idx_sppg_inc_tickets_status ON sppg_incident_tickets(status);
CREATE INDEX IF NOT EXISTS idx_sppg_inc_tickets_token ON sppg_incident_tickets(batch_token);

CREATE TABLE IF NOT EXISTS sppg_incident_recalls (
	id VARCHAR(64) PRIMARY KEY,
	sppg_id VARCHAR(64) NOT NULL REFERENCES sppg_kitchens(id) ON DELETE CASCADE,
	batch_token VARCHAR(100) NOT NULL,
	reason TEXT NOT NULL DEFAULT '',
	recalled_by VARCHAR(150) NOT NULL DEFAULT '',
	recalled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	status VARCHAR(32) NOT NULL DEFAULT 'active'
);
CREATE INDEX IF NOT EXISTS idx_sppg_inc_recalls_sppg ON sppg_incident_recalls(sppg_id);
CREATE INDEX IF NOT EXISTS idx_sppg_inc_recalls_token ON sppg_incident_recalls(batch_token);

-- 9. Modul Klaim & Penagihan Invoice SPPG (SPPG.md Bab 9)
CREATE TABLE IF NOT EXISTS sppg_invoices (
	id VARCHAR(64) PRIMARY KEY,
	sppg_id VARCHAR(64) NOT NULL REFERENCES sppg_kitchens(id) ON DELETE CASCADE,
	invoice_no VARCHAR(100) NOT NULL,
	period_label VARCHAR(100) NOT NULL DEFAULT '',
	stage VARCHAR(32) NOT NULL DEFAULT 'draft',
	notes JSONB NOT NULL DEFAULT '[]'::jsonb,
	tax_slip VARCHAR(255) NOT NULL DEFAULT '',
	sp2d_number VARCHAR(100) NOT NULL DEFAULT '',
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sppg_invoices_sppg ON sppg_invoices(sppg_id);
CREATE INDEX IF NOT EXISTS idx_sppg_invoices_stage ON sppg_invoices(stage);

CREATE TABLE IF NOT EXISTS sppg_billing_rows (
	id VARCHAR(64) PRIMARY KEY,
	sppg_id VARCHAR(64) NOT NULL REFERENCES sppg_kitchens(id) ON DELETE CASCADE,
	school_id VARCHAR(64) NOT NULL DEFAULT '',
	school_name VARCHAR(255) NOT NULL,
	bast_no VARCHAR(100) NOT NULL DEFAULT '',
	batch_token VARCHAR(100) NOT NULL,
	valid_portions INT NOT NULL DEFAULT 0,
	late_minutes INT NOT NULL DEFAULT 0,
	invoice_id VARCHAR(64) REFERENCES sppg_invoices(id) ON DELETE SET NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sppg_billing_rows_sppg ON sppg_billing_rows(sppg_id);
CREATE INDEX IF NOT EXISTS idx_sppg_billing_rows_invoice ON sppg_billing_rows(invoice_id);

CREATE TABLE IF NOT EXISTS sppg_billing_settings (
	sppg_id VARCHAR(64) PRIMARY KEY REFERENCES sppg_kitchens(id) ON DELETE CASCADE,
	rate_per_portion INT NOT NULL DEFAULT 15000,
	late_tolerance_minutes INT NOT NULL DEFAULT 30,
	late_penalty_pct INT NOT NULL DEFAULT 5,
	inv_seq INT NOT NULL DEFAULT 2,
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. Modul Sertifikasi & Sanitasi Dapur SPPG (SPPG.md Bab 10)
CREATE TABLE IF NOT EXISTS sppg_compliance_docs (
	id VARCHAR(64) PRIMARY KEY,
	sppg_id VARCHAR(64) NOT NULL REFERENCES sppg_kitchens(id) ON DELETE CASCADE,
	name VARCHAR(255) NOT NULL,
	issuer VARCHAR(255) NOT NULL DEFAULT '',
	number VARCHAR(100) NOT NULL DEFAULT '',
	expiry DATE NOT NULL,
	file_name VARCHAR(255) NOT NULL DEFAULT '',
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sppg_compliance_docs_sppg ON sppg_compliance_docs(sppg_id);
CREATE INDEX IF NOT EXISTS idx_sppg_compliance_docs_expiry ON sppg_compliance_docs(expiry);

CREATE TABLE IF NOT EXISTS sppg_compliance_handlers (
	id VARCHAR(64) PRIMARY KEY,
	sppg_id VARCHAR(64) NOT NULL REFERENCES sppg_kitchens(id) ON DELETE CASCADE,
	name VARCHAR(255) NOT NULL,
	role VARCHAR(100) NOT NULL DEFAULT '',
	health_expiry DATE NOT NULL,
	health_file VARCHAR(255) NOT NULL DEFAULT '',
	trained BOOLEAN NOT NULL DEFAULT false,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sppg_compliance_handlers_sppg ON sppg_compliance_handlers(sppg_id);

CREATE TABLE IF NOT EXISTS sppg_compliance_labs (
	id VARCHAR(64) PRIMARY KEY,
	sppg_id VARCHAR(64) NOT NULL REFERENCES sppg_kitchens(id) ON DELETE CASCADE,
	test_date DATE NOT NULL DEFAULT CURRENT_DATE,
	kind VARCHAR(32) NOT NULL DEFAULT 'swab',
	target VARCHAR(255) NOT NULL,
	param VARCHAR(100) NOT NULL,
	value DOUBLE PRECISION NOT NULL DEFAULT 0,
	unit VARCHAR(50) NOT NULL DEFAULT 'koloni/cm2',
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sppg_compliance_labs_sppg ON sppg_compliance_labs(sppg_id);
CREATE INDEX IF NOT EXISTS idx_sppg_compliance_labs_date ON sppg_compliance_labs(test_date);

CREATE TABLE IF NOT EXISTS sppg_compliance_audits (
	id VARCHAR(64) PRIMARY KEY,
	sppg_id VARCHAR(64) NOT NULL REFERENCES sppg_kitchens(id) ON DELETE CASCADE,
	purpose VARCHAR(255) NOT NULL,
	preferred_date DATE NOT NULL,
	note TEXT NOT NULL DEFAULT '',
	status VARCHAR(50) NOT NULL DEFAULT 'Diajukan',
	filed_at VARCHAR(50) NOT NULL DEFAULT '28 Sept 2026',
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sppg_compliance_audits_sppg ON sppg_compliance_audits(sppg_id);

CREATE TABLE IF NOT EXISTS sppg_kitchen_pipeline_states (
	sppg_id VARCHAR(64) NOT NULL REFERENCES sppg_kitchens(id) ON DELETE CASCADE,
	date DATE NOT NULL DEFAULT CURRENT_DATE,
	current_stage_id VARCHAR(32) NOT NULL DEFAULT 'stage-2',
	stage1_status VARCHAR(32) NOT NULL DEFAULT 'completed',
	stage1_progress INT NOT NULL DEFAULT 100,
	stage2_status VARCHAR(32) NOT NULL DEFAULT 'active',
	stage2_progress INT NOT NULL DEFAULT 100,
	stage3_status VARCHAR(32) NOT NULL DEFAULT 'upcoming',
	stage3_progress INT NOT NULL DEFAULT 0,
	stage4_status VARCHAR(32) NOT NULL DEFAULT 'upcoming',
	stage4_progress INT NOT NULL DEFAULT 0,
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	PRIMARY KEY (sppg_id, date)
);
CREATE INDEX IF NOT EXISTS idx_sppg_kitchen_pipeline_sppg ON sppg_kitchen_pipeline_states(sppg_id);

CREATE TABLE IF NOT EXISTS validator_class_reconciliation (
	id VARCHAR(64) PRIMARY KEY,
	school_npsn VARCHAR(32) NOT NULL,
	date DATE NOT NULL DEFAULT CURRENT_DATE,
	class_name VARCHAR(64) NOT NULL,
	quota INT NOT NULL DEFAULT 0,
	present INT NOT NULL DEFAULT 0,
	sick INT NOT NULL DEFAULT 0,
	permit INT NOT NULL DEFAULT 0,
	handed INT NOT NULL DEFAULT 0,
	leftover INT NOT NULL DEFAULT 0,
	surplus_option VARCHAR(64) NOT NULL DEFAULT '',
	allocated_by VARCHAR(150) NOT NULL DEFAULT '',
	allocated_at TIMESTAMPTZ,
	notes TEXT NOT NULL DEFAULT '',
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	CONSTRAINT unq_school_date_class UNIQUE(school_npsn, date, class_name)
);
CREATE INDEX IF NOT EXISTS idx_validator_reconciliation_school_date ON validator_class_reconciliation(school_npsn, date);
`

// MigrateExtended menjalankan migrasi untuk seluruh tabel ekosistem KawanGizi MBG.
func MigrateExtended(ctx context.Context) error {
	_, err := pool.Exec(ctx, extendedSchema)
	if err != nil {
		return fmt.Errorf("migrasi skema extended gagal: %w", err)
	}
	return nil
}
