/**
 * App.js
 * 
 * Root component with initialization, update checks, and error boundaries.
 * 
 * Initialization flow:
 * 1. Load fonts (3.8s minimum for splash screen)
 * 2. Check for forced updates (with offline fallback, max 7 days)
 * 3. Initialize analytics & IAP
 * 4. Render app with error boundary
 * 
 * Features:
 * - Forced update check via remote config
 * - Offline mode (max 7 days without internet)
 * - Sentry error boundary with GDPR-compliant scope
 * - Custom error screen for crashes
 * - StatusBar background for edge-to-edge design
 * - IAP initialization (optional, won't block app)
 */

import * as Font from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { useState, useEffect } from 'react';
import { View, Platform, Alert } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import Navigation from './navigation/Navigation';
import { SavedQuestionsProvider } from './contexts/SavedQuestionsContext';
import { PopupProvider } from './contexts/PopupContext';
import { FavoriteTabAnimationProvider } from './contexts/FavoriteTabAnimationContext';
import { initSentry } from './sentry';
import * as Sentry from '@sentry/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SplashScreen from './components/SplashScreen';
import { logCriticalError, logAsyncStorageError, resetErrorSession } from './utils/logError';
import InterText from './components/InterText';
import { initializeAnalytics, getAnalyticsStatus } from './utils/analytics';
import Constants from 'expo-constants';
import { Linking } from 'react-native';
import { iapService } from './utils/iapService';

// Sentry initialisieren
initSentry();

const UPDATE_STORAGE_KEY = 'lastUpdateCheck';
const MAX_OFFLINE_DAYS = 7;

// StatusBar background for Android edge-to-edge design
const StatusBarBackground = () => {
  const insets = useSafeAreaInsets();
  
  return (
    <>
      <View 
        style={{
          height: insets.top,
          backgroundColor: '#c0897f',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 999,
        }}
      />
      
      <View 
        style={{
          height: insets.bottom,
          backgroundColor: '#c0897f',
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 999,
        }}
      />
    </>
  );
};

// Production-ready error screen with user instructions
const ErrorInformationScreen = ({ error }) => {
  return (
    <>
      <StatusBar style="dark" />
      <View style={styles.errorInfoContainer}>
        <View style={styles.errorInfoContent}>
          <View style={styles.errorIconContainer}>
            <InterText style={styles.errorIcon}>⚠️</InterText>
          </View>

          <InterText style={styles.errorInfoTitle}>
            App ist abgestürzt
          </InterText>

          <InterText style={styles.errorInfoMessage}>
            Es ist ein unerwarteter Fehler aufgetreten. Der Fehler wurde automatisch an unser Entwicklungsteam gesendet.
          </InterText>

          <InterText style={styles.errorInfoMessage}>
            Wir arbeiten bereits an einer schnellen Lösung.
          </InterText>

          <View style={styles.instructionsContainer}>
            <InterText style={styles.instructionsTitle}>
              Was kannst du jetzt tun:
            </InterText>
            
            <InterText style={styles.instructionText}>
              • Schließe die App vollständig
            </InterText>
            <InterText style={styles.instructionText}>
              • Starte die App erneut
            </InterText>
            <InterText style={styles.instructionText}>
              • Falls das Problem weiterhin besteht, kontaktiere den Support
            </InterText>
          </View>

          <View style={styles.statusContainer}>
            <InterText style={styles.statusText}>
              ✓ Fehlerbericht wurde gesendet
            </InterText>
          </View>
        </View>
      </View>
    </>
  );
};

