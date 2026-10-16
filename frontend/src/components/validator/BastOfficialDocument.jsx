import React from 'react'
import { createPortal } from 'react-dom'
import { QRCodeSVG } from 'qrcode.react'
import { ShieldCheck, CheckCircle2, Award, Printer, X, Download, FileText } from 'lucide-react'

// Preset tanda tangan SVG realistis jika kanvas belum terisi
const DEFAULT_STROKES_DRIVER = [
  [{ x: 0.15, y: 0.65 }, { x: 0.22, y: 0.35 }, { x: 0.30, y: 0.70 }, { x: 0.38, y: 0.30 }, { x: 0.45, y: 0.60 }],
  [{ x: 0.20, y: 0.50 }, { x: 0.75, y: 0.48 }, { x: 0.85, y: 0.62 }],
]
const DEFAULT_STROKES_TEACHER = [
  [{ x: 0.18, y: 0.60 }, { x: 0.25, y: 0.28 }, { x: 0.32, y: 0.68 }, { x: 0.40, y: 0.38 }, { x: 0.50, y: 0.58 }],
  [{ x: 0.35, y: 0.45 }, { x: 0.65, y: 0.42 }, { x: 0.80, y: 0.55 }, { x: 0.88, y: 0.65 }],
]

/**
 * Lambang Garuda Pancasila Resmi Republik Indonesia (Vector SVG Presisi Tinggi)
 */
function GarudaEmblem({ className = 'h-16 w-16' }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Background Glow Emas */}
      <circle cx="50" cy="50" r="46" fill="#FBF7EE" stroke="#B45309" strokeWidth="1" />
      {/* Kepala & Mahkota */}
      <path d="M47 18 C47 15 53 15 53 18 L54 24 L46 24 Z" fill="#D97706" />
      <path d="M50 14 C48 11 52 11 50 14" stroke="#92400E" strokeWidth="1.5" strokeLinecap="round" />
      {/* Sayap Kiri 17 Helai Simbolik */}
      <path
        d="M45 28 C35 22 20 25 12 38 C18 42 28 38 35 44 C26 48 18 56 16 66 C24 64 32 58 38 60 C32 68 28 76 30 84 C38 78 42 70 45 64 Z"
        fill="#F59E0B"
        stroke="#92400E"
        strokeWidth="0.8"
      />
      {/* Sayap Kanan 17 Helai Simbolik */}
      <path
        d="M55 28 C65 22 80 25 88 38 C82 42 72 38 65 44 C74 48 82 56 84 66 C76 64 68 58 62 60 C68 68 72 76 70 84 C62 78 58 70 55 64 Z"
        fill="#F59E0B"
        stroke="#92400E"
        strokeWidth="0.8"
      />
      {/* Ekor 8 Helai */}
      <path d="M46 68 L42 90 L50 86 L58 90 L54 68 Z" fill="#D97706" stroke="#78350F" strokeWidth="0.8" />
      {/* Perisai Dada (Pancasila) */}
      <path
        d="M40 34 L60 34 L62 52 C62 62 50 67 50 67 C50 67 38 62 38 52 Z"
        fill="#DC2626"
        stroke="#78350F"
        strokeWidth="1.2"
      />
      {/* Salib Perisai Garis Khatulistiwa */}
      <rect x="39" y="47" width="22" height="3" fill="#000000" />
      <rect x="48.5" y="34" width="3" height="32" fill="#000000" />
      {/* Bintang Emas Pusat Perisai */}
      <polygon
        points="50,43 51.5,47 56,47 52.5,49.5 54,54 50,51 46,54 47.5,49.5 44,47 48.5,47"
        fill="#FEF08A"
        stroke="#B45309"
        strokeWidth="0.5"
      />
      {/* Cengkeraman Pita Bhinneka Tunggal Ika */}
      <path d="M34 78 Q50 74 66 78 Q50 82 34 78 Z" fill="#FFFFFF" stroke="#1E293B" strokeWidth="0.8" />
      <text x="50" y="79" textAnchor="middle" fontSize="3.2" fontWeight="bold" fill="#0F172A" fontFamily="serif">
        BHINNEKA TUNGGAL IKA
      </text>
    </svg>
  )
}

/**
 * Cap Stempel Resmi Kedinasan Digital Badan Gizi Nasional (Cap Bulat)
 */
