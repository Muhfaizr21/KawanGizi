import React, { useEffect } from 'react';
import { DefaultTheme, ThemeProvider, Slot } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { StatusBar, Platform, LogBox } from 'react-native';
import { AuthProvider } from '../context/AuthContext';
import { RoleProvider } from '../context/RoleContext';
import { CommunityProvider } from '../context/CommunityContext';

// Abaikan warning New Architecture untuk layout animation
LogBox.ignoreLogs(['setLayoutAnimationEnabledExperimental']);

SplashScreen.preventAutoHideAsync().catch(() => {});

const AppTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#FFFFFF',
    card: '#FFFFFF',
    text: '#1E293B',
    primary: '#EBA338',
  },
};

export default function RootLayout() {
  useEffect(() => {
    // Sembunyikan splash screen
    SplashScreen.hideAsync().catch(() => {});

    // Untuk lingkungan Web / PWA: atur meta theme-color menjadi putih
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      let metaThemeColor = document.querySelector('meta[name="theme-color"]');
      if (!metaThemeColor) {
        metaThemeColor = document.createElement('meta');
        metaThemeColor.setAttribute('name', 'theme-color');
        document.head.appendChild(metaThemeColor);
      }
      metaThemeColor.setAttribute('content', '#ffffff');
    }
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider value={AppTheme}>
        <AuthProvider>
          <RoleProvider>
            <CommunityProvider>
              <StatusBar backgroundColor="#ffffff" barStyle="dark-content" translucent={false} />
              <ExpoStatusBar style="dark" />
              <Slot />
            </CommunityProvider>
          </RoleProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
