/**
 * SubCategoryScreen.jsx
 * 
 * Displays subcategories and their questions for a selected main category.
 * 
 * Features:
 * - Dynamic category loading with lazy imports
 * - Carousel for subcategory selection
 * - "All questions" subcategory (aggregates all subcategories)
 * - Minimum spinner time (600ms) for better UX
 * - Network error detection (excludes from error reporting)
 * 
 * Flow:
 * 1. Load category data dynamically
 * 2. Create "All" subcategory from aggregated questions
 * 3. Display carousel + questions
 */

import { BackHandler } from 'react-native';
import React, { useState, useEffect } from 'react';
import { logDataError } from '../utils/logError';
import InterText from '../components/InterText';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import SubCategoryHeader from '../components/SubCategoryHeader';
import CarouselSubCategory from '../components/CarouselSubCategory';
import QuestionCards from '../components/QuestionCards';
import { getAllQuestionsSubCategory } from '../utils/getAllQuestionsFromSubcategories';
import { categoryLoaders } from '../utils/categoryLoaders';

export default function SubCategoryScreen() {
  const route = useRoute();
  const { categoryName, color } = route.params;
  const navigation = useNavigation();
  const [selectedCategoryData, setSelectedCategoryData] = useState(null);
  const [selectedSubCategory, setSelectedSubCategory] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const backAction = () => {
      navigation.goBack();
      return true;
    };
  
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      const MIN_SPINNER_TIME = 600; // Minimum loading time for better UX
      const start = Date.now();

      const loadCategory = categoryLoaders[categoryName];
      if (!loadCategory) {
        const error = new Error(`[SUBCATEGORY] Unknown category: ${categoryName}`);
        logDataError(error, 'SubCategoryScreen', 'loadData');
        
        setLoadError("Kategorie konnte nicht geladen werden. Bitte versuche es später erneut.");
        return;
      }
  
      try {
        const dataModule = await loadCategory();
        const data = dataModule.default ?? dataModule;

        // Create "All questions" subcategory from aggregated questions
        const allSubCat = getAllQuestionsSubCategory(data.subcategories);
  
        setSelectedCategoryData({
          ...data,
          subcategories: [allSubCat, ...data.subcategories],
        });
      } catch (error) {
        // Don't report network errors to Sentry (expected in offline scenarios)
        const errorMessage = error.message || '';
        const shouldReport = !(
          errorMessage.includes('Network request failed') ||
          errorMessage.includes('Load failed') ||
          errorMessage.includes('AbortError') ||
          errorMessage.includes('TimeoutError') ||
          errorMessage.includes('cancelled')
        );

        if (shouldReport) {
          logDataError(error, 'SubCategoryScreen', 'loadData');
        }
        
        setLoadError("Inhalte konnten nicht geladen werden. Bitte überprüfe deine Internetverbindung und versuche es erneut.");
      } finally {
        // Ensure minimum spinner time for better perceived performance
        const elapsed = Date.now() - start;
        const remainingTime = Math.max(0, MIN_SPINNER_TIME - elapsed);
  
        setTimeout(() => {
          setIsLoading(false);
        }, remainingTime);
      }
    };
  
    loadData();
  }, [categoryName]);

  // Auto-select first subcategory (All questions) when data loads
  useEffect(() => {
    if (selectedCategoryData?.subcategories?.length > 0) {
      setSelectedSubCategory(selectedCategoryData.subcategories[0]);
    }
  }, [selectedCategoryData]);

  if (loadError) {
    return (
      <View style={styles.container}>
        <SubCategoryHeader categoryName={categoryName} />
        <InterText style={styles.errorText}>{loadError}</InterText>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.container}>
        <SubCategoryHeader categoryName={categoryName} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#666" />
          <InterText style={{ marginTop: 10 }}>Impulse laden ...</InterText>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SubCategoryHeader categoryName={categoryName} />
      <CarouselSubCategory
        subcategories={selectedCategoryData.subcategories}
        onSubCategoryPress={setSelectedSubCategory}
        color={color}
      />
      <View style={styles.questionsContainer}>
        <QuestionCards 
          color={color} 
          subCategory={selectedSubCategory} 
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  questionsContainer: {
    flex: 1,
    flexGrow: 1,
    marginTop: 5,
  },
  errorText: {
    color: 'red',
    fontSize: 18,
    textAlign: 'center',
    marginTop: 40,
    paddingHorizontal: 20,
  },
});