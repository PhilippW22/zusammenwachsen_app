/**
 * TabNavigator.jsx
 * 
 * Bottom tab navigation with animated favorite icon and error boundaries.
 * 
 * Tab structure:
 * - HomeTab (Stack: Home → SubCategory → SingleQuestion)
 * - SearchTab (Stack: Search → SingleQuestion)
 * - DonationsTab (Single screen with header)
 * - SavedItemsTab (Stack: SavedQuestions → SingleQuestion)
 * 
 * Features:
 * - Animated heart icon (shakes when user saves a question)
 * - Error boundaries for each stack
 * - Fallback UI for navigation failures
 */

import React, { useRef, useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Animated, Easing, Text } from 'react-native';
import Icon from '../components/Icon';
import HomeScreen from '../screens/HomeScreen';
import SavedQuestionsScreen from '../screens/SavedQuestionsScreen';
import SearchScreen from '../screens/SearchScreen';
import DonationsScreen from '../screens/DonationsScreen';
import SubCategoryScreen from '../screens/SubCategoryScreen';
import ImpressumScreen from '../screens/ImpressumScreen';
import HomeSearchBarScreen from '../screens/HomeSearchBarScreen';
import SingleQuestionScreen from '../screens/SingleQuestionScreen';
import Header from '../components/Header';
import { useFavoriteTabAnimation } from '../contexts/FavoriteTabAnimationContext';
import { logUIRenderError } from '../utils/logError';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function AnimatedTabIcon({ name, size, color, routeName }) {
  const { highlight } = useFavoriteTabAnimation();
  const animation = useRef(new Animated.Value(0)).current;

  // Shake animation: 15° right → 15° left → center (180ms total)
  useEffect(() => {
    if (routeName === 'SavedItemsTab' && highlight) {
      Animated.sequence([
        Animated.timing(animation, {
          toValue: 1,
          duration: 60,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(animation, {
          toValue: -1,
          duration: 60,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(animation, {
          toValue: 0,
          duration: 60,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [highlight, routeName, animation]);

  const getRotateTransform = () => {
    const rotate = animation.interpolate({
      inputRange: [-1, 1],
      outputRange: ['-15deg', '15deg'],
    });
    return [{ rotate }];
  };

  const renderIcon = () => {
    if (!name) {
      return (
        <Text style={styles.fallbackIcon}>
          {routeName?.charAt(0)?.toUpperCase() || '?'}
        </Text>
      );
    }

    return <Icon name={name} size={size} color={color} />;
  };

  return (
    <Animated.View style={{ transform: getRotateTransform() }}>
      {renderIcon()}
    </Animated.View>
  );
}

// Wraps stack navigator in error boundary to prevent full app crash
function createSafeStack(screenConfigs, stackName) {
  return function SafeStack() {
    try {
      return (
        <Stack.Navigator
          screenOptions={({ navigation }) => ({
            header: () => <Header toggleDrawer={() => navigation.toggleDrawer()} />,
          })}
        >
          {screenConfigs.map(({ name, component }) => (
            <Stack.Screen key={name} name={name} component={component} />
          ))}
        </Stack.Navigator>
      );
    } catch (error) {
      logUIRenderError(error, 'TabNavigator', `render${stackName}`);

      return (
        <View style={styles.stackErrorContainer}>
          <Text style={styles.stackErrorText}>
            {stackName} konnte nicht geladen werden
          </Text>
        </View>
      );
    }
  };
}

const HomeStack = createSafeStack([
  { name: 'HomeScreenMain', component: HomeScreen },
  { name: 'SubCategory', component: SubCategoryScreen },
  { name: 'Impressum', component: ImpressumScreen },
  { name: 'HomeSearchBarScreen', component: HomeSearchBarScreen },
  { name: 'SingleQuestionScreen', component: SingleQuestionScreen },
], 'HomeStack');

const SearchStack = createSafeStack([
  { name: 'SearchScreenMain', component: SearchScreen },
  { name: 'SingleQuestionScreen', component: SingleQuestionScreen },
], 'SearchStack');

const SavedStack = createSafeStack([
  { name: 'SavedQuestionsScreen', component: SavedQuestionsScreen },
  { name: 'SingleQuestionScreen', component: SingleQuestionScreen },
], 'SavedStack');

function ScreenWithHeader({ children, navigation }) {
  return (
    <View style={{ flex: 1 }}>
      <Header toggleDrawer={() => navigation.toggleDrawer()} />
      {children}
    </View>
  );
}

const renderTabIcon = (route, size, color) => {
  if (route.name === 'DonationsTab') {
    return <Icon name="hand-heart" size={size} color={color} />;
  }

  let iconName;
  if (route.name === 'HomeTab') iconName = 'home';
  else if (route.name === 'SearchTab') iconName = 'search';
  else if (route.name === 'SavedItemsTab') iconName = 'heart';

  if (!iconName) {
    return (
      <Text style={styles.fallbackTabIcon}>
        {route.name?.charAt(0)?.toUpperCase() || '?'}
      </Text>
    );
  }

  return (
    <AnimatedTabIcon
      name={iconName}
      size={size}
      color={color}
      routeName={route.name}
    />
  );
};

export default function TabNavigator({ resetToHomeTab }) {
  useEffect(() => {
    if (resetToHomeTab && typeof resetToHomeTab === 'function') {
      resetToHomeTab();
    }
  }, [resetToHomeTab]);

  const renderTabNavigator = () => {
    try {
      return (
        <Tab.Navigator
          screenOptions={({ route }) => ({
            tabBarIcon: ({ size, color }) => renderTabIcon(route, size, color),
            tabBarInactiveTintColor: '#fefbe9',
            tabBarActiveTintColor: 'white',
            tabBarStyle: { backgroundColor: '#c0897f' },
            headerShown: false,
            tabBarHideOnKeyboard: true,
          })}
        >
          <Tab.Screen
            name="HomeTab"
            component={HomeStack}
            options={{
              title: 'Startseite',
              tabBarAccessibilityLabel: 'Navigiere zur Startseite',
              tabBarAccessibilityRole: 'button',
            }}
          />
          <Tab.Screen
            name="SearchTab"
            component={SearchStack}
            options={{
              title: 'Suche',
              tabBarAccessibilityLabel: 'Öffne die Suche',
              tabBarAccessibilityRole: 'button',
            }}
          />
          <Tab.Screen
            name="DonationsTab"
            options={{
              title: 'Unterstützen',
              tabBarAccessibilityLabel: 'Öffne den Bereich Unterstützen',
              tabBarAccessibilityRole: 'button',
            }}
          >
            {({ navigation }) => (
              <View style={{ flex: 1 }}>
                <ScreenWithHeader navigation={navigation}>
                  <DonationsScreen />
                </ScreenWithHeader>
              </View>
            )}
          </Tab.Screen>
          <Tab.Screen
            name="SavedItemsTab"
            component={SavedStack}
            options={{
              title: 'Favoriten',
              tabBarAccessibilityLabel: 'Zeige gespeicherte Fragen',
              tabBarAccessibilityRole: 'button',
            }}
          />
        </Tab.Navigator>
      );
    } catch (error) {
      logUIRenderError(error, 'TabNavigator', 'renderTabNavigator');

      return (
        <View style={styles.tabErrorContainer}>
          <Text style={styles.tabErrorTitle}>Navigation-Fehler</Text>
          <Text style={styles.tabErrorText}>
            Die Tab-Navigation konnte nicht geladen werden. Bitte starte die App neu.
          </Text>
        </View>
      );
    }
  };

  return renderTabNavigator();
}

const styles = {
  fallbackIcon: {
    fontSize: 24,
    color: '#fefbe9',
    fontWeight: 'bold',
    textAlign: 'center',
    width: 24,
    height: 24,
    lineHeight: 24,
  },
  fallbackTabIcon: {
    fontSize: 20,
    color: '#fefbe9',
    fontWeight: 'bold',
    textAlign: 'center',
    width: 24,
    height: 24,
    lineHeight: 24,
  },
  stackErrorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
  },
  stackErrorText: {
    fontSize: 16,
    color: '#d32f2f',
    textAlign: 'center',
  },
  tabErrorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
  },
  tabErrorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#d32f2f',
    marginBottom: 10,
    textAlign: 'center',
  },
  tabErrorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
};