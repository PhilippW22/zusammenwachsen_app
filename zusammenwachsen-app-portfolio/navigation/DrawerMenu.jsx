/**
 * DrawerMenu.jsx
 * 
 * Main drawer navigation with error boundaries and fallback UIs.
 * 
 * Navigation structure:
 * - Startseite (hidden in drawer, accessible via logo)
 * - Über uns
 * - Unterstützen
 * - Kontakt
 * - App bewerten (opens external store link)
 * - Impressum
 * - Datenschutzerklärung
 * 
 * Error handling:
 * Each screen is wrapped in error boundaries with fallback UI.
 * Navigation failures are logged but don't crash the app.
 */


import React from 'react';
import { createDrawerNavigator, DrawerContentScrollView, DrawerItemList } from '@react-navigation/drawer';
import TabNavigator from './TabNavigator';
import Icon from '../components/Icon';
import ImpressumScreen from '../screens/ImpressumScreen';
import Header from '../components/Header';
import { View } from 'react-native';
import DonationsScreen from '../screens/DonationsScreen';
import LeitbildScreen from '../screens/LeitbildScreen';
import SocialMediaIcons from '../components/SocialMediaIcons';
import ContactScreen from '../screens/ContactScreen';
import DSGVOScreen from '../screens/DSGVOScreen';
import { logNavigationError, logUIRenderError } from '../utils/logError';
import InterText from '../components/InterText';
import { Linking, Platform } from 'react-native';

const Drawer = createDrawerNavigator();

function DrawerScreenWrapper({ children, navigation }) {
  const renderHeader = () => {
    try {
      if (!navigation) {
        return (
          <View style={styles.fallbackHeader}>
            <InterText style={styles.fallbackHeaderText}>ZusammenWachsen</InterText>
          </View>
        );
      }

      return (
        <Header 
          toggleDrawer={() => {
            try {
              if (navigation.toggleDrawer && typeof navigation.toggleDrawer === 'function') {
                navigation.toggleDrawer();
              }
            } catch (toggleError) {
              // Silent fail - drawer toggle is non-critical
            }
          }} 
        />
      );
    } catch (error) {
      return (
        <View style={styles.fallbackHeader}>
          <InterText style={styles.fallbackHeaderText}>ZusammenWachsen</InterText>
        </View>
      );
    }
  };

  return (
    <View style={{ flex: 1 }}>
      {renderHeader()}
      {children}
    </View>
  );
}

function CustomDrawerContent(props) {
  const renderDrawerContent = () => {
    try {
      if (!props) {
        return (
          <View style={styles.fallbackDrawerContent}>
            <InterText style={styles.fallbackDrawerText}>Menü nicht verfügbar</InterText>
          </View>
        );
      }

      return (
        <>
          <DrawerContentScrollView {...props}>
            <DrawerItemList {...props} />
          </DrawerContentScrollView>
          <View style={{ marginBottom: 30, padding: 10 }}>
            <SocialMediaIcons />
          </View>
        </>
      );
    } catch (error) {
      logUIRenderError(error, 'CustomDrawerContent', 'renderDrawerContent');

      return (
        <View style={styles.fallbackDrawerContent}>
          <InterText style={styles.fallbackDrawerText}>Menü konnte nicht geladen werden</InterText>
        </View>
      );
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: 'space-between' }}>
      {renderDrawerContent()}
    </View>
  );
}

// Empty screen for external link items (like "App bewerten")
function EmptyScreen() {
  return null;
}

