/**
 * Utility mandiri tanpa dependensi eksternal untuk memformat waktu ISO atau tanggal
 * menjadi waktu relatif berbahasa Indonesia secara akurat, instan, dan kompatibel 100%
 * dengan Metro bundler pada Web, iOS, dan Android.
 *
 * Contoh hasil:
 * - "Baru saja" (< 45 detik)
 * - "5 menit yang lalu"
 * - "2 jam yang lalu"
 * - "3 hari yang lalu"
 * - "2 minggu yang lalu"
 * - "1 bulan yang lalu"
 * - "1 tahun yang lalu"
 *
 * @param dateInput Tanggal dalam format ISO string, Date object, atau fallback string
 * @param fallback Nilai default jika waktu tidak valid atau kosong (default: "Baru saja")
 */
export function formatRelativeTime(
  dateInput?: string | Date | null,
  fallback: string = 'Baru saja'
): string {
  if (!dateInput) return fallback;

  try {
    let dateObj: Date;

    if (dateInput instanceof Date) {
      dateObj = dateInput;
    } else if (typeof dateInput === 'string') {
      // Jika string waktu sudah dalam bentuk deskriptif manual (e.g. "15 menit lalu", "Baru saja")
      if (
        !dateInput.includes('T') &&
        !dateInput.includes('-') &&
        !dateInput.includes(':') &&
        isNaN(Date.parse(dateInput))
      ) {
        return dateInput;
      }
      dateObj = new Date(dateInput);
    } else {
      return fallback;
    }

    if (isNaN(dateObj.getTime())) {
      return typeof dateInput === 'string' && dateInput.trim().length > 0
        ? dateInput
        : fallback;
    }

    const now = Date.now();
    const diffMs = now - dateObj.getTime();

    // Waktu di masa depan atau baru saja dibuat (< 45 detik)
    if (diffMs < 45 * 1000 && diffMs >= -5000) {
      return 'Baru saja';
    }

    const diffSeconds = Math.floor(Math.abs(diffMs) / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);

    if (diffMinutes < 1) {
      return `${diffSeconds} detik yang lalu`;
    }
    if (diffMinutes < 60) {
      return `${diffMinutes} menit yang lalu`;
    }
    if (diffHours < 24) {
      return `${diffHours} jam yang lalu`;
    }
    if (diffDays < 7) {
      return `${diffDays} hari yang lalu`;
    }
    if (diffWeeks < 4) {
      return `${diffWeeks} minggu yang lalu`;
    }
    if (diffMonths < 12) {
      return `${diffMonths} bulan yang lalu`;
    }
    return `${diffYears} tahun yang lalu`;
  } catch (error) {
    return typeof dateInput === 'string' ? dateInput : fallback;
  }
}
