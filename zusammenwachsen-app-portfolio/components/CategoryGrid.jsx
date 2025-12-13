/**
 * CategoryGrid.jsx
 * 
 * Grid layout displaying 12 main categories with dynamic font sizing.
 * 
 * Features:
 * - 3-column responsive grid layout
 * - Dynamic font size normalization (ensures consistent text size across all cards)
 * - Memoized press handlers (performance optimization)
 * - Error boundary with fallback UI
 * 
 * Font size normalization:
 * Each card reports its font size after text layout.
 * The grid calculates the minimum size and applies it (+2px) to all cards.
 * This ensures visual consistency across cards with different text lengths.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import CategoryCard from './CategoryCard';
import { categoryColors } from '../assets/colors';
import { logNavigationError } from '../utils/logError';
import InterText from './InterText';

const categories = [
  {
    name: 'Elterliche Selbstfürsorge',
    image: require('../assets/categorylogo/selfcare.png'),
  },
  {
    name: 'Alltag & Routinen',
    image: require('../assets/categorylogo/routines.png'),
  },
  {
    name: 'Kommunikation & Konfliktlösung',
    image: require('../assets/categorylogo/communication.png'),
  },
  {
    name: 'Ernährung & Mahlzeiten',
    image: require('../assets/categorylogo/nutrition.png'),
  },
  {
    name: 'Spiele & Kreative Aktivitäten',
    image: require('../assets/categorylogo/activities.png'),
  },
  {
    name: 'Gesundheit & Körperpflege',
    image: require('../assets/categorylogo/health.png'),
  },
  {
    name: 'Kita & Schule',
    image: require('../assets/categorylogo/school.png'),
  },
  {
    name: 'Geschwister & Familie',
    image: require('../assets/categorylogo/family.png'),
  },
  {
    name: 'Soziale Kompetenzen',
    image: require('../assets/categorylogo/social.png'),
  },
  {
    name: 'Diversität & Inklusion',
    image: require('../assets/categorylogo/diversity.png'),
  },
  {
    name: 'Sicherheit & Prävention',
    image: require('../assets/categorylogo/safety.png'),
  },
  {
    name: 'Besondere Lebenssituation',
    image: require('../assets/categorylogo/circumstances.png'),
  },
];

export default function CategoryGrid({ onCategoryPress }) {
  const { width } = useWindowDimensions();
  const navigation = useNavigation();
  const [minFontSize, setMinFontSize] = useState(null);

  // Collect font sizes from all cards to normalize text size
  const handleFontSizeReport = useCallback((reportedSize) => {
    if (typeof reportedSize === 'number' && reportedSize > 0) {
      setMinFontSize((prev) => {
        if (prev === null || reportedSize < prev) return reportedSize;
        return prev;
      });
    }
  }, []);
 
  // Apply minimum font size (+2px buffer) to all cards for visual consistency
  const calculatedMaxFontSize = minFontSize !== null ? minFontSize + 2 : null;

  const handleCategoryPress = useCallback((categoryName, color) => {
    try {
      if (!categoryName || !onCategoryPress) {
        throw new Error('Category name or onCategoryPress callback missing');
      }
      
      onCategoryPress(categoryName, color);
    } catch (error) {
      logNavigationError(error, 'CategoryGrid', 'handleCategoryPress');
    }
  }, [onCategoryPress]);

  // Memoize press handlers to prevent recreation on every render
  const categoryPressHandlers = useMemo(() => {
    return categories.reduce((handlers, category, index) => {
      const color = categoryColors[index % categoryColors.length];
      handlers[category.name] = () => handleCategoryPress(category.name, color);
      return handlers;
    }, {});
  }, [handleCategoryPress]);

  try {
    return (
      <View style={styles.container}>
        {categories.map((category, index) => {
          const color = categoryColors[index % categoryColors.length];
          
          return (
            <View key={`category-${index}-${category.name}`} style={styles.cardWrapper}>
              <CategoryCard
                title={category.name}
                onPress={categoryPressHandlers[category.name]}
                color={color}
                imageSource={category.image}
                reportFontSize={handleFontSizeReport}
                dynamicMaxFontSize={calculatedMaxFontSize}
              />
            </View>
          );
        })}
      </View>
    );
  } catch (error) {
    logUIRenderError(error, 'CategoryGrid', 'render');
    
    return (
      <View style={styles.errorContainer}>
        <InterText style={styles.errorText}>Kategorien konnten nicht geladen werden.</InterText>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
    position: 'relative',
  },
  cardWrapper: {
    flexBasis: '33.3333%',
    padding: 2,
  },
  errorContainer: {
    padding: 20,
    alignItems: 'center',
  },
  errorText: {
    color: 'red',
    textAlign: 'center',
    fontSize: 14,
  },
});