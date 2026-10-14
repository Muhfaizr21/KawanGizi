import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  Image,
  StatusBar,
  Modal,
  Dimensions,
  TextInput,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  Check,
  ShieldAlert,
  WifiOff,
  Sparkles,
  Zap,
  Scan,
  CircleHelp,
  RotateCcw,
  RotateCw,
  X,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Camera,
  ShieldCheck,
  Bot,
} from 'lucide-react-native';
import { ContextualAiChatSheet } from './ContextualAiChatSheet';
import { FeatureHeader } from './FeatureHeader';
import { QualityVerdict } from '../../utils/quality';
import { readMacros } from '../../utils/nutrition';
import { scanRequest } from '../../lib/api';
import { GradeBand } from '../../utils/nutrition';
import { buildDecisionLog } from '../../utils/foodBenefits';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const SEVERITY_COLOR = {
  none: '#15803D',
  warning: '#B45309',
  critical: '#B91C1C',
} as const;

const SCAN_GRADE_BAND: GradeBand = 'sd_atas';

export interface DetectedFoodItem {
  id: number;
  name: string;
  portionGram: number;
  nutrition: {
    energi: number;
    protein: number;
    lemak: number;
    karbo: number;
    serat: number;
  };
}

const formatNumber = (num: number): string => {
  return num.toFixed(1).replace('.', ',');
};

/** Kartu keputusan mutu hasil POST /api/scans (gateway Go → AI service Python). */
interface BackendScanResult {
  id: string;
  boxId: string;
  qrToken: string;
  batchId?: string;
  scannedAt: string;
  score: number;
  verdict: 'layak' | 'peringatan' | 'tolak';
  verdictLabel: string;
  releaseTemp: number;
  holdTemp: number;
  checks: { label: string; ok: boolean; note: string }[];
  note: string;
  aiClass: string;
  aiConfidence: number;
  menuName?: string;
  menuClass?: string;
  menuDisplay?: string;
  menuConfidence?: number;
  freshnessClass?: string;
  freshnessDisplay?: string;
  freshnessConfidence?: number;
  batchInfo?: {
    batchId: string;
    sppgName?: string;
    menuName?: string;
    productionDate?: string;
    ingredients?: { name: string; weightG: number }[];
    note?: string;
  };
  macros?: { energy: number; protein: number; carbs: number; fat: number; fiber?: number };
  nutrition?: {
    name: string;
    matchedTo: string;
    weightG: number;
    energy: number;
    protein: number;
    carbs: number;
    fat: number;
  }[];
  nutritionNote?: string;
}

export interface ScannerScreenProps {
  onExit?: () => void;
  onOpenProfile?: () => void;
}