export default function App() {
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [updateRequired, setUpdateRequired] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(true);
  const [splashMinimumPassed, setSplashMinimumPassed] = useState(false);
  const [appInitialized, setAppInitialized] = useState(false);

  // Reset error session on app start
  useEffect(() => {
    resetErrorSession();
  }, []);

  // Initialize IAP (optional, won't block app if it fails)
  useEffect(() => {
    const initIAP = async () => {
      try {
        await iapService.initialize();
      } catch (error) {
        // Silent fail - IAP is optional and should not block app initialization
      }
    };

    if (fontsLoaded) {
      initIAP();
    }

    return () => {
      iapService.cleanup();
    };
  }, [fontsLoaded]);

  // Load fonts
  useEffect(() => {
    const loadFonts = async () => {
      try {
        await Font.loadAsync({
          'Inter-Regular': require('./assets/fonts/Inter-Regular.ttf'),
          'Inter-Bold': require('./assets/fonts/Inter-Bold.ttf'),
          'Inter-Italic': require('./assets/fonts/Inter-Italic.ttf'),
          'Inter-BoldItalic': require('./assets/fonts/Inter-BoldItalic.ttf'),
        });
        setFontsLoaded(true);
      } catch (error) {
        // Only log actual component crashes, not expo-font exceptions
        const isComponentCrash = 
          error.name === 'TypeError' || 
          error.name === 'ReferenceError';
        
        // Expo-font sometimes throws exceptions with 'code' and 'info' properties
        // These are usually harmless (e.g., "already loaded")
        const isExpoFontException = error.code !== undefined || error.info !== undefined;
        
        if (isComponentCrash && !isExpoFontException) {
          logCriticalError(error, 'App', 'loadFonts', {
            fingerprint: ['App-loadFonts-critical'],
            tags: {
              component: 'App',
              errorType: 'critical',
              critical: true,
              feature: 'initialization'
            },
            extra: {
              componentName: 'App',
              method: 'loadFonts',
              critical: true
            },
            severity: 'error'
          });
        }
        
        // Continue anyway - fonts are probably loaded
        setFontsLoaded(true);
      }
    };
  
    loadFonts();
  }, []);

  // Splash screen minimum time (3.8s)
  useEffect(() => {
    const timer = setTimeout(() => {
      setSplashMinimumPassed(true);
    }, 3800);
  
    return () => clearTimeout(timer);
  }, []);


  // Check for forced updates (with offline fallback, max 7 days)  
  useEffect(() => {
    const checkForUpdate = async () => {
      try {
        const response = await fetch('https://zusammenwachsenapp.de/update.json');
        const data = await response.json();
        const currentVersion = Constants.expoConfig?.version;
    
        // Save successful check for offline usage
        await AsyncStorage.setItem(UPDATE_STORAGE_KEY, JSON.stringify({
          timestamp: Date.now(),
          appVersion: currentVersion,
          versionOk: !(data.forceUpdate && compareVersions(currentVersion, data.minimumVersion) < 0)
        }));


        if (data.forceUpdate && compareVersions(currentVersion, data.minimumVersion) < 0) {
          Alert.alert(
            "Diese Version der App ist veraltet. Bitte aktualisiere sie, um fortzufahren.",
            data.updateMessage,
            [
              {
                text: "Aktualisieren",
                onPress: () => Linking.openURL(data.updateUrl),
              },
            ],
            { cancelable: false }
          );
          setUpdateRequired(true);
          return;
        }
      
      } catch (error) {
        // Offline fallback: check last successful update check
        try {
          const saved = await AsyncStorage.getItem(UPDATE_STORAGE_KEY);
          if (saved) {
            const { timestamp, versionOk } = JSON.parse(saved);
            const daysOffline = (Date.now() - timestamp) / (1000 * 60 * 60 * 24);
            if (!versionOk || daysOffline > MAX_OFFLINE_DAYS) {
              Alert.alert(
                "Verbindung erforderlich",
                "Bitte verbinde dich mit dem Internet, um die App weiter zu nutzen.",
                [],
                { cancelable: false }
              );
              setUpdateRequired(true);
            }
          } else {
            // No previous check - require internet
            Alert.alert(
              "Verbindung erforderlich",
              "Bitte verbinde dich mit dem Internet, um die App zu starten.",
              [],
              { cancelable: false }
            );
            setUpdateRequired(true);
          }
        } catch (innerError) {
          logAsyncStorageError(innerError, 'getItem', UPDATE_STORAGE_KEY, {
            fingerprint: ['App-offlineCheck-storage'],
            tags: {
              component: 'App',
              errorType: 'storage',
              critical: true,
              feature: 'offline-support'
            },
            extra: {
              componentName: 'App',
              method: 'offlineCheck',
              critical: true
            },
            severity: 'error'
          });
        }
      } finally {
        setCheckingUpdate(false);
      }
    };

    if (fontsLoaded) {
      checkForUpdate();
    }
  }, [fontsLoaded]);

  // Initialize analytics
  useEffect(() => {
    const initAnalytics = async () => {
      await initializeAnalytics();
    };

    if (fontsLoaded && !checkingUpdate) {
      initAnalytics();
    }
  }, [fontsLoaded, checkingUpdate]);

  // Track initialization completion
  useEffect(() => {
    if (fontsLoaded && !checkingUpdate && splashMinimumPassed) {
      setAppInitialized(true);
    }
  }, [fontsLoaded, checkingUpdate, splashMinimumPassed]);

  // Loading States
  if (!fontsLoaded || checkingUpdate || !splashMinimumPassed) {
    return (
      <>
        <StatusBar style="dark" />
        <SplashScreen />
      </>
    );
  }

  if (updateRequired) {
    return (
      <>
        <StatusBar style="dark" />
        <View style={{ flex: 1, backgroundColor: '#fff' }} />
      </>
    );
  }

  try {
    return (
      <Sentry.ErrorBoundary
        fallback={({ error, resetError }) => (
          <ErrorInformationScreen error={error} />
        )}
        beforeCapture={(scope, error, errorInfo) => {
          // DSGVO: Only minimal, anonymous data
          scope.setContext("ErrorBoundary", {
            location: "App.js",
            appInitialized,
            fontsLoaded,
            checkingUpdate,
            splashMinimumPassed,
          });
          
          scope.setTag("error_boundary_location", "app_root");
          scope.setTag("app_state", appInitialized ? "initialized" : "initializing");
          scope.setLevel("error");
          
          // Clear user data
          scope.setUser({});
          
          // Remove all sensitive contexts
          scope.setContext("device", null);
          scope.setContext("app", null);
          scope.setContext("os", null);
          scope.setContext("browser", null);
          scope.setContext("runtime", null);
        }}
      >
        <SavedQuestionsProvider>
          <PopupProvider>
            <FavoriteTabAnimationProvider>
              <SafeAreaProvider>
                <StatusBar style="dark" />
                {Platform.OS === 'android' && <StatusBarBackground />}
                <Navigation />
              </SafeAreaProvider>
            </FavoriteTabAnimationProvider>
          </PopupProvider>
        </SavedQuestionsProvider>
      </Sentry.ErrorBoundary>
    );
  } catch (error) {
    logCriticalError(error, 'App', 'render', {
      fingerprint: ['App-render-critical'],
      tags: {
        component: 'App',
        errorType: 'critical',
        critical: true,
        feature: 'render'
      },
      extra: {
        componentName: 'App',
        method: 'render',
        critical: true
      },
      severity: 'error'
    });

    return (
      <>
        <StatusBar style="dark" />
        <View style={styles.fallbackContainer}>
          <InterText style={styles.fallbackText}>
            App konnte nicht geladen werden. Bitte starte neu.
          </InterText>
        </View>
      </>
    );
  }
}

