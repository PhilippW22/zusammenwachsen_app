/**
 * Navigation.jsx
 * 
 * Root navigation container with deep linking support and error boundaries.
 * 
 * Error handling:
 * - SafeAreaProvider failure: falls back to View wrapper
 * - NavigationContainer failure: shows error screen
 * - Deep linking failure: app continues without deep links
 */

import React, { useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View } from 'react-native';
import DrawerMenu from './DrawerMenu';
import { useDeepLinking } from './useDeepLinking';
import { logUIRenderError } from '../utils/logError';
import InterText from '../components/InterText';

export default function Navigation() {
  const [navigationFailed, setNavigationFailed] = useState(false);

  // Deep linking is optional - app works without it
  const getNavigationRef = () => {
    try {
      const navigationRef = useDeepLinking();
      return navigationRef;
    } catch (error) {
      return null; // App continues without deep linking
    }
  };

  const navigationRef = getNavigationRef();

  const renderNavigationContainer = () => {
    try {
      return (
        <NavigationContainer 
          ref={navigationRef}
          onUnhandledAction={(action) => {
            // Silent - only for extreme debugging in development
          }}
        >
          <DrawerMenu />
        </NavigationContainer>
      );
    } catch (error) {
      logUIRenderError(error, 'Navigation', 'renderNavigationContainer');

      setNavigationFailed(true);
      return renderNavigationFallback();
    }
  };

  const renderSafeAreaProvider = () => {
    try {
      return (
        <SafeAreaProvider>
          {renderNavigationContainer()}
        </SafeAreaProvider>
      );
    } catch (error) {
      // SafeAreaProvider failure: use plain View as fallback
      return renderWithViewFallback();
    }
  };

  const renderNavigationFallback = () => (
    <View style={styles.errorContainer}>
      <InterText style={styles.errorTitle}>Navigation-Fehler</InterText>
      <InterText style={styles.errorText}>
        Die App-Navigation konnte nicht geladen werden. Bitte starte die App neu.
      </InterText>
    </View>
  );

  const renderWithViewFallback = () => (
    <View style={styles.fallbackContainer}>
      {renderNavigationContainer()}
    </View>
  );

  if (navigationFailed) {
    return renderNavigationFallback();
  }

  return renderSafeAreaProvider();
}

const styles = {
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#d32f2f',
    marginBottom: 10,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
  fallbackContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
};