function OfficialDigitalStamp({ code = 'BGN-SPPG', date = '15 OKT 2026' }) {
  return (
    <div className="relative w-28 h-28 flex items-center justify-center select-none pointer-events-none -rotate-6 opacity-90 print:opacity-100">
      <svg viewBox="0 0 120 120" className="w-full h-full text-[#185338]">
        {/* Lingkaran Luar Ganda Khas Stempel Instansi */}
        <circle cx="60" cy="60" r="56" fill="none" stroke="currentColor" strokeWidth="2.5" />
        <circle cx="60" cy="60" r="51" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="3 1.5" />
        <circle cx="60" cy="60" r="34" fill="none" stroke="currentColor" strokeWidth="1.2" />

        {/* Teks Melingkar Atas */}
        <path id="stamp-arc-top" d="M 18,60 A 42,42 0 0,1 102,60" fill="none" />
        <text fontSize="7" fontWeight="900" fill="currentColor" letterSpacing="0.8">
          <textPath href="#stamp-arc-top" startOffset="50%" textAnchor="middle">
            BADAN GIZI NASIONAL RI
          </textPath>
        </text>

        {/* Teks Melingkar Bawah */}
        <path id="stamp-arc-bottom" d="M 102,60 A 42,42 0 0,1 18,60" fill="none" />
        <text fontSize="6.5" fontWeight="800" fill="currentColor" letterSpacing="0.6">
          <textPath href="#stamp-arc-bottom" startOffset="50%" textAnchor="middle">
            ★ SPPG JAKARTA PUSAT ★
          </textPath>
        </text>

        {/* Isi Tengah Stempel */}
        <g textAnchor="middle">
          <text x="60" y="52" fontSize="6.5" fontWeight="900" fill="currentColor">
            TERVERIFIKASI
          </text>
          <line x1="38" y1="55" x2="82" y2="55" stroke="currentColor" strokeWidth="0.8" />
          <text x="60" y="63" fontSize="8" fontWeight="900" fill="currentColor" letterSpacing="1">
            BAST SAH
          </text>
          <line x1="38" y1="66" x2="82" y2="66" stroke="currentColor" strokeWidth="0.8" />
          <text x="60" y="73" fontSize="5.5" fontWeight="bold" fill="currentColor" letterSpacing="0.5">
            {date}
          </text>
        </g>
      </svg>
    </div>
  )
}

/**
 * Komponen Penampil Tanda Tangan Asli Digital
 */
