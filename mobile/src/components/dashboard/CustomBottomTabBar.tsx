import React from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Platform,
  LayoutAnimation,
  UIManager,
  LogBox,
} from 'react-native';
import { Home, Camera, FileText, Users, LucideIcon } from 'lucide-react-native';

// Abaikan warning New Architecture untuk layout animation
LogBox.ignoreLogs(['setLayoutAnimationEnabledExperimental']);

// Hanya aktifkan pada Android arsitektur legacy jika UIManager tersedia
if (
  Platform.OS === 'android' &&
  typeof UIManager.setLayoutAnimationEnabledExperimental === 'function' &&
  !(globalThis as any)?.nativeFabricUIManager
) {
  try {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  } catch {
    // Abaikan jika dijalankan di React Native New Architecture di mana LayoutAnimation aktif default
  }
}

export type TabKey = 'home' | 'action' | 'journey' | 'community' | 'profile';

export interface TabDefinition {
  key: TabKey;
  label: string;
  icon: LucideIcon;
  hint: string;
}

export const VALIDATOR_TABS: TabDefinition[] = [
  { key: 'home', label: 'Beranda', icon: Home, hint: 'Beranda dan ringkasan kuota MBG' },
  { key: 'action', label: 'Skrining', icon: Camera, hint: 'Pindai boks & evaluasi gizi AI' },
  { key: 'journey', label: 'Riwayat', icon: FileText, hint: 'Riwayat BAST dan presensi kehadiran' },
  { key: 'community', label: 'Komunitas', icon: Users, hint: 'Forum komunikasi sesama guru validator' },
];

export const GUEST_TABS: TabDefinition[] = [
  { key: 'action', label: 'Skrining', icon: Camera, hint: 'Pindai boks & evaluasi gizi AI' },
  { key: 'community', label: 'Komunitas', icon: Users, hint: 'Forum komunikasi sesama guru validator' },
];

export const TABS = VALIDATOR_TABS;

const INACTIVE = '#64748B';
const ACTIVE_ORANGE = '#EBA338';
const ACTIVE_ICON_COLOR = '#1E293B';

export interface CustomBottomTabBarProps {
  activeTab: TabKey;
  onTabPress: (tab: TabKey) => void;
  onCenterActionPress?: () => void;
  isGuest?: boolean;
}

export const CustomBottomTabBar: React.FC<CustomBottomTabBarProps> = ({
  activeTab,
  onTabPress,
  isGuest = false,
}) => {
  const handleTabPress = (key: TabKey) => {
    if (Platform.OS !== 'web') {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    onTabPress(key);
  };

  const displayedTabs = isGuest ? GUEST_TABS : VALIDATOR_TABS;

  return (
    <View style={styles.outerContainer} accessibilityRole="tablist">
      <View style={styles.barContainer}>
        {displayedTabs.map((tab) => {
          const isActive = activeTab === tab.key;
          const Icon = tab.icon;

          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tabButton, isActive && styles.tabButtonActive]}
              onPress={() => handleTabPress(tab.key)}
              activeOpacity={0.8}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={tab.label}
              accessibilityHint={tab.hint}
            >
              {isActive ? (
                /* Dynamic Floating Action Circle: Flat solid orange, no stroke/border, dark icon */
                <View style={styles.activeCircle}>
                  <Icon size={24} color={ACTIVE_ICON_COLOR} strokeWidth={2.6} />
                </View>
              ) : (
                /* Standard Inactive Icon */
                <View style={styles.iconWrapper}>
                  <Icon size={22} color={INACTIVE} strokeWidth={2} />
                </View>
              )}

              {/* Text Label */}
              <Text
                style={[
                  styles.tabLabel,
                  isActive && styles.tabLabelActive,
                ]}
                numberOfLines={1}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
    alignItems: 'center',
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    zIndex: 999,
  },
  barContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '92%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E7E9EC',
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  tabButton: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingVertical: 4,
  },
  tabButtonActive: {
    zIndex: 10,
  },
  iconWrapper: {
    padding: 6,
    borderRadius: 14,
  },
  activeCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: ACTIVE_ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -18,
    marginBottom: 2,
  },
  tabLabel: {
    fontSize: 11,
    color: INACTIVE,
    fontWeight: '500',
    marginTop: 2,
  },
  tabLabelActive: {
    color: '#7C4A03',
    fontWeight: '700',
  },
});