export const ScannerScreen: React.FC<ScannerScreenProps> = ({ onExit, onOpenProfile }) => {
  const [hasScanned, setHasScanned] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<DetectedFoodItem | null>(null);
  const [rotation, setRotation] = useState(0);
  const [zoomScale, setZoomScale] = useState(1);
  const [qrToken, setQrToken] = useState('');
  const [holdingTemp, setHoldingTemp] = useState('');
  const [releaseTemp, setReleaseTemp] = useState('');
  const [backendScan, setBackendScan] = useState<BackendScanResult | null>(null);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const capturedFileRef = useRef<Blob | null>(null);
  const [activeTab, setActiveTab] = useState<'gizi' | 'kelayakan'>('gizi');
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Kalkulasi total nutrisi secara dinamis dari item yang terdeteksi
  const displayItems = useMemo<DetectedFoodItem[]>(() => {
    return (backendScan?.nutrition ?? []).map((item, index) => ({
      id: index + 1,
      name: `${item.name} · ${item.matchedTo}`,
      portionGram: item.weightG,
      nutrition: {
        energi: item.energy,
        protein: item.protein,
        karbo: item.carbs,
        lemak: item.fat,
        serat: 0,
      },
    }));
  }, [backendScan]);

  const totalNutrition = useMemo(() => ({
    energi: backendScan?.macros?.energy ?? 0,
    protein: backendScan?.macros?.protein ?? 0,
    lemak: backendScan?.macros?.fat ?? 0,
    karbo: backendScan?.macros?.carbs ?? 0,
    serat: backendScan?.macros?.fiber ?? 0,
  }), [backendScan]);

  // Skor dan keputusan hanya tersedia setelah server mengembalikan inferensi model.
  const effectiveScore = backendScan?.score ?? 0;
  const effectiveHoldingTempC = backendScan?.holdTemp ?? 0;

  // Keputusan dari gateway adalah sumber kebenaran yang sama untuk web dan mobile.
  const verdict = useMemo<QualityVerdict>(() => {
    if (!backendScan) {
      return {
        verdict: 'ditolak',
        label: 'Hasil AI belum tersedia',
        color: '#64748B',
        action: 'Hubungkan ke server AI dan ulangi pemindaian sebelum mengambil keputusan.',
        reasons: backendError ? [backendError] : [],
      };
    }
    const mapped = backendScan.verdict === 'tolak'
      ? { verdict: 'ditolak' as const, label: 'Ditahan untuk pemeriksaan', color: '#B91C1C', action: 'Tahan sampel dan periksa penyebab sesuai SOP.' }
      : backendScan.verdict === 'peringatan'
        ? { verdict: 'waspada' as const, label: 'Perlu verifikasi petugas', color: '#B45309', action: 'Model menilai foto secara visual; verifikasi suhu dan seluruh hidangan sesuai SOP.' }
        : { verdict: 'waspada' as const, label: 'Perlu verifikasi petugas', color: '#B45309', action: 'Hasil fresh bukan bukti keamanan hidangan matang. Periksa seluruh boks sesuai SOP.' };
    return { ...mapped, reasons: backendScan.note ? [backendScan.note] : [] };
  }, [backendScan, backendError]);
  const macros = useMemo(() => {
    const estimated: Record<string, number> = backendScan?.macros
      ? {
          energi: backendScan.macros.energy,
          protein: backendScan.macros.protein,
          karbohidrat: backendScan.macros.carbs,
          lemak: backendScan.macros.fat,
          serat: backendScan.macros.fiber ?? 0,
        }
      : { energi: 0, protein: 0, karbohidrat: 0, lemak: 0, serat: 0 };
    return readMacros(SCAN_GRADE_BAND, estimated).filter((m) => m.key !== 'serat');
  }, [backendScan]);

  const decisionLog = useMemo(() => {
    if (!backendScan) return null;
    const detected = (backendScan.nutrition ?? []).map((item) => ({ name: item.name, status: '' }));
    if (!detected.length) {
      const fallback = backendScan.menuDisplay || backendScan.menuClass || backendScan.menuName || backendScan.batchInfo?.menuName;
      if (fallback) detected.push({ name: fallback, status: '' });
    }
    return buildDecisionLog({
      detected,
      registeredMenu: backendScan.batchInfo?.menuName || backendScan.menuName || '',
      verdict: backendScan.verdict,
    });
  }, [backendScan]);

  const failedChecks = (backendScan?.checks ?? []).filter((check) => !check.ok);

  const displayPhoto = capturedPhoto || '';

  // Kirim foto ke POST /api/scans. Hasil hanya diterima dari model di server.
  const runBackendScan = async (image: { uri?: string; file?: Blob }) => {
    setIsAnalyzing(true);
    setBackendError(null);
    setBackendScan(null);
    setIsChatOpen(false);
    try {
      if (!qrToken.trim() || !holdingTemp || !releaseTemp) {
        throw new Error('Isi token QR, suhu holding, dan suhu lepas dapur sebelum memindai.');
      }
      const body = await scanRequest({
        uri: image.uri,
        file: image.file,
        qrToken: qrToken.trim(),
        holdingTempC: Number(holdingTemp),
        releaseTempC: Number(releaseTemp),
      });
      setBackendScan(body?.data ?? null);
    } catch (err) {
      setBackendScan(null);
      setCapturedPhoto(null);
      setHasScanned(false);
      capturedFileRef.current = null;
      const message = err instanceof Error ? err.message : 'Tidak dapat terhubung ke layanan AI.';
      setBackendError(message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleStartScan = async () => {
    setBackendScan(null);
    setBackendError(null);
    if (!qrToken.trim() || !holdingTemp || !releaseTemp) {
      Alert.alert('Data pemeriksaan belum lengkap', 'Isi token QR boks serta suhu holding dan suhu lepas dapur yang benar-benar diukur.');
      return;
    }
    if (Platform.OS === 'web') {
      try {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.setAttribute('capture', 'environment');
        input.style.display = 'none';
        document.body.appendChild(input);

        input.onchange = (e: Event) => {
          const target = e.target as HTMLInputElement;
          const file = target.files?.[0];
          if (file) {
            const imageUrl = URL.createObjectURL(file);
            setCapturedPhoto(imageUrl);
            setHasScanned(true);
            capturedFileRef.current = file;
            void runBackendScan({ file });
          }
          if (document.body.contains(input)) {
            document.body.removeChild(input);
          }
        };

        input.oncancel = () => {
          if (document.body.contains(input)) {
            document.body.removeChild(input);
          }
        };

        input.click();
      } catch (err) {
        console.error('Gagal membuka kamera web:', err);
        Alert.alert('Kamera tidak tersedia', 'Pilih izin kamera atau gunakan perangkat dengan kamera yang dapat diakses. Hasil scan tidak dibuat.');
      }
    } else {
      try {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          Alert.alert(
            'Izin Kamera Diperlukan',
            'Aplikasi membutuhkan izin akses kamera untuk mengambil foto porsi makanan MBG secara langsung.',
            [{ text: 'Tutup' }],
          );
          return;
        }

        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          allowsEditing: false,
          quality: 0.8,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
          const uri = result.assets[0].uri;
          setCapturedPhoto(uri);
          setHasScanned(true);
          void runBackendScan({ uri });
        }
      } catch (err) {
        console.error('Gagal meluncurkan kamera:', err);
        Alert.alert(
          'Kamera Tidak Tersedia',
          'Terjadi kendala saat membuka kamera. Hasil scan tidak dibuat; coba lagi atau gunakan perangkat lain.',
        );
      }
    }
  };

  const handleResetScan = () => {
    setCapturedPhoto(null);
    setHasScanned(false);
    setBackendScan(null);
    setBackendError(null);
    capturedFileRef.current = null;
    setIsImageViewerOpen(false);
    setSelectedItem(null);
    setRotation(0);
    setZoomScale(1);
    setActiveTab('gizi');
    setIsChatOpen(false);
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleZoomIn = () => {
    setZoomScale((prev) => Math.min(prev + 0.5, 4));
  };

  const handleZoomOut = () => {
    setZoomScale((prev) => Math.max(prev - 0.5, 1));
  };

  const handleResetZoom = () => {
    setZoomScale(1);
    setRotation(0);
  };

  const handleCloseModal = () => {
    setIsImageViewerOpen(false);
    setRotation(0);
    setZoomScale(1);
  };

  const handleTagPress = (item: DetectedFoodItem) => {
    setSelectedItem((prev) => (prev?.id === item.id ? null : item));
  };

  const handleHelpPress = () => {
    Alert.alert(
      'Panduan Pemindai AI',
      '• Ambil foto buah atau sayur dengan pencahayaan cukup.\n• Foto dikirim ke server untuk klasifikasi fresh/stale. Model ini tidak memeriksa lauk matang, benda asing, alergen, atau keamanan mikrobiologis.\n• Nilai gizi dihitung dari bahan dan berat menu yang dikirim, bukan dikenali dari foto.',
      [{ text: 'Mengerti', style: 'default' }],
    );
  };

  const handleAction = (_approved: boolean) => {
    if (!backendScan) return;
    Alert.alert(
      backendScan.verdict === 'tolak' ? 'Sampel perlu ditahan' : 'Verifikasi petugas diperlukan',
      'Hasil classifier dan suhu tidak membuktikan keamanan seluruh hidangan. Ikuti pemeriksaan fisik dan SOP sekolah sebelum menentukan distribusi.',
      [{ text: 'Mengerti' }],
    );
  };

  return (
    <View style={styles.screen}>
      <StatusBar backgroundColor="#ffffff" barStyle="dark-content" translucent={false} />
      <FeatureHeader title="Pindai Boks" onOpenProfile={onOpenProfile} />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >

        {/* Kondisional Area Scan:
            - Sebelum pindai (!hasScanned): Tampilkan kartu oranye Pemindai Visual.
            - Hasil data hanya ditampilkan jika scan dari API berhasil.
        */}
        {!hasScanned || !backendScan ? (
          <View style={styles.scanCard}>
            {/* Top Badges */}
            <View style={styles.topBadgesRow}>
              <View style={styles.leftBadge}>
                <Sparkles size={14} color="#FFFFFF" strokeWidth={2.2} />
                <Text style={styles.badgeText}>Pengenal menu + kesegaran matang</Text>
              </View>
              <View style={styles.rightBadge}>
                <Zap size={14} color="#22C55E" fill="#22C55E" strokeWidth={2.2} />
                <Text style={styles.badgeText}>Inferensi server</Text>
              </View>
            </View>

            {/* Typography */}
            <Text style={styles.scanCardTitle}>
              Scan Hidangan Matang
            </Text>
            <Text style={styles.scanCardDescription}>
              Foto dinilai oleh model pengenal menu dan model kesegaran hidangan matang. Token QR serta suhu berasal dari pemeriksaan petugas; batch mengisi resep dan gizi bila tersedia di database.
            </Text>

            <View style={styles.scanInputs}>
              <TextInput value={qrToken} onChangeText={setQrToken} placeholder="Masukkan token QR boks (manual)" autoCapitalize="characters" style={styles.scanInput} accessibilityLabel="Masukkan token QR boks secara manual" />
              <View style={styles.scanTemperatureRow}>
                <TextInput value={releaseTemp} onChangeText={setReleaseTemp} placeholder="Suhu lepas dapur °C" keyboardType="decimal-pad" style={[styles.scanInput, styles.scanTemperatureInput]} accessibilityLabel="Suhu lepas dapur" />
                <TextInput value={holdingTemp} onChangeText={setHoldingTemp} placeholder="Suhu holding °C" keyboardType="decimal-pad" style={[styles.scanInput, styles.scanTemperatureInput]} accessibilityLabel="Suhu holding" />
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionButtonsRow}>
              <TouchableOpacity
                style={styles.primaryScanButton}
                onPress={handleStartScan}
                activeOpacity={0.88}
                accessibilityRole="button"
                accessibilityLabel="Mulai Pindai Porsi MBG"
              >
                <Scan size={18} color="#EAA016" strokeWidth={2.4} />
                <Text style={styles.primaryScanButtonText}>Mulai Pindai Porsi MBG</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.helpButton}
                onPress={handleHelpPress}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Bantuan pemindai AI"
              >
                <CircleHelp size={20} color="#FFFFFF" strokeWidth={2.2} />
              </TouchableOpacity>
            </View>
          </View>
        ) : capturedPhoto ? (
          /* Kartu Foto Hasil Jepretan Kamera dengan Floating UI Tags */
          <View style={styles.capturedImageHeroCard}>
            <TouchableOpacity
              style={styles.capturedImageHeroPressable}
              onPress={() => setIsImageViewerOpen(true)}
              activeOpacity={0.92}
              accessibilityRole="button"
              accessibilityLabel="Buka foto porsi makanan MBG layar penuh"
              accessibilityHint="Ketuk untuk memperbesar, menggeser, dan memutar gambar"
            >
              <Image
                source={{ uri: displayPhoto }}
                style={styles.capturedImageHero}
                resizeMode="cover"
              />
            </TouchableOpacity>

            {/* Model klasifikasi tidak mengembalikan posisi/segmentasi pada foto. */}

            {/* Overlay Bar Atas */}
            <View style={styles.capturedImageOverlayTop} pointerEvents="box-none">
              <View style={styles.capturedPhotoPill}>
                <Sparkles size={13} color="#FFFFFF" strokeWidth={2.2} />
                <Text style={styles.capturedPhotoPillText}>
                  {isAnalyzing
                    ? 'Analisis AI berjalan…'
                    : backendScan
                      ? `Kesegaran ${backendScan.freshnessDisplay || backendScan.freshnessClass || backendScan.aiClass} · menu ${backendScan.menuDisplay || backendScan.menuClass || 'belum dikenali'}`
                      : 'Menunggu hasil classifier server'}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.retakeButton}
                onPress={handleStartScan}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Ambil ulang foto kamera"
              >
                <Camera size={13} color="#FFFFFF" strokeWidth={2} />
                <Text style={styles.retakeButtonText}>Ambil Ulang</Text>
              </TouchableOpacity>
            </View>

            {/* Overlay Bar Bawah (Petunjuk Zoom) */}
            <View style={styles.capturedImageOverlayBottom} pointerEvents="box-none">
              <TouchableOpacity
                style={styles.zoomHintBadge}
                onPress={() => setIsImageViewerOpen(true)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Buka layar penuh untuk perbesar dan putar"
              >
                <Maximize2 size={13} color="#FFFFFF" strokeWidth={2.2} />
                <Text style={styles.zoomHintText}>Ketuk untuk perbesar & putar</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.emptyStateContainer}>
            <Text style={styles.emptyStateTitle}>Foto belum tersedia</Text>
            <Text style={styles.emptyStateDescription}>{backendError || 'Ambil foto baru untuk mengirim scan ke server.'}</Text>
          </View>
        )}

        {/* Area di Bawah Scan Card */}
        {!hasScanned || !backendScan ? (
          /* Initial / Default Empty State (100% Bahasa Indonesia) */
          <View style={styles.emptyStateContainer}>
            <View style={styles.emptyStateIconWrapper}>
              <Scan size={32} color="#94A3B8" strokeWidth={1.8} />
            </View>
              <Text style={styles.emptyStateTitle}>{backendError ? 'Scan belum berhasil' : 'Data akan muncul di sini setelah pemindaian'}</Text>
            {backendError ? <Text style={styles.emptyStateDescription}>{backendError}</Text> : null}
            <Text style={styles.emptyStateDescription}>
              Masukkan token QR serta suhu hasil pengukuran, lalu ambil foto untuk mengirimnya ke model yang sama dengan portal web.
            </Text>
          </View>
        ) : (
          /* Scanned State Results */
          <View style={styles.scannedResults}>
            {/* Scanned Header with Batch Code & Reset */}
            <View style={styles.scannedHeader}>
              <View style={styles.scannedBatchBadge}>
                <Check size={14} color="#15803D" strokeWidth={2.5} />
                <Text style={styles.scannedBatchCode}>{backendScan?.qrToken || qrToken}</Text>
              </View>
              <TouchableOpacity
                style={styles.resetButton}
                onPress={handleResetScan}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Pindai ulang atau reset data"
              >
                <RotateCcw size={13} color="#64748B" />
                <Text style={styles.resetButtonText}>Reset / Pindai Ulang</Text>
              </TouchableOpacity>
            </View>
            <View style={{ backgroundColor: '#F8FAFC', borderColor: '#E2E8F0', borderWidth: 1, borderRadius: 14, padding: 12, gap: 4 }}>
              <Text style={{ color: '#64748B', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' }}>Menu batch</Text>
              <Text style={{ color: '#0F172A', fontSize: 13, fontWeight: '800' }}>{backendScan.batchInfo?.menuName || backendScan.menuName || 'Menu belum tercatat'}</Text>
              <Text style={{ color: '#64748B', fontSize: 11 }}>
                {backendScan.batchInfo?.sppgName || 'SPPG belum tercatat'} · {backendScan.batchInfo?.batchId || backendScan.batchId || 'Batch belum tertaut'} · produksi {backendScan.batchInfo?.productionDate || 'belum tercatat'}
              </Text>
              {backendScan.batchInfo?.ingredients?.map((ingredient, index) => (
                <Text key={`${ingredient.name}-${index}`} style={{ color: '#475569', fontSize: 11 }}>
                  • {ingredient.name}{ingredient.weightG > 0 ? ` · ${ingredient.weightG} g` : ''}
                </Text>
              ))}
            </View>

            {/* Segmented Control (Pill-shaped Tab Switcher) */}
            <View style={styles.segmentedControlWrapper}>
              <View style={styles.segmentedControl}>
                <TouchableOpacity
                  style={[
                    styles.segmentBtn,
                    activeTab === 'gizi' && styles.segmentBtnActive,
                  ]}
                  onPress={() => setActiveTab('gizi')}
                  activeOpacity={0.8}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: activeTab === 'gizi' }}
                  accessibilityLabel="Tab Informasi Gizi"
                >
                  <Sparkles
                    size={15}
                    color={activeTab === 'gizi' ? '#0C4A94' : '#64748B'}
                    strokeWidth={activeTab === 'gizi' ? 2.5 : 2}
                  />
                  <Text
                    style={[
                      styles.segmentBtnText,
                      activeTab === 'gizi' && styles.segmentBtnTextActive,
                    ]}
                  >
                    Informasi Gizi
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.segmentBtn,
                    activeTab === 'kelayakan' && styles.segmentBtnActive,
                  ]}
                  onPress={() => setActiveTab('kelayakan')}
                  activeOpacity={0.8}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: activeTab === 'kelayakan' }}
                  accessibilityLabel="Tab Validasi Kelayakan"
                >
                  <ShieldCheck
                    size={15}
                    color={activeTab === 'kelayakan' ? '#0C4A94' : '#64748B'}
                    strokeWidth={activeTab === 'kelayakan' ? 2.5 : 2}
                  />
                  <Text
                    style={[
                      styles.segmentBtnText,
                      activeTab === 'kelayakan' && styles.segmentBtnTextActive,
                    ]}
                  >
                    Validasi Kelayakan
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* VIEW A: INFORMASI GIZI (DEFAULT) */}
            {activeTab === 'gizi' ? (
              <View style={styles.viewContainer}>
                {/* Tabel Ringkasan Kandungan Gizi Biru/Oranye (Sesuai Referensi Gambar) */}
                {backendScan?.macros ? <NutritionSummaryTable
                  totalNutrition={totalNutrition}
                  items={displayItems}
                  selectedItem={selectedItem}
                  onSelectItem={setSelectedItem}
                /> : <Text style={styles.sectionCaption}>Data gizi belum tersedia dari server.</Text>}

                {/* Estimasi Makronutrien Target Porsi (Progress Bars) */}
                <View style={styles.macroSection}>
                  <Text style={styles.sectionTitle}>Estimasi makronutrien target porsi</Text>
                  <Text style={styles.sectionCaption}>
                    Nilai berasal dari resep atau paket menu batch yang tersimpan di server.
                    {backendScan?.nutritionNote ? ` ${backendScan.nutritionNote}` : ''}
                  </Text>
                    {backendScan?.macros ? macros.map((macro) => (
                    <View key={macro.key} style={styles.macroRow}>
                      <Text style={styles.macroLabel}>
                        {macro.label} · {macro.unit}
                      </Text>
                      <Text style={styles.macroValue}>
                        {macro.estimated} / {macro.target}
                      </Text>
                      <View style={styles.macroTrack}>
                        <View style={[styles.macroFill, { width: `${macro.ratio}%` }]} />
                      </View>
                      <Text style={styles.macroPercent}>{macro.percentage}% target</Text>
                    </View>
                    )) : <Text style={styles.sectionCaption}>Data gizi belum tercatat pada batch yang dipindai.</Text>}
                </View>

                {/* Log Keputusan & Kesimpulan Gizi */}
                {decisionLog && (
                  <View style={{ backgroundColor: '#FFFFFF', borderColor: '#E2E8F0', borderWidth: 1, borderRadius: 14, padding: 12, gap: 6 }}>
                    <Text style={{ fontSize: 10, fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: 1 }}>
                      Log Keputusan &amp; Kesimpulan Gizi
                    </Text>
                    <Text style={{ fontSize: 12, color: '#334155', lineHeight: 18 }}>{decisionLog.conclusion}</Text>
                    <Text style={{ fontSize: 11, color: '#64748B', fontWeight: '600' }}>{decisionLog.matchSummary}</Text>
                    {decisionLog.items.map((item) => (
                      <View key={item.name} style={{ borderColor: '#F1F5F9', borderWidth: 1, borderRadius: 10, padding: 10, gap: 2 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <Text style={{ fontSize: 12, fontWeight: '800', color: '#0F172A' }}>{item.name}</Text>
                          <Text style={{ fontSize: 9, fontWeight: '800', color: '#475569', backgroundColor: '#F1F5F9', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999, overflow: 'hidden' }}>
                            {item.category}
                          </Text>
                        </View>
                        <Text style={{ fontSize: 11, color: '#64748B', lineHeight: 16 }}>{item.benefit}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Contextual AI Consult Card */}
                <TouchableOpacity
                  style={styles.aiConsultCard}
                  onPress={() => setIsChatOpen(true)}
                  activeOpacity={0.88}
                  accessibilityRole="button"
                  accessibilityLabel="Buka konsultasi gizi AI"
                >
                  <View style={styles.aiConsultLeft}>
                    <View style={styles.aiConsultBadge}>
                      <Bot size={13} color="#0C4A94" strokeWidth={2.4} />
                      <Text style={styles.aiConsultBadgeText}>Panduan hasil server</Text>
                    </View>
                    <Text style={styles.aiConsultTitle}>Kesesuaian Gizi untuk Siswa SD</Text>
                    <Text style={styles.aiConsultDescription}>
                {backendScan?.macros ? `Protein terhitung ${formatNumber(totalNutrition.protein)}g dari dataset server.` : 'Hasil dataset gizi tampil setelah analisis server berhasil.'}
                    </Text>
                  </View>
                  <View style={styles.aiConsultActionBtn}>
                    <Sparkles size={16} color="#FFFFFF" strokeWidth={2.2} />
                  </View>
                </TouchableOpacity>
              </View>
            ) : (
              /* VIEW B: VALIDASI KELAYAKAN */
              <View style={styles.viewContainer}>
                {/* Tahap 1: Verifikasi QR boks */}
                <ChecklistSection
                  step="Tahap 1"
                  title="Pemeriksaan token QR"
                  caption="Server saat ini memeriksa format token; tanda tangan digital dan rute belum diverifikasi."
                  rows={(backendScan?.checks ?? []).filter((check) => check.label.toLowerCase().includes('qr')).map((check, index) => ({
                    id: `qr-${index}`,
                    label: check.label,
                    value: check.note,
                    note: check.note,
                    color: check.ok ? '#15803D' : '#B91C1C',
                  }))}
                />

                {/* Tahap 2: Deteksi visual porsi */}
                <ChecklistSection
                  step="Tahap 2"
                  title="Pengenalan menu & kesegaran hidangan matang"
                  caption={
                    backendScan
                      ? 'Dua classifier YOLOv8 menilai kategori menu dan kondisi visual hidangan matang; hasilnya bukan penetapan keamanan pangan.'
                      : 'Hasil classifier muncul setelah foto berhasil dianalisis oleh server.'
                  }
                  rows={(backendScan?.checks ?? []).filter((check) => check.label.toLowerCase().includes('pengenalan menu') || check.label.toLowerCase().includes('kesegaran hidangan')).map((check, index) => ({
                    id: `ai-${index}`,
                    label: check.label,
                    value: check.label.toLowerCase().includes('menu')
                      ? `${backendScan?.menuDisplay || backendScan?.menuClass || 'Belum dikenali'} · keyakinan ${Math.round((backendScan?.menuConfidence ?? 0) * 100)}%`
                      : `${backendScan?.freshnessDisplay || backendScan?.freshnessClass || backendScan?.aiClass} · keyakinan ${Math.round((backendScan?.freshnessConfidence ?? backendScan?.aiConfidence ?? 0) * 100)}%`,
                    note: check.note,
                    color: check.ok ? SEVERITY_COLOR.none : SEVERITY_COLOR.critical,
                  }))}
                />

                {/* Keputusan Mutu Card */}
                <View style={[styles.decisionCard, { borderColor: verdict.color }]}>
                    <Text style={styles.decisionStep}>Hasil visual AI · keputusan akhir oleh petugas</Text>
                  <View style={styles.decisionScoreRow}>
                    <Text style={[styles.decisionScore, { color: verdict.color }]}>
                    {backendScan ? Math.round(backendScan.score) : '—'}
                    </Text>
                    <Text style={styles.decisionScoreUnit}>probabilitas kelas segar</Text>
                  </View>
                  <Text style={[styles.decisionLabel, { color: verdict.color }]}>{verdict.label}</Text>
                  <Text style={styles.decisionAction}>{verdict.action}</Text>
                  {backendScan && (
                    <View style={{ marginTop: 8, gap: 4 }}>
                      <Text style={{ fontSize: 11, fontWeight: '800', color: verdict.color }}>
                        {backendScan.verdict === 'tolak' ? 'Alasan penahanan / tidak layak' : 'Alasan perlu verifikasi'}
                      </Text>
                      {failedChecks.length > 0 ? failedChecks.map((check, index) => (
                        <Text key={`${check.label}-${index}`} style={{ fontSize: 11, color: '#475569', lineHeight: 16 }}>
                          • {check.label}: {check.note}
                        </Text>
                      )) : (
                        <Text style={{ fontSize: 11, color: '#475569', lineHeight: 16 }}>• {backendScan.note}</Text>
                      )}
                    </View>
                  )}
        {backendScan && (
                    <Text style={styles.decisionAiMeta}>
                      {backendScan.id} · Menu: {backendScan.menuDisplay || backendScan.menuClass || 'belum dikenali'} ({Math.round((backendScan.menuConfidence ?? 0) * 100)}%) · Kesegaran: {backendScan.freshnessDisplay || backendScan.freshnessClass || backendScan.aiClass} ({Math.round((backendScan.freshnessConfidence ?? backendScan.aiConfidence) * 100)}%) · {backendScan.scannedAt}
                    </Text>
                  )}
                  {verdict.reasons.length > 0 && (
                    <View style={styles.reasonList}>
                      {verdict.reasons.map((reason) => (
                        <Text key={reason} style={styles.reasonText}>
                          {reason}
                        </Text>
                      ))}
                    </View>
                  )}
                  <View style={styles.holdingRow}>
                    <Text style={styles.holdingText}>
                    {backendScan ? `Suhu holding terukur ${effectiveHoldingTempC}°C` : 'Menunggu hasil dari server AI'}
                    </Text>
                  </View>
                </View>

                {/* Contextual AI Safety Check Banner */}
                <TouchableOpacity
                  style={styles.safetyAiBanner}
                  onPress={() => setIsChatOpen(true)}
                  activeOpacity={0.88}
                  accessibilityRole="button"
                    accessibilityLabel="Buka panduan keamanan pangan"
                >
                  <View style={styles.safetyAiBannerLeft}>
                    <View style={styles.safetyAiBadge}>
                      <ShieldCheck size={12} color="#15803D" strokeWidth={2.4} />
                      <Text style={styles.safetyAiBadgeText}>Panduan petugas</Text>
                    </View>
                    <Text style={styles.safetyAiTitle}>Catatan hasil classifier dan suhu</Text>
                    <Text style={styles.safetyAiCaption}>
                      Panduan memakai hasil scan server; model tidak mendeteksi kontaminasi atau memvalidasi batas suhu.
                    </Text>
                  </View>
                  <View style={styles.safetyAiActionBtn}>
                    <Bot size={16} color="#FFFFFF" strokeWidth={2.2} />
                  </View>
                </TouchableOpacity>

                {/* Action Decision Buttons */}
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={[styles.secondaryBtn, verdict.verdict === 'ditolak' && styles.dangerBtn]}
                    onPress={() => handleAction(false)}
                    disabled={!backendScan}
                    activeOpacity={0.88}
                    accessibilityRole="button"
                    accessibilityLabel="Tolak dan amankan sampel"
                  >
                    <ShieldAlert size={18} color="#B91C1C" strokeWidth={2.2} />
                    <Text style={[styles.secondaryBtnText, { color: '#B91C1C' }]}>
                      Tolak & amankan sampel
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.primaryBtn,
                      verdict.verdict === 'ditolak' && styles.primaryBtnBlocked,
                    ]}
                    onPress={() => handleAction(true)}
                    disabled={!backendScan || verdict.verdict === 'ditolak'}
                    activeOpacity={0.88}
                    accessibilityRole="button"
                    accessibilityLabel="Tandai hasil untuk pemeriksaan petugas"
                    accessibilityState={{ disabled: verdict.verdict === 'ditolak' }}
                  >
                    <Check size={18} color="#1E293B" strokeWidth={2.5} />
                    <Text style={styles.primaryBtnText}>Perlu verifikasi petugas</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Modal Penampil Gambar Layar Penuh (Interactive Lightbox Viewer dengan Floating Tags & Tabel Gizi) */}
      <Modal
        visible={isImageViewerOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseModal}
        statusBarTranslucent={true}
      >
        <View style={styles.modalBackdrop}>
          <StatusBar backgroundColor="#090D16" barStyle="light-content" translucent={false} />

          {/* Modal Header / Toolbar Atas */}
          <View style={styles.modalTopBar}>
            <View style={styles.modalTitleContainer}>
              <Text style={styles.modalTitle}>Pratinjau Citra Porsi MBG</Text>
              <Text style={styles.modalSubtitle}>
                Rotasi: {rotation}° · Zoom: {Math.round(zoomScale * 100)}%
              </Text>
            </View>

            <View style={styles.modalTopActions}>
              {/* Tombol Rotasi 90 Derajat */}
              <TouchableOpacity
                style={[styles.modalIconBtn, styles.modalRotateBtn]}
                onPress={handleRotate}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Putar gambar 90 derajat"
              >
                <RotateCw size={19} color="#FFFFFF" strokeWidth={2.2} />
              </TouchableOpacity>

              {/* Tombol Tutup (X) Solid Opaque Red */}
              <TouchableOpacity
                style={[styles.modalIconBtn, styles.modalCloseBtn]}
                onPress={handleCloseModal}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Tutup penampil gambar"
              >
                <X size={22} color="#FFFFFF" strokeWidth={2.5} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Canvas Interaktif: Pinch-to-Zoom & Pan melalui ScrollView */}
          <View style={styles.modalCanvasContainer}>
            <ScrollView
              style={styles.modalScrollView}
              contentContainerStyle={styles.modalScrollContent}
              maximumZoomScale={5}
              minimumZoomScale={1}
              bouncesZoom={true}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              centerContent={true}
            >
              <View style={styles.modalImageWrapper}>
                {/* Container Gambar & Floating Tags yang berputar dan zoom bersamaan */}
                <View
                  style={[
                    styles.modalRotatedContainer,
                    {
                      transform: [
                        { rotate: `${rotation}deg` },
                        { scale: zoomScale },
                      ],
                    },
                  ]}
                >
                  <Image
                    source={{ uri: displayPhoto }}
                    style={styles.modalImage}
                    resizeMode="contain"
                  />

                </View>
              </View>

              {/* Tabel Kandungan Gizi di dalam Modal di Bawah Gambar */}
              <View style={styles.modalNutritionSection}>
                <NutritionSummaryTable
                  totalNutrition={totalNutrition}
                  items={displayItems}
                  selectedItem={selectedItem}
                  onSelectItem={setSelectedItem}
                  isDarkTheme={true}
                />
              </View>
            </ScrollView>
          </View>

          {/* Toolbar Bawah: Zoom In, Zoom Out, Rotasi & Reset */}
          <View style={styles.modalBottomBar}>
            <View style={styles.modalControlsPill}>
              <TouchableOpacity
                style={styles.controlPillBtn}
                onPress={handleZoomOut}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Perkecil gambar"
              >
                <ZoomOut size={18} color="#FFFFFF" strokeWidth={2.2} />
              </TouchableOpacity>

              <Text style={styles.zoomScaleText}>{Math.round(zoomScale * 100)}%</Text>

              <TouchableOpacity
                style={styles.controlPillBtn}
                onPress={handleZoomIn}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Perbesar gambar"
              >
                <ZoomIn size={18} color="#FFFFFF" strokeWidth={2.2} />
              </TouchableOpacity>

              <View style={styles.controlDivider} />

              <TouchableOpacity
                style={styles.rotateActionBtn}
                onPress={handleRotate}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Putar gambar 90 derajat"
              >
                <RotateCw size={16} color="#EBA338" strokeWidth={2.2} />
                <Text style={styles.rotateActionText}>Putar 90°</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.resetActionBtn}
                onPress={handleResetZoom}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Reset zoom dan rotasi"
              >
                <RotateCcw size={16} color="#94A3B8" strokeWidth={2} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Panduan hasil server */}
      {hasScanned && (
        <TouchableOpacity
          style={styles.chatFab}
          onPress={() => setIsChatOpen(true)}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Buka panduan gizi"
        >
          <View style={styles.chatFabInner}>
            <View style={styles.chatFabIconBg}>
              <Bot size={20} color="#FFFFFF" strokeWidth={2.4} />
              <View style={styles.chatFabSparklePill}>
                <Sparkles size={8} color="#F59E0B" fill="#F59E0B" />
              </View>
            </View>
            <Text style={styles.chatFabLabel}>Panduan gizi</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Panduan gizi dan keamanan berbasis hasil server */}
      <ContextualAiChatSheet
        visible={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        batchCode={backendScan?.boxId ?? qrToken}
        totalNutrition={totalNutrition}
        detectedItems={displayItems}
        score={effectiveScore}
        holdingTempC={effectiveHoldingTempC}
        verdict={verdict}
      />
    </View>
  );
};

// Komponen Tabel Ringkasan Nutrisi (Sesuai Referensi: Biru & Oranye)
interface NutritionSummaryTableProps {
  totalNutrition: {
    energi: number;
    protein: number;
    lemak: number;
    karbo: number;
    serat: number;
  };
  items: DetectedFoodItem[];
  selectedItem: DetectedFoodItem | null;
  onSelectItem: (item: DetectedFoodItem | null) => void;
  isDarkTheme?: boolean;
}

const NutritionSummaryTable: React.FC<NutritionSummaryTableProps> = ({
  totalNutrition,
  items,
  selectedItem,
  onSelectItem,
  isDarkTheme = false,
}) => {
  // Porsi kecil dikalkulasikan secara proporsional sesuai standar referensi SD awal (~68% porsi besar)
  const porsiKecil = {
    energi: totalNutrition.energi * 0.6817,
    protein: totalNutrition.protein * 0.6327,
    lemak: totalNutrition.lemak * 0.5904,
    karbo: totalNutrition.karbo * 0.7812,
    serat: totalNutrition.serat * 0.8571,
  };

  return (
    <View style={styles.nutritionCardContainer}>
      {/* Pill Badge Kandungan Gizi (Warna Oranye) */}
      <View style={styles.nutritionBadgeWrapper}>
        <View style={styles.nutritionBadge}>
          <Text style={styles.nutritionBadgeText}>Kandungan Gizi</Text>
        </View>
      </View>

      {/* Tabel Biru Modern */}
      <View style={styles.nutritionTable}>
        {/* Table Header Row */}
        <View style={styles.nutritionTableHeaderRow}>
          <View style={styles.nutritionHeaderCol}>
            <Text style={styles.nutritionHeaderText}>Porsi Besar</Text>
          </View>
          <View style={styles.nutritionHeaderDivider} />
          <View style={styles.nutritionHeaderCol}>
            <Text style={styles.nutritionHeaderText}>Porsi Kecil</Text>
          </View>
        </View>

        {/* Row: Energi */}
        <View style={styles.nutritionRow}>
          <View style={styles.nutritionCell}>
            <Text style={styles.nutritionLabel}>Energi</Text>
            <Text style={styles.nutritionColon}>:</Text>
            <Text style={styles.nutritionValue}>{formatNumber(totalNutrition.energi)} kal</Text>
          </View>
          <View style={styles.nutritionCellDivider} />
          <View style={styles.nutritionCell}>
            <Text style={styles.nutritionLabel}>Energi</Text>
            <Text style={styles.nutritionColon}>:</Text>
            <Text style={styles.nutritionValue}>{formatNumber(porsiKecil.energi)} kal</Text>
          </View>
        </View>

        {/* Row: Protein */}
        <View style={styles.nutritionRow}>
          <View style={styles.nutritionCell}>
            <Text style={styles.nutritionLabel}>Protein</Text>
            <Text style={styles.nutritionColon}>:</Text>
            <Text style={styles.nutritionValue}>{formatNumber(totalNutrition.protein)} g</Text>
          </View>
          <View style={styles.nutritionCellDivider} />
          <View style={styles.nutritionCell}>
            <Text style={styles.nutritionLabel}>Protein</Text>
            <Text style={styles.nutritionColon}>:</Text>
            <Text style={styles.nutritionValue}>{formatNumber(porsiKecil.protein)} g</Text>
          </View>
        </View>

        {/* Row: Lemak */}
        <View style={styles.nutritionRow}>
          <View style={styles.nutritionCell}>
            <Text style={styles.nutritionLabel}>Lemak</Text>
            <Text style={styles.nutritionColon}>:</Text>
            <Text style={styles.nutritionValue}>{formatNumber(totalNutrition.lemak)} g</Text>
          </View>
          <View style={styles.nutritionCellDivider} />
          <View style={styles.nutritionCell}>
            <Text style={styles.nutritionLabel}>Lemak</Text>
            <Text style={styles.nutritionColon}>:</Text>
            <Text style={styles.nutritionValue}>{formatNumber(porsiKecil.lemak)} g</Text>
          </View>
        </View>

        {/* Row: Karbo */}
        <View style={styles.nutritionRow}>
          <View style={styles.nutritionCell}>
            <Text style={styles.nutritionLabel}>Karbo</Text>
            <Text style={styles.nutritionColon}>:</Text>
            <Text style={styles.nutritionValue}>{formatNumber(totalNutrition.karbo)} g</Text>
          </View>
          <View style={styles.nutritionCellDivider} />
          <View style={styles.nutritionCell}>
            <Text style={styles.nutritionLabel}>Karbo</Text>
            <Text style={styles.nutritionColon}>:</Text>
            <Text style={styles.nutritionValue}>{formatNumber(porsiKecil.karbo)} g</Text>
          </View>
        </View>

      </View>

      {/* Bahan input untuk kalkulasi dataset gizi */}
      <View style={styles.detectedComponentsContainer}>
        <View style={styles.detectedHeaderRow}>
          <Text
            style={[
              styles.detectedSectionTitle,
              isDarkTheme && styles.detectedSectionTitleDark,
            ]}
          >
            Bahan yang cocok dengan dataset gizi:
          </Text>
          <View style={styles.detectedCountBadge}>
            <Text style={styles.detectedCountText}>{items.length} Kompartemen</Text>
          </View>
        </View>

        {/* Baris Chip yang Bisa Digulir Mendatar (Termasuk Opsi 'Semua') */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.detectedChipsScroll}
        >
          {/* Chip 'Semua' */}
          <TouchableOpacity
            style={[
              styles.detectedChip,
              isDarkTheme && styles.detectedChipDark,
              selectedItem === null && styles.detectedChipActive,
            ]}
            onPress={() => onSelectItem(null)}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Tampilkan semua komponen gizi gabungan"
          >
            <Text
              style={[
                styles.detectedChipText,
                isDarkTheme && styles.detectedChipTextDark,
                selectedItem === null && styles.detectedChipTextActive,
              ]}
            >
              Semua
            </Text>
          </TouchableOpacity>

          {/* Chip Masing-Masing Kompartemen */}
          {items.map((item) => {
            const isChipActive = selectedItem?.id === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.detectedChip,
                  isDarkTheme && styles.detectedChipDark,
                  isChipActive && styles.detectedChipActive,
                ]}
                onPress={() => onSelectItem(isChipActive ? null : item)}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={`Lihat nutrisi ${item.name}`}
              >
                <View
                  style={[
                    styles.detectedChipDot,
                    isChipActive && styles.detectedChipDotActive,
                  ]}
                />
                <Text
                  style={[
                    styles.detectedChipText,
                    isDarkTheme && styles.detectedChipTextDark,
                    isChipActive && styles.detectedChipTextActive,
                  ]}
                >
                  {item.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Kartu Gelap Rincian Item Terpilih (Darker Card) */}
        {selectedItem && (
          <View style={styles.itemDetailCard}>
            <View style={styles.itemDetailHeader}>
              <View style={styles.itemDetailHeaderLeft}>
                <View style={styles.itemDetailBadge}>
                  <Sparkles size={12} color="#F59E0B" strokeWidth={2.4} />
                  <Text style={styles.itemDetailBadgeText}>Data nutrisi server</Text>
                </View>
                <Text style={styles.itemDetailTitle}>{selectedItem.name}</Text>
                <Text style={styles.itemDetailSubtitle}>
                  Estimasi porsi: <Text style={styles.itemDetailGram}>{selectedItem.portionGram} gram</Text>
                </Text>
              </View>

              <TouchableOpacity
                style={styles.itemDetailCloseBtn}
                onPress={() => onSelectItem(null)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Tutup rincian item"
              >
                <X size={16} color="#94A3B8" strokeWidth={2.2} />
              </TouchableOpacity>
            </View>

            {/* Grid Makronutrien Komponen Spesifik */}
            <View style={styles.itemDetailMacroGrid}>
              <View style={styles.itemMacroCol}>
                <Text style={styles.itemMacroLabel}>Energi</Text>
                <Text style={styles.itemMacroValue}>
                  {formatNumber(selectedItem.nutrition.energi)}
                </Text>
                <Text style={styles.itemMacroUnit}>kal</Text>
              </View>

              <View style={styles.itemMacroDivider} />

              <View style={styles.itemMacroCol}>
                <Text style={styles.itemMacroLabel}>Protein</Text>
                <Text style={styles.itemMacroValue}>
                  {formatNumber(selectedItem.nutrition.protein)}
                </Text>
                <Text style={styles.itemMacroUnit}>g</Text>
              </View>

              <View style={styles.itemMacroDivider} />

              <View style={styles.itemMacroCol}>
                <Text style={styles.itemMacroLabel}>Lemak</Text>
                <Text style={styles.itemMacroValue}>
                  {formatNumber(selectedItem.nutrition.lemak)}
                </Text>
                <Text style={styles.itemMacroUnit}>g</Text>
              </View>

              <View style={styles.itemMacroDivider} />

              <View style={styles.itemMacroCol}>
                <Text style={styles.itemMacroLabel}>Karbo</Text>
                <Text style={styles.itemMacroValue}>
                  {formatNumber(selectedItem.nutrition.karbo)}
                </Text>
                <Text style={styles.itemMacroUnit}>g</Text>
              </View>

            </View>
          </View>
        )}
      </View>
    </View>
  );
};

interface ChecklistRow {
  id: string;
  label: string;
  value: string;
  note: string | undefined;
  color: string;
}

const ChecklistSection: React.FC<{
  step: string;
  title: string;
  caption: string;
  rows: ChecklistRow[];
}> = ({ step, title, caption, rows }) => (
  <View style={styles.checklist}>
    <View style={styles.checklistHeader}>
      <Text style={styles.checklistStep}>{step}</Text>
      <View style={styles.checklistHeaderText}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionCaption}>{caption}</Text>
      </View>
    </View>
    {rows.map((row) => (
      <View key={row.id} style={styles.checkRow}>
        <View style={[styles.checkDot, { backgroundColor: row.color }]} />
        <View style={styles.checkText}>
          <Text style={styles.checkLabel}>{row.label}</Text>
          <Text style={styles.checkValue}>{row.value}</Text>
          {row.note ? <Text style={styles.checkNote}>{row.note}</Text> : null}
        </View>
      </View>
    ))}
  </View>
);

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F9F8F6',
  },
  content: {
    paddingTop: 16,
    paddingBottom: 120,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  headerLeftColumn: {
    flex: 1,
    marginRight: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E293B',
    letterSpacing: -0.5,
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    flexWrap: 'wrap',
    gap: 6,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  dotSeparator: {
    color: '#64748B',
    fontSize: 13,
  },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#FDEBC8',
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7C4A03',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EBA338',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  // Redesigned Scan Card (Hanya muncul sebelum pemindaian)
  scanCard: {
    backgroundColor: '#EAA016',
    borderRadius: 24,
    marginHorizontal: 16,
    marginTop: 6,
    padding: 20,
    shadowColor: '#B45309',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    elevation: 5,
  },
  topBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  rightBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.12)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
  },
  scanCardTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.4,
    lineHeight: 28,
    marginTop: 18,
  },
  scanCardDescription: {
    fontSize: 13.5,
    fontWeight: '400',
    color: 'rgba(255, 255, 255, 0.95)',
    lineHeight: 20,
    marginTop: 10,
  },
  scanInputs: {
    gap: 8,
    marginTop: 14,
  },
  scanInput: {
    minHeight: 42,
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    color: '#0F172A',
    fontSize: 13,
  },
  scanTemperatureRow: {
    flexDirection: 'row',
    gap: 8,
  },
  scanTemperatureInput: {
    flex: 1,
    minWidth: 0,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 22,
  },
  primaryScanButton: {
    flex: 1,
    height: 48,
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  primaryScanButtonText: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  helpButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Kartu Foto Hasil Jepretan Kamera yang Menggantikan Kartu Oranye
  capturedImageHeroCard: {
    marginHorizontal: 16,
    marginTop: 6,
    height: 240,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
    position: 'relative',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 6,
  },
  capturedImageHeroPressable: {
    width: '100%',
    height: '100%',
  },
  capturedImageHero: {
    width: '100%',
    height: '100%',
  },
  // Floating UI Tags di Atas Makanan (YOLOv8 Detection Overlays)
  floatingTag: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.28)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.45,
    shadowRadius: 4,
    elevation: 8,
    transform: [{ translateX: -40 }, { translateY: -12 }],
    zIndex: 20,
  },
  modalFloatingTag: {
    transform: [{ translateX: -42 }, { translateY: -14 }],
    zIndex: 25,
  },
  floatingTagSelected: {
    borderColor: '#F59E0B',
    borderWidth: 1.8,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    shadowColor: '#F59E0B',
    shadowOpacity: 0.55,
    shadowRadius: 8,
    elevation: 12,
  },
  floatingTagDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#38BDF8', // Aksen cyan glowing
  },
  floatingTagDotSelected: {
    backgroundColor: '#F59E0B', // Oranye hangat ketika aktif
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  floatingTagText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  floatingTagTextSelected: {
    color: '#FDE68A',
    fontWeight: '800',
  },
  capturedImageOverlayTop: {
    position: 'absolute',
    top: 14,
    left: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 6,
  },
  capturedPhotoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  capturedPhotoPillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  retakeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  retakeButtonText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '600',
  },
  capturedImageOverlayBottom: {
    position: 'absolute',
    bottom: 14,
    right: 14,
    zIndex: 6,
  },
  zoomHintBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.82)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  zoomHintText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700',
  },
  // Tabel Ringkasan Kandungan Gizi (Inspirasi Referensi: Biru & Oranye)
  nutritionCardContainer: {
    marginHorizontal: 16,
    marginTop: 22,
    alignItems: 'center',
  },
  nutritionBadgeWrapper: {
    marginBottom: -16,
    zIndex: 10,
    elevation: 8,
  },
  nutritionBadge: {
    backgroundColor: '#F59E0B', // Oranye hangat mencolok
    paddingHorizontal: 22,
    paddingVertical: 7,
    borderRadius: 999,
    shadowColor: '#B45309',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 5,
  },
  nutritionBadgeText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F2C59',
    letterSpacing: -0.2,
  },
  nutritionTable: {
    width: '100%',
    backgroundColor: '#0C4A94', // Biru royal khas referensi
    borderRadius: 18,
    paddingTop: 24,
    paddingBottom: 16,
    paddingHorizontal: 12,
    shadowColor: '#0C4A94',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  nutritionTableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.25)',
    marginBottom: 8,
  },
  nutritionHeaderCol: {
    flex: 1,
    alignItems: 'center',
  },
  nutritionHeaderText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  nutritionHeaderDivider: {
    width: 1,
    height: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  nutritionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
  },
  nutritionRowLast: {
    paddingBottom: 4,
  },
  nutritionCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  nutritionCellDivider: {
    width: 1,
    height: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  nutritionLabel: {
    width: 58,
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  nutritionColon: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    marginRight: 6,
  },
  nutritionValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  // Bagian: Komponen Terdeteksi YOLOv8
  detectedComponentsContainer: {
    width: '100%',
    marginTop: 18,
  },
  detectedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  detectedSectionTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#1E293B',
  },
  detectedSectionTitleDark: {
    color: '#E2E8F0',
  },
  detectedCountBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.16)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  detectedCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },
  detectedChipsScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  detectedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  detectedChipDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  detectedChipActive: {
    backgroundColor: '#0C4A94',
    borderColor: '#0C4A94',
    shadowColor: '#0C4A94',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  detectedChipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0EA5E9',
  },
  detectedChipDotActive: {
    backgroundColor: '#F59E0B',
  },
  detectedChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  detectedChipTextDark: {
    color: '#94A3B8',
  },
  detectedChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  // Kartu Gelap Detail Item Terpilih (Darker Card)
  itemDetailCard: {
    width: '100%',
    marginTop: 14,
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  itemDetailHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  itemDetailHeaderLeft: {
    flex: 1,
  },
  itemDetailBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  itemDetailBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#F59E0B',
  },
  itemDetailTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  itemDetailSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  itemDetailGram: {
    fontWeight: '700',
    color: '#38BDF8',
  },
  itemDetailCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemDetailMacroGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  itemMacroCol: {
    flex: 1,
    alignItems: 'center',
  },
  itemMacroDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  itemMacroLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 2,
  },
  itemMacroValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  itemMacroUnit: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 1,
  },
  // Initial / Default Empty State (Indonesian)
  emptyStateContainer: {
    marginHorizontal: 16,
    marginTop: 24,
    paddingVertical: 40,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#EDEEF0',
    borderStyle: 'dashed',
  },
  emptyStateIconWrapper: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyStateTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
    textAlign: 'center',
    marginBottom: 6,
  },
  emptyStateDescription: {
    fontSize: 12.5,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 290,
  },
  // Scanned State
  scannedResults: {
    marginTop: 8,
  },
  scannedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 18,
  },
  // Segmented Control (Pill Switcher)
  segmentedControlWrapper: {
    paddingHorizontal: 16,
    marginTop: 14,
    marginBottom: 4,
  },
  segmentedControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EDEEF0',
    borderRadius: 999,
    padding: 4,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 10,
    borderRadius: 999,
  },
  segmentBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  segmentBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  segmentBtnTextActive: {
    color: '#0C4A94',
    fontWeight: '800',
  },
  viewContainer: {
    width: '100%',
  },
  // Contextual AI Consult Cards & Banners
  aiConsultCard: {
    marginHorizontal: 16,
    marginTop: 24,
    backgroundColor: '#EFF6FF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  aiConsultLeft: {
    flex: 1,
  },
  aiConsultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  aiConsultBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  aiConsultTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E3A8A',
    marginBottom: 2,
  },
  aiConsultDescription: {
    fontSize: 11.5,
    color: '#3B82F6',
    lineHeight: 16,
  },
  aiConsultActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#0C4A94',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0C4A94',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  safetyAiBanner: {
    marginHorizontal: 16,
    marginTop: 20,
    backgroundColor: '#F0FDF4',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  safetyAiBannerLeft: {
    flex: 1,
  },
  safetyAiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  safetyAiBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#15803D',
  },
  safetyAiTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#14532D',
    marginBottom: 2,
  },
  safetyAiCaption: {
    fontSize: 11.5,
    color: '#16A34A',
    lineHeight: 16,
  },
  safetyAiActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#15803D',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#15803D',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  // Floating Action Button (FAB)
  chatFab: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 28 : 20,
    right: 16,
    zIndex: 99,
    borderRadius: 999,
    backgroundColor: '#0F172A',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  chatFabInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 8,
  },
  chatFabIconBg: {
    position: 'relative',
  },
  chatFabSparklePill: {
    position: 'absolute',
    top: -4,
    right: -6,
    backgroundColor: '#FEF3C7',
    borderRadius: 6,
    padding: 1,
  },
  chatFabLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  scannedBatchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  scannedBatchCode: {
    fontSize: 12,
    fontWeight: '700',
    color: '#15803D',
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#EDEEF0',
  },
  resetButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  scenarioRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginTop: 14,
  },
  scenarioChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E7E9EC',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  scenarioChipActive: {
    backgroundColor: '#1E293B',
    borderColor: '#1E293B',
  },
  scenarioText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  scenarioTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  checklist: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  checklistHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  checklistStep: {
    fontSize: 11,
    fontWeight: '800',
    color: '#7C4A03',
    backgroundColor: '#FDEBC8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
  checklistHeaderText: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1E293B',
    letterSpacing: -0.3,
  },
  sectionCaption: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 3,
    lineHeight: 17,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#EDEEF0',
  },
  checkDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginTop: 6,
  },
  checkText: {
    flex: 1,
  },
  checkLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
  checkValue: {
    fontSize: 13,
    color: '#334155',
    marginTop: 2,
    lineHeight: 18,
  },
  checkNote: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  decisionCard: {
    marginHorizontal: 16,
    marginTop: 28,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 2,
    padding: 20,
  },
  decisionStep: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
  },
  decisionScoreRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginTop: 6,
  },
  decisionScore: {
    fontSize: 52,
    fontWeight: '800',
    letterSpacing: -2,
  },
  decisionScoreUnit: {
    fontSize: 13,
    color: '#64748B',
  },
  decisionLabel: {
    fontSize: 20,
    fontWeight: '800',
    marginTop: 2,
  },
  decisionAction: {
    fontSize: 14,
    color: '#1E293B',
    lineHeight: 21,
    marginTop: 8,
  },
  decisionAiMeta: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 6,
  },
  reasonList: {
    marginTop: 12,
    gap: 4,
  },
  reasonText: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
  },
  holdingRow: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#EDEEF0',
  },
  holdingText: {
    fontSize: 12,
    color: '#64748B',
  },
  macroSection: {
    marginTop: 28,
    paddingHorizontal: 16,
  },
  macroRow: {
    marginTop: 14,
  },
  macroLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  macroValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 2,
  },
  macroTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E7E9EC',
    marginTop: 6,
  },
  macroFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#B45309',
  },
  macroPercent: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 28,
    paddingHorizontal: 16,
  },
  secondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E7E9EC',
  },
  dangerBtn: {
    borderColor: '#F0B4B4',
    backgroundColor: '#FDF0F0',
  },
  secondaryBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: '#EBA338',
  },
  primaryBtnBlocked: {
    backgroundColor: '#E7E9EC',
  },
  primaryBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E293B',
  },
  localRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 20,
    paddingHorizontal: 16,
  },
  localText: {
    flex: 1,
    fontSize: 11,
    color: '#64748B',
    lineHeight: 16,
  },
  sheetVerdict: {
    borderRadius: 14,
    borderWidth: 2,
    padding: 14,
    marginBottom: 12,
  },
  sheetVerdictLabel: {
    fontSize: 17,
    fontWeight: '800',
  },
  sheetVerdictAction: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 19,
    marginTop: 4,
  },
  sheetReason: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
    marginBottom: 4,
  },
  // Modal Penampil Gambar Layar Penuh (Interactive Lightbox Viewer)
  modalBackdrop: {
    flex: 1,
    backgroundColor: '#090D16',
    justifyContent: 'space-between',
  },
  modalTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: Platform.OS === 'ios' ? 54 : 20,
    paddingBottom: 14,
    backgroundColor: 'rgba(9, 13, 22, 0.88)',
    zIndex: 10,
  },
  modalTitleContainer: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  modalTopActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modalIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTagToggleBtnActive: {
    backgroundColor: '#D97706', // 100% Solid opaque orange/mustard theme (sama pekatnya dengan tombol merah)
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4,
  },
  modalTagToggleBtnInactive: {
    backgroundColor: '#334155', // Solid opaque dark slate saat nonaktif
  },
  modalRotateBtn: {
    backgroundColor: '#1E293B', // Solid opaque dark slate
  },
  modalCloseBtn: {
    backgroundColor: '#DC2626', // 100% Solid opaque red
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4,
  },
  modalCanvasContainer: {
    flex: 1,
  },
  modalScrollView: {
    flex: 1,
    width: '100%',
  },
  modalScrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  modalImageWrapper: {
    width: SCREEN_WIDTH - 24,
    height: SCREEN_HEIGHT * 0.52,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalRotatedContainer: {
    width: SCREEN_WIDTH - 24,
    height: SCREEN_HEIGHT * 0.52,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalImage: {
    width: '100%',
    height: '100%',
  },
  modalNutritionSection: {
    width: '100%',
    marginTop: 10,
    paddingBottom: 30,
  },
  modalBottomBar: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    alignItems: 'center',
    zIndex: 10,
  },
  modalControlsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(20, 27, 45, 0.92)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    gap: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  controlPillBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomScaleText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    minWidth: 44,
    textAlign: 'center',
  },
  controlDivider: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  rotateActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  rotateActionText: {
    color: '#EBA338',
    fontSize: 12.5,
    fontWeight: '700',
  },
  resetActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
