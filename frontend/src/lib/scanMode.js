/**
 * Konstanta mode analisis dan sumber gambar untuk Pemindai Visual.
 *
 * Dipisah dari komponen supaya file komponen hanya mengekspor komponen
 * (memegui aturan fast refresh) dan konstantanya bisa dipakai di mana saja.
 */

export const SCAN_MODES = {
  KELAYAKAN: 'kelayakan',
  NUTRISI: 'nutrisi',
}

export const SCAN_SOURCES = {
  CAMERA: 'camera',
  UPLOAD: 'upload',
}