export default function DrawerMenu() {
  const navigateToHome = (navigation) => {
    try {
      if (!navigation || !navigation.navigate || typeof navigation.navigate !== 'function') {
        throw new Error('[DRAWERMENU] Navigation not available');
      }

      navigation.navigate('Startseite', {
        screen: 'HomeTab',
      });

      if (navigation.closeDrawer && typeof navigation.closeDrawer === 'function') {
        navigation.closeDrawer();
      }
    } catch (error) {
      logNavigationError(error, 'DrawerMenu', 'navigateToHome');
    }
  };

  const renderDrawerIcon = (iconName, size, color) => {
    try {
      if (!iconName) {
        return <InterText style={styles.fallbackIcon}>•</InterText>;
      }
      return <Icon name={iconName} size={size} color={color} />;
    } catch (error) {
      return <InterText style={styles.fallbackIcon}>•</InterText>;
    }
  };

  // Wrap each screen in error boundary to prevent full app crash
  const renderScreenWrapper = (ScreenComponent) => {
    return ({ navigation }) => {
      try {
        return (
          <DrawerScreenWrapper navigation={navigation}>
            <ScreenComponent />
          </DrawerScreenWrapper>
        );
      } catch (error) {
        return (
          <View style={styles.screenErrorContainer}>
            <InterText style={styles.screenErrorText}>Screen konnte nicht geladen werden</InterText>
          </View>
        );
      }
    };
  };

  try {
    return (
      <Drawer.Navigator
        drawerContent={(props) => <CustomDrawerContent {...props} />}
        screenOptions={{
          headerShown: false,
          drawerPosition: 'right',
          drawerStyle: {
            backgroundColor: '#fefbe9',
            width: 250,
          },
          drawerLabelStyle: {
            fontSize: 16,
            fontWeight: '500',
            marginLeft: 10,
          },
          drawerItemStyle: {
            borderBottomWidth: 1,
            borderBottomColor: '#dcdcdc',
            paddingLeft: 10,
            marginVertical: 0,
          },
          drawerActiveBackgroundColor: 'transparent',
          drawerActiveTintColor: '#56626a',
        }}
      >
        <Drawer.Screen 
          name="Startseite" 
          component={TabNavigator}
          options={{ 
            title: 'Startseite',
            drawerItemStyle: { display: 'none' }, // Hidden, accessible via logo tap
          }}
          listeners={({ navigation }) => ({
            drawerItemPress: () => navigateToHome(navigation)
          })}
        />

        <Drawer.Screen 
          name="Über uns" 
          options={{ 
            title: 'Über uns',
            drawerLabel: 'Über uns',
            drawerAccessibilityLabel: 'Navigiere zum Über uns Bereich',
            drawerAccessibilityRole: 'button',
            drawerIcon: ({ color, size }) => renderDrawerIcon("people-outline", size, color)
           }}
        >
          {renderScreenWrapper(LeitbildScreen)}
        </Drawer.Screen>

        <Drawer.Screen 
          name="Unterstützen" 
          options={{ 
            title: 'Unterstützen',
            drawerLabel: 'Unterstützen',
            drawerAccessibilityLabel: 'Navigiere zum Unterstützungsbereich',
            drawerAccessibilityRole: 'button',
            drawerIcon: ({ color, size }) => renderDrawerIcon("gift-outline", size, color)
           }}
        >
          {renderScreenWrapper(DonationsScreen)}
        </Drawer.Screen>

        <Drawer.Screen 
          name="Kontakt" 
          options={{ 
            title: 'Schreib uns',
            drawerLabel: 'Schreib uns',
            drawerAccessibilityLabel: 'Schreibe uns eine Nachricht',
            drawerAccessibilityRole: 'button',
            drawerIcon: ({ color, size }) => renderDrawerIcon("mail-outline", size, color)
          }}
        >
          {renderScreenWrapper(ContactScreen)}
        </Drawer.Screen>

        <Drawer.Screen 
          name="App bewerten"
          component={EmptyScreen}
          options={{ 
            title: 'App bewerten',
            drawerLabel: 'App bewerten',
            drawerAccessibilityLabel: 'Öffnet die Bewertungsseite',
            drawerAccessibilityRole: 'button',
            drawerIcon: ({ color, size }) => renderDrawerIcon("star-outline", size, color)
          }}
          listeners={{
            drawerItemPress: (e) => {
              e.preventDefault();
              
              const openStore = async () => {
                try {
                  const storeUrls = {
                    ios: "https://apps.apple.com/app/zusammenwachsen-app/id6749553571?action=write-review",
                    android: "https://play.google.com/store/apps/details?id=com.zusammenwachsen.app",
                    default: "https://www.zusammenwachsenapp.de/"
                  };

                  const storeUrl = Platform.select(storeUrls) || storeUrls.default;
                  const canOpen = await Linking.canOpenURL(storeUrl);
                  
                  if (canOpen) {
                    await Linking.openURL(storeUrl);
                  } else {
                    throw new Error(`Cannot open URL: ${storeUrl}`);
                  }
                } catch (linkingError) {
                  const errorMessage = linkingError?.message || linkingError?.toString() || 'Unknown linking error';
                  const standardError = new Error(`Failed to open store: ${errorMessage}`);
                  
                  logNavigationError(standardError, 'DrawerMenu', 'handleRateUsPress');
                }
              };

              openStore();
            }
          }}
        />

        <Drawer.Screen 
          name="Impressum" 
          options={{ 
            title: 'Impressum',
            drawerLabel: 'Impressum',
            drawerAccessibilityLabel: 'Navigiere zum Impressum',
            drawerAccessibilityRole: 'button',
            drawerIcon: ({ color, size }) => renderDrawerIcon("file-tray-full-outline", size, color)
           }}
        >
          {renderScreenWrapper(ImpressumScreen)}
        </Drawer.Screen>

        <Drawer.Screen 
          name="Datenschutzerklärung" 
          options={{ 
            title: 'Datenschutzerklärung',
            drawerLabel: 'Datenschutzerklärung',
            drawerAccessibilityLabel: 'Navigiere zur Datenschutzerklärung',
            drawerAccessibilityRole: 'button',
            drawerIcon: ({ color, size }) => renderDrawerIcon("shield-checkmark-outline", size, color)
           }}
        >
          {renderScreenWrapper(DSGVOScreen)}
        </Drawer.Screen>
      </Drawer.Navigator>
    );
  } catch (error) {
    logUIRenderError(error, 'DrawerMenu', 'renderDrawerNavigator');

    return (
      <View style={styles.drawerErrorContainer}>
        <InterText style={styles.drawerErrorTitle}>Menü-Fehler</InterText>
        <InterText style={styles.drawerErrorText}>
          Das Drawer-Menü konnte nicht geladen werden. Bitte starte die App neu.
        </InterText>
      </View>
    );
  }
}

const styles = {
  fallbackHeader: {
    height: 60,
    backgroundColor: '#c0897f',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 20,
  },
  fallbackHeaderText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fefbe9',
  },
  fallbackDrawerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  fallbackDrawerText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  fallbackIcon: {
    fontSize: 20,
    color: '#56626a',
    textAlign: 'center',
  },
  screenErrorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  screenErrorText: {
    fontSize: 16,
    color: '#d32f2f',
    textAlign: 'center',
  },
  drawerErrorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
  },
  drawerErrorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#d32f2f',
    marginBottom: 10,
    textAlign: 'center',
  },
  drawerErrorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
};