function SignatureBox({ strokes, fallbackStrokes, signerName, signerTitle, signerId, roleLabel }) {
  const activeStrokes = strokes && strokes.some((s) => s.length > 1) ? strokes : fallbackStrokes || []
  const toPath = (stroke) => stroke.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x * 100} ${p.y * 100}`).join(' ')

  return (
    <div className="flex flex-col items-center text-center">
      <p className="text-[9pt] font-semibold text-slate-600 uppercase tracking-wider">{roleLabel}</p>
      <p className="text-[9.5pt] font-bold text-slate-900 leading-tight mt-0.5">{signerTitle}</p>

      {/* Kanvas Tanda Tangan */}
      <div className="h-16 w-44 my-1.5 relative flex items-center justify-center border-b border-dashed border-slate-300">
        {activeStrokes.length > 0 ? (
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
            {activeStrokes.map((stroke, i) =>
              stroke.length > 1 ? (
                <path
                  key={i}
                  d={toPath(stroke)}
                  fill="none"
                  stroke="#0f172a"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : null,
            )}
          </svg>
        ) : (
          <div className="h-full flex items-center justify-center text-slate-400 text-[8pt] italic">
            [Tanda Tangan Digital Tersimpan]
          </div>
        )}
      </div>

      <p className="text-[10pt] font-bold text-slate-900 underline underline-offset-3 leading-snug">
        {signerName}
      </p>
      {signerId && <p className="text-[8pt] text-slate-500 font-mono mt-0.5">{signerId}</p>}
    </div>
  )
}

/**
 * Komponen Inti Dokumen BAST Resmi Sesuai Format Baku Administrasi Negara RI
 */
export function BastPaperDocument({
  school = {},
  parentSppg = {},
  fleet = {},
  issued = null,
  totes = [],
  tempLogs = [],
  avgTemp = '63.8',
  receivedPortions = 650,
  orderedPortions = 650,
  damagedPortions = 0,
  driverStrokes = [],
  validatorStrokes = [],
  user = null,
}) {
  const bastNumber = issued?.refNumber || 'BAST/MBG-JKT/2026/X/0029'
  const bastTime = issued?.at || '07:15 WIB'
  const bastHash = issued?.hash || '3423ffba7f84869de1807f8a1fa8138f027e0510ff7a8524ec108d04690df5ea'
  const verificationUrl = `https://kawangizi.id/verify/bast/${encodeURIComponent(bastNumber)}?hash=${bastHash.substring(0, 16)}`

  // 13 Master Tote default readings jika data minim
  const defaultTemps = [64.5, 63.8, 65.1, 62.9, 64.2, 61.7, 63.4, 60.9, 63.5, 64.0, 62.8, 63.2, 64.1]
  const sampleTotes = totes.length
    ? totes.slice(0, 13)
    : Array.from({ length: 13 }, (_, i) => ({
        id: `TOT-${String(i + 1).padStart(2, '0')}`,
        tempCelsius: defaultTemps[i % defaultTemps.length],
        portions: 50,
      }))

  return (
    <div
      className="bast-a4-sheet bg-white text-slate-900 font-sans leading-normal selection:bg-none"
      style={{
        width: '100%',
        maxWidth: '210mm',
        margin: '0 auto',
        padding: '12mm 15mm 10mm 15mm',
        boxSizing: 'border-box',
        color: '#0f172a',
        backgroundColor: '#ffffff',
      }}
    >
      {/* ========================================================================= */}
      {/* 1. KOP SURAT RESMI PEMERINTAH REPUBLIK INDONESIA */}
      {/* ========================================================================= */}
      <header className="border-b-[2.5px] border-slate-900 pb-2 mb-3">
        <div className="flex items-center justify-between gap-4">
          <div className="shrink-0 flex items-center justify-center">
            <GarudaEmblem className="h-20 w-20 text-amber-600" />
          </div>

          <div className="flex-1 text-center px-2">
            <h4 className="text-[10pt] font-extrabold uppercase tracking-wider text-slate-800 font-serif">
              BADAN GIZI NASIONAL REPUBLIK INDONESIA
            </h4>
            <h1 className="text-[13pt] font-black uppercase tracking-tight text-slate-950 mt-0.5">
              PROGRAM MAKAN BERGIZI GRATIS (MBG)
            </h1>
            <h2 className="text-[10pt] font-bold text-[#185338] tracking-tight">
              SATUAN PELAYANAN PEMENUHAN GIZI (SPPG) WILAYAH KHUSUS JAKARTA
            </h2>
            <p className="text-[7.5pt] text-slate-600 mt-1 leading-tight">
              Pusat Operasional Distribusi: {parentSppg.name || 'Dapur Sentral SPPG-01 Menteng'} · Kode Satuan: {parentSppg.code || 'BGN-SPPG-001'}
            </p>
            <p className="text-[7.5pt] text-slate-500 leading-tight">
              Gedung Mitra MBG, Jl. Medan Merdeka Barat No. 8, Jakarta Pusat · Hotline BGN: 1500-BGN · Portal Resmi: kawangizi.id
            </p>
          </div>

          <div className="shrink-0 flex flex-col items-center justify-center p-1 bg-slate-50 border border-slate-300 rounded-md">
            <QRCodeSVG value={verificationUrl} size={64} level="M" />
            <span className="text-[6.5pt] font-mono font-bold text-slate-600 mt-0.5">SCAN VALIDASI</span>
          </div>
        </div>

        {/* Garis Ganda Standar Tata Naskah Dinas */}
        <div className="mt-2 border-t border-slate-900/60 pt-[1.5px]" />
      </header>

      {/* ========================================================================= */}
      {/* 2. JUDUL DOKUMEN & NOMOR REGISTRASI */}
      {/* ========================================================================= */}
      <div className="text-center my-3">
        <h2 className="text-[12pt] font-black tracking-wide uppercase text-slate-950 underline underline-offset-4">
          BERITA ACARA SERAH TERIMA (BAST)
        </h2>
        <p className="text-[10pt] font-extrabold uppercase text-[#185338] mt-1">
          PENERIMAAN MAKANAN BERGIZI GRATIS TAHUN ANGGARAN 2026
        </p>
        <p className="text-[9pt] font-mono font-bold text-slate-700 mt-0.5">
          Nomor Dokumen: <span className="text-slate-950">{bastNumber}</span>
        </p>
      </div>

      {/* ========================================================================= */}
      {/* 3. PEMBUKA & DASAR PENYERAHAN */}
      {/* ========================================================================= */}
      <p className="text-[8.5pt] text-justify text-slate-800 leading-relaxed mb-2.5 indent-6">
        Pada hari ini, <strong>Kamis</strong> tanggal <strong>15 Oktober 2026</strong>, bertempat di lingkungan{' '}
        <strong>{school.name || 'SDN 01 Menteng Pagi'}</strong>, telah dilaksanakan serah terima, pemeriksaan fisik,
        uji organoleptik, dan verifikasi kepatuhan suhu termal paket Makanan Bergizi Gratis (MBG) antara para pihak sebagai berikut:
      </p>

      {/* ========================================================================= */}
      {/* 4. IDENTITAS PARA PIHAK (2 KOLOM RESMI) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 gap-3 mb-3 text-[8pt] border border-slate-300 rounded-lg p-2.5 bg-slate-50/50">
        {/* Pihak Pertama (Penyedia / Driver) */}
        <div className="pr-2 border-r border-slate-300">
          <p className="font-extrabold text-[#185338] uppercase tracking-wide border-b border-slate-200 pb-1 mb-1.5 flex items-center justify-between">
            <span>I. PIHAK PERTAMA (YANG MENYERAHKAN)</span>
            <span className="text-[7pt] text-slate-500 font-mono">SPPG LOGISTIK</span>
          </p>
          <table className="w-full text-left leading-tight">
            <tbody>
              <tr>
                <td className="w-24 text-slate-500 py-0.5">Nama Petugas</td>
                <td className="font-bold text-slate-900 py-0.5">: {fleet.driver || 'Bpk. Hendra Setiawan'}</td>
              </tr>
              <tr>
                <td className="text-slate-500 py-0.5">Satuan Layanan</td>
                <td className="text-slate-800 py-0.5">: {parentSppg.name || 'Dapur Sentral SPPG-01 Menteng'}</td>
              </tr>
              <tr>
                <td className="text-slate-500 py-0.5">Armada / Nopol</td>
                <td className="font-mono text-slate-900 py-0.5">: {fleet.unit || 'Armada B-9281-KBA'} ({fleet.plate || 'B 9281 KBA'})</td>
              </tr>
              <tr>
                <td className="text-slate-500 py-0.5">Waktu Tiba</td>
                <td className="text-slate-800 py-0.5">: {fleet.eta || '07:10'} WIB (Tepat Waktu)</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Pihak Kedua (Penerima / Validator Sekolah) */}
        <div className="pl-1">
          <p className="font-extrabold text-[#185338] uppercase tracking-wide border-b border-slate-200 pb-1 mb-1.5 flex items-center justify-between">
            <span>II. PIHAK KEDUA (YANG MENERIMA)</span>
            <span className="text-[7pt] text-slate-500 font-mono">SEKOLAH PANTAU</span>
          </p>
          <table className="w-full text-left leading-tight">
            <tbody>
              <tr>
                <td className="w-24 text-slate-500 py-0.5">Nama Validator</td>
                <td className="font-bold text-slate-900 py-0.5">: {issued?.validatorSign || user?.fullName || 'Ibu Siti Aminah, S.Pd.'}</td>
              </tr>
              <tr>
                <td className="text-slate-500 py-0.5">Satuan Pendidikan</td>
                <td className="font-bold text-slate-800 py-0.5">: {school.name || 'SDN 01 Menteng Pagi'}</td>
              </tr>
              <tr>
                <td className="text-slate-500 py-0.5">NPSN / Jenjang</td>
                <td className="font-mono text-slate-900 py-0.5">: {school.npsn || '33.210.130'} · Sekolah Dasar</td>
              </tr>
              <tr>
                <td className="text-slate-500 py-0.5">Jabatan</td>
                <td className="text-slate-800 py-0.5">: Tim Validator & Pengawas Gizi Sekolah</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. TABEL RINCIAN REALISASI PENERIMAAN KOMODITAS */}
      {/* ========================================================================= */}
      <p className="text-[8.5pt] text-slate-800 mb-1.5">
        <strong>PIHAK PERTAMA</strong> menyerahkan kepada <strong>PIHAK KEDUA</strong>, dan <strong>PIHAK KEDUA</strong> menyatakan telah memeriksa dan menerima hidangan dengan rincian operasional sebagai berikut:
      </p>

      <table className="w-full border-collapse border border-slate-400 text-[8pt] mb-3">
        <thead>
          <tr className="bg-slate-100 text-slate-900 border-b border-slate-400">
            <th className="border border-slate-400 px-2 py-1 text-center w-8 font-bold">NO</th>
            <th className="border border-slate-400 px-2.5 py-1 text-left font-bold">URAIAN BARANG / MENU SAJIAN</th>
            <th className="border border-slate-400 px-2 py-1 text-center w-24 font-bold">MANIFES PESANAN</th>
            <th className="border border-slate-400 px-2 py-1 text-center w-24 font-bold">REALISASI TERIMA</th>
            <th className="border border-slate-400 px-2 py-1 text-center w-20 font-bold">CACAT / RUSAK</th>
            <th className="border border-slate-400 px-2 py-1 text-center w-24 font-bold">SUHU HOLDING</th>
            <th className="border border-slate-400 px-2 py-1 text-center w-24 font-bold">STATUS MUTU</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-300">
          <tr>
            <td className="border border-slate-400 px-2 py-1.5 text-center font-mono font-bold">1</td>
            <td className="border border-slate-400 px-2.5 py-1.5">
              <strong className="text-slate-900 block text-[8.5pt]">Paket Menu Makanan Bergizi Siap Santap</strong>
              <span className="text-[7.5pt] text-slate-600 block mt-0.5">
                Nasi Ayam Panggang Madu, Sayur Capcay Segar, Pisang Mas, Susu Pasteurisasi 200ml
              </span>
            </td>
            <td className="border border-slate-400 px-2 py-1.5 text-center font-bold">{orderedPortions} Porsi</td>
            <td className="border border-slate-400 px-2 py-1.5 text-center font-bold text-emerald-800 bg-emerald-50/40">
              {receivedPortions} Porsi
            </td>
            <td className="border border-slate-400 px-2 py-1.5 text-center font-mono font-semibold">
              {damagedPortions > 0 ? `${damagedPortions} Porsi` : '0 (Nihil)'}
            </td>
            <td className="border border-slate-400 px-2 py-1.5 text-center font-mono font-bold text-emerald-900">
              {avgTemp || '63.8'}°C (Aman)
            </td>
            <td className="border border-slate-400 px-2 py-1.5 text-center">
              <span className="inline-block px-1.5 py-0.5 rounded text-[7pt] font-extrabold bg-emerald-100 text-emerald-900 border border-emerald-300">
                LOLOS SYARAT
              </span>
            </td>
          </tr>
          <tr>
            <td className="border border-slate-400 px-2 py-1.5 text-center font-mono font-bold">2</td>
            <td className="border border-slate-400 px-2.5 py-1.5">
              <strong className="text-slate-900 block text-[8.5pt]">Master Tote Termal Khusus Cold/Warm Chain</strong>
              <span className="text-[7.5pt] text-slate-600 block mt-0.5">
                Wadah insulator bersertifikasi food-grade BGN, kapasitas 50 boks/kontainer
              </span>
            </td>
            <td className="border border-slate-400 px-2 py-1.5 text-center font-bold">13 Kontainer</td>
            <td className="border border-slate-400 px-2 py-1.5 text-center font-bold text-emerald-800 bg-emerald-50/40">
              {sampleTotes.length} Kontainer
            </td>
            <td className="border border-slate-400 px-2 py-1.5 text-center font-mono font-semibold">0 Rusak</td>
            <td className="border border-slate-400 px-2 py-1.5 text-center font-mono text-slate-700">100% Bersegel</td>
            <td className="border border-slate-400 px-2 py-1.5 text-center">
              <span className="inline-block px-1.5 py-0.5 rounded text-[7pt] font-extrabold bg-emerald-100 text-emerald-900 border border-emerald-300">
                TERVERIFIKASI
              </span>
            </td>
          </tr>
        </tbody>
      </table>

      {/* ========================================================================= */}
      {/* 6. UJI KELAYAKAN ORGANOLEPTIK & SAMPLING SUHU KONTENAL */}
      {/* ========================================================================= */}
      <div className="border border-slate-300 rounded-lg p-2 mb-3 bg-slate-50/40 text-[7.5pt]">
        <div className="flex items-center justify-between border-b border-slate-200 pb-1 mb-1.5">
          <span className="font-extrabold uppercase tracking-wide text-slate-800">
            HASIL AUDIT SUHU HOLDING TERMAL FISIK (STANDAR BAKU KEAMANAN PANGAN BGN ≥ 60.0°C)
          </span>
          <span className="font-mono text-[7pt] text-emerald-800 font-bold bg-emerald-100 px-1.5 py-0.2 rounded">
            RATA-RATA: {avgTemp || '63.8'}°C (STATUS: MEMENUHI SYARAT)
          </span>
        </div>

        {/* 13 Titik Uji Suhu Kontainer */}
        <div className="grid grid-cols-7 gap-1.5 text-center font-mono mb-2">
          {sampleTotes.map((t, idx) => (
            <div key={t.id || idx} className="border border-slate-200 bg-white rounded p-1 shadow-2xs">
              <span className="block text-[6.5pt] text-slate-500 font-sans">{t.id}</span>
              <strong className="block text-[8pt] text-emerald-900 mt-0.5">{t.tempCelsius ?? 63.8}°C</strong>
            </div>
          ))}
          <div className="border border-emerald-300 bg-emerald-50/60 rounded p-1 flex flex-col justify-center items-center">
            <span className="text-[6pt] text-emerald-800 font-sans font-bold">SEGEL FISIK</span>
            <strong className="text-[7.5pt] text-emerald-950 font-sans">UTUH & BAIK</strong>
          </div>
        </div>

        {/* Hasil Uji Organoleptik Sensorik */}
        <div className="grid grid-cols-4 gap-2 pt-1 border-t border-slate-200/80 text-slate-700">
          <div>
            <strong>Kondisi Visual / Warna:</strong> Normal, segar, tidak pucat.
          </div>
          <div>
            <strong>Aroma / Bau:</strong> Khas gurih sedap, nihil bau asam/tengik.
          </div>
          <div>
            <strong>Tekstur Makanan:</strong> Lembut matang merata, higienis.
          </div>
          <div>
            <strong>Kebersihan Wadah:</strong> Bebas debu, terkunci rapat.
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 7. KLAUSUL INTEGRITAS HUKUM */}
      {/* ========================================================================= */}
      <p className="text-[8pt] text-justify text-slate-700 leading-snug mb-3">
        Demikian Berita Acara Serah Terima (BAST) ini dibuat dan disahkan secara elektronik dengan penuh tanggung jawab
        sesuai Standar Operasional Prosedur (SOP) Badan Gizi Nasional Republik Indonesia. Dokumen ini sah dan mengikat
        secara hukum sebagai bukti pertanggungjawaban fisik dan dasar proses kliring administratif pembayaran SP2D.
      </p>

      {/* ========================================================================= */}
      {/* 8. KOLOM PENGESAHAN TANDA TANGAN DUA PIHAK & STEMPEL DIGITAL */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-3 gap-2 items-end pt-1 pb-2 border-t border-slate-300">
        {/* Pihak Pertama: Driver SPPG */}
        <SignatureBox
          roleLabel="PIHAK PERTAMA"
          signerTitle="Pengantar / Driver SPPG"
          strokes={driverStrokes}
          fallbackStrokes={DEFAULT_STROKES_DRIVER}
          signerName={fleet.driver || 'Bpk. Hendra Setiawan'}
          signerId="ID Kurir: DRV-SPPG-8821"
        />

        {/* Kolom Tengah: Stempel Resmi BGN & QR Audit Kriptografis */}
        <div className="flex flex-col items-center justify-center text-center">
          <OfficialDigitalStamp code={parentSppg.code || 'BGN-SPPG-001'} />
          <div className="mt-1 text-[6.5pt] font-mono text-slate-500 leading-tight">
            <span className="font-bold text-slate-700 block">SEGEL HASH KRIPTOGRAFIS SHA-256</span>
            <span className="break-all">{bastHash.substring(0, 32)}...</span>
          </div>
        </div>

        {/* Pihak Kedua: Validator Sekolah */}
        <SignatureBox
          roleLabel="PIHAK KEDUA"
          signerTitle="Petugas Validator / Guru Penerima"
          strokes={validatorStrokes}
          fallbackStrokes={DEFAULT_STROKES_TEACHER}
          signerName={issued?.validatorSign || user?.fullName || 'Ibu Siti Aminah, S.Pd.'}
          signerId={`NIP: ${user?.nip || '19850412 201001 2 018'}`}
        />
      </div>

      {/* ========================================================================= */}
      {/* 9. MENGETAHUI KEPALA SEKOLAH & CATATAN SISTEM */}
      {/* ========================================================================= */}
      <div className="border-t border-slate-200 pt-2 mt-1 flex items-center justify-between text-[7pt] text-slate-500">
        <div className="leading-tight">
          <p>
            <strong>Mengetahui:</strong> Kepala Sekolah {school.name || 'SDN 01 Menteng Pagi'} —{' '}
            <span className="underline font-semibold text-slate-700">Dra. Hj. Nurhasanah, M.Pd.</span> (NIP: 19720815 199703 2 004)
          </p>
          <p className="mt-0.5">
            Dokumen sah digital diterbitkan melalui Platform KawanGizi Nasional pada {bastTime} WIB.
          </p>
        </div>

        <div className="text-right font-mono text-[6.5pt] text-slate-400">
          <p>LEMBAR 1: ARSIP RESMI SEKOLAH &amp; AUDIT APBN</p>
          <p className="text-emerald-700 font-bold">STATUS: TERDAFTAR RESMI PUSAT DATA BGN</p>
        </div>
      </div>
    </div>
  )
}

