/**
 * SearchScreen.jsx
 * 
 * Main search screen with fuzzy search and default questions.
 * 
 * Features:
 * - Real-time search input (results shown after submit)
 * - Default questions loaded from remote config (fallback to hardcoded list)
 * - 800ms debounce on search to prevent excessive searches
 * - Auto-focus on search input
 * 
 * Flow:
 * 1. User types query
 * 2. User submits (Enter or submit button)
 * 3. Show loading indicator (800ms)
 * 4. Display results or "no results" message
 */

import React, { useState, useEffect, useRef } from 'react';
import InterText from '../components/InterText';
import { View, StyleSheet, Keyboard, TouchableWithoutFeedback, ActivityIndicator } from 'react-native';
import SearchBar from '../components/SearchBar';
import QuestionCards from '../components/QuestionCards';
import SearchScreenResults from '../components/SearchScreenResults';
import { searchQuestions } from '../utils/FuseSearch';
import { logDataError } from '../utils/logError';
import indexData from '../assets/data/index_data.json';
import { FALLBACK_QUESTION_IDS } from '../constants/defaultQuestions';

const SearchScreen = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [defaultQuestions, setDefaultQuestions] = useState([]);
  const [lastSubmittedQuery, setLastSubmittedQuery] = useState('');
  const searchInputRef = useRef(null);

  const REMOTE_CONFIG_URL = 'PLACEHOLDER_REMOTE_CONFIG_URL';

  // Auto-focus search input on mount
  useEffect(() => {
    const focusTimeout = setTimeout(() => {
      searchInputRef.current?.focus();
    }, 500);

    return () => clearTimeout(focusTimeout);
  }, []);

  // Load default questions from remote config (with hardcoded fallback)
  useEffect(() => {
    const loadDefaultQuestions = async () => {
      let questionIdsToUse = FALLBACK_QUESTION_IDS;
      
      try {
        const response = await fetch(REMOTE_CONFIG_URL);
        if (response.ok) {
          const data = await response.json();
          if (data.defaultQuestionIds && Array.isArray(data.defaultQuestionIds)) {
            questionIdsToUse = data.defaultQuestionIds;
          }
        }
      } catch (error) {
        // Remote config failures are non-critical - using fallback
      }
      
      try {
        const filteredQuestions = questionIdsToUse.map(questionId => {
          const question = indexData.find(q => q.QuestionIDIndex === questionId);
          return question ? {
            questionId: question.QuestionIDIndex,
            questionText: question.QuestionIndex,
            answer: question.AnswerIndex,
            imagePosition: question.imagePosition || null,
          } : null;
        }).filter(Boolean);
        
        setDefaultQuestions(filteredQuestions);
      } catch (error) {
        logDataError(error, 'SearchScreen', 'loadDefaultQuestions');
        
        setDefaultQuestions([]);
      }
    };

    loadDefaultQuestions();
  }, []);

  const handleSearchInput = (query) => {
    setSearchQuery(query);
    if (query === '') {
      setLastSubmittedQuery('');
    }
  };

  // Debounced search with 800ms delay
  const handleSubmitSearch = () => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    setLastSubmittedQuery(searchQuery);
  
    try {
      setTimeout(() => {
        try {
          const results = searchQuestions(searchQuery);
          setSearchResults(results);
        } catch (error) {
          logDataError(error, 'SearchScreen', 'searchQuestions');
          
          setSearchResults([]);
        } finally {
          setLoading(false);
        }
      }, 800);
    } catch (outerError) {
      logDataError(outerError, 'SearchScreen', 'searchTimeout');
      
      setLoading(false);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery(''); 
    setSearchResults([]); 
    setLastSubmittedQuery('');
    searchInputRef.current?.focus();
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        <View style={styles.searchBarContainer}>
          <SearchBar
            ref={searchInputRef}
            value={searchQuery}
            onChangeText={handleSearchInput}
            onClear={handleClearSearch}
            onSubmitEditing={handleSubmitSearch}
          />
        </View>

        <View style={styles.headerContainer}>
          <InterText style={styles.headerText}>
            {lastSubmittedQuery 
              ? `Deine Suchergebnisse für "${lastSubmittedQuery}"`
              : "Häufig gesuchte Themen"}
          </InterText>
        </View>

        <View style={styles.resultsContainer}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator 
                size="large" 
                color="#666" 
                accessibilityLabel="Ladeindikator"
                accessibilityHint="Die Suche läuft. Bitte warte einen Moment."
              />
              <InterText style={styles.loadingText}>Suche läuft...</InterText>
            </View>
          ) : (searchQuery === '' || lastSubmittedQuery === '') ? (
            <QuestionCards color="#f3f3f3" questions={defaultQuestions} />
          ) : searchResults.length > 0 ? (
            <SearchScreenResults results={searchResults} />
          ) : (
            <View
              style={styles.noResultsContainer}
              accessibilityLiveRegion="polite"
            >
              <InterText style={styles.noResultsText}>
                Deine Suche war leider nicht erfolgreich. Probiere es mit kürzeren Schlagwörtern oder stöbere durch die Kategorien.
              </InterText>
            </View>
          )}
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  searchBarContainer: {
    marginHorizontal: 10,
    marginTop: 10,
    marginBottom: 5,
  },
  headerContainer: {
    marginHorizontal: 10,
    marginBottom: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  headerText: {
    fontSize: 14,
    color: '#56626a',
  },
  resultsContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  noResultsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noResultsText: {
    fontSize: 16,
    color: '#777',
    textAlign: 'center',
    marginHorizontal: 20,
  },
});

export default SearchScreen;