// Semantic version comparison (major.minor.patch)
function compareVersions(v1, v2) {
  if (!v1 || !v2) return 0;
  
  const v1parts = v1.split('.').map(Number);
  const v2parts = v2.split('.').map(Number);
  
  for (let i = 0; i < Math.max(v1parts.length, v2parts.length); i++) {
    const a = v1parts[i] || 0;
    const b = v2parts[i] || 0;
    if (a > b) return 1;
    if (a < b) return -1;
  }
  return 0;
}

const styles = {
  errorInfoContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorInfoContent: {
    maxWidth: 320,
    alignItems: 'center',
  },
  errorIconContainer: {
    marginBottom: 24,
  },
  errorIcon: {
    fontSize: 48,
    textAlign: 'center',
  },
  errorInfoTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#212529',
    textAlign: 'center',
    marginBottom: 16,
  },
  errorInfoMessage: {
    fontSize: 16,
    color: '#6c757d',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 16,
  },
  instructionsContainer: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginVertical: 24,
    borderLeftWidth: 4,
    borderLeftColor: '#c0897f',
    width: '100%',
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#212529',
    marginBottom: 12,
  },
  instructionText: {
    fontSize: 14,
    color: '#495057',
    lineHeight: 20,
    marginBottom: 8,
  },
  statusContainer: {
    backgroundColor: '#d4edda',
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#28a745',
    marginBottom: 16,
    width: '100%',
  },
  statusText: {
    fontSize: 14,
    color: '#155724',
    marginBottom: 4,
  },
  fallbackContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  fallbackText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#d32f2f',
  },
};