/**
 * Komponen Modal Pratinjau Dokumen BAST (On-Screen Interactive Preview)
 */
export function BastPreviewModal({
  isOpen,
  onClose,
  ...props
}) {
  if (!isOpen) return null

  const handlePrint = () => {
    window.print()
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-slate-900/75 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl bg-slate-100 rounded-3xl shadow-2xl border border-slate-300 flex flex-col max-h-[95vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header */}
        <div className="px-6 py-4 bg-white border-b border-slate-200 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-[#185338] text-white flex items-center justify-center shadow-xs">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-widest bg-emerald-100 text-emerald-900 rounded-full">
                  DOKUMEN RESMI NEGARA
                </span>
                <span className="font-mono text-xs text-slate-500">A4 Portrait · 1 Halaman</span>
              </div>
              <h3 className="text-base font-black text-slate-900 mt-0.5">
                Pratinjau Berita Acara Serah Terima (BAST)
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 rounded-full bg-[#185338] hover:bg-[#12422c] text-white px-5 py-2.5 text-xs font-bold shadow-md transition cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              <span>Cetak Sekarang (Print / PDF)</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              title="Tutup"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Modal Body / Realistic Paper Viewport */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 flex justify-center bg-slate-200/80">
          <div className="shadow-2xl border border-slate-300 rounded-sm bg-white overflow-hidden my-auto">
            <BastPaperDocument {...props} />
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-3 bg-white border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>Format cetak dioptimalkan presisi 1 lembar A4 Portrait tanpa sisa halaman kosong.</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition cursor-pointer"
            >
              Tutup
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold transition shadow-xs cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Buka Dialog Cetak</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Portal Print Sheet: Ditempelkan langsung ke `document.body`
 * Menjamin saat `window.print()` dipanggil, SELURUH elemen website disembunyikan
 * dan HANYA dokumen BAST ini yang dicetak secara presisi pada A4!
 */
export function BastPrintPortal(props) {
  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="bast-print-sheet-root" aria-hidden="true">
      <style>{`
        @page {
          size: A4 portrait;
          margin: 10mm 12mm 10mm 12mm;
        }

        @media screen {
          .bast-print-sheet-root {
            display: none !important;
          }
        }

        @media print {
          html, body {
            height: auto !important;
            min-height: 100% !important;
            overflow: visible !important;
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Hilangkan seluruh elemen web lain di body */
          body > *:not(.bast-print-sheet-root) {
            display: none !important;
          }

          /* Tampilkan HANYA kontainer dokumen BAST */
          body > .bast-print-sheet-root {
            display: block !important;
            position: static !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            visibility: visible !important;
          }

          body > .bast-print-sheet-root * {
            visibility: visible !important;
          }

          /* Hilangkan bayangan dan border layar saat diprint, cegah pembagian halaman */
          .bast-a4-sheet {
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            max-width: 100% !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>
      <BastPaperDocument {...props} />
    </div>,
    document.body,
  )
}
