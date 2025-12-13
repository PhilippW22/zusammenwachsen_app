/**
 * HomeScreen.jsx
 * 
 * Main home screen with welcome text, search button, and category grid.
 * 
 * Features:
 * - Safe area handling for different device sizes
 * - Navigation to search and category screens
 * - Error handling for navigation failures
 */

import React, { useCallback } from 'react';
import { StyleSheet, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import WelcomeText from '../components/WelcomeText';
import SearchButton from '../components/SearchButton';
import CategoryGrid from '../components/CategoryGrid';
import { logNavigationError } from '../utils/logError';

export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const handleSearchBarPress = useCallback(() => {
    try {
      if (!navigation) {
        throw new Error('[HOMESCREEN] Navigation context is null or undefined');
      }
     
      navigation.navigate('HomeSearchBarScreen');
    } catch (error) {
      logNavigationError(error, 'HomeScreen', 'handleSearchBarPress');
    }
  }, [navigation]);

  const handleCategoryPress = useCallback((categoryName, color) => {
    try {
      if (!navigation || !categoryName) {
        throw new Error('[HOMESCREEN] Invalid navigation context or category data');
      }
     
      navigation.navigate('SubCategory', { categoryName, color });
    } catch (error) {
      logNavigationError(error, 'HomeScreen', 'handleCategoryPress');
    }
  }, [navigation]);

  const safeInsets = insets || { top: 0, bottom: 0 };

  return (
    <ScrollView
      style={[styles.container, { paddingTop: safeInsets.top / 2 }]}
      contentContainerStyle={[styles.contentContainer, { paddingBottom: safeInsets.bottom + 10 }]}
      keyboardShouldPersistTaps="handled"
    >
      <WelcomeText />
      <View>
        <SearchButton onPress={handleSearchBarPress} />
      </View>
      <CategoryGrid onCategoryPress={handleCategoryPress} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  contentContainer: {
    padding: 10,
  },
});