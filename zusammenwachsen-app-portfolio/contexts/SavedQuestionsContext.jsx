/**
 * SavedQuestionsContext.jsx
 * 
 * Manages favorites (saved questions) with optimistic UI and error handling.
 * 
 * Key features:
 * - Optimistic updates (instant UI feedback, rollback on error)
 * - AsyncStorage persistence
 * - Quota error handling with user-friendly alerts
 * - Data validation to prevent corrupted state
 * 
 * Error handling:
 * - Storage access errors: logged (critical for app functionality)
 * - Quota exceeded: user alert (non-critical, user can fix)
 * - Parse errors: logged + fallback to empty object
 */

import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { logAsyncStorageError } from '../utils/logError';

const SavedQuestionsContext = createContext();

export const SavedQuestionsProvider = ({ children }) => {
  const [savedQuestions, setSavedQuestions] = useState({});

  useEffect(() => {
    loadSavedQuestions();
  }, []);

  const loadSavedQuestions = async () => {
    try {
      const savedQuestionsString = await AsyncStorage.getItem('savedQuestions');
      
      if (savedQuestionsString) {
        let parsed = {};
        
        try {
          parsed = JSON.parse(savedQuestionsString);
          
          // Validate parsed data to prevent corrupted app state
          if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
            throw new Error('[SAVEDQUESTIONSCONTEXT] Invalid data structure: expected object');
          }
          
        } catch (parseError) {
          logAsyncStorageError(parseError, 'parseJSON', 'savedQuestions', {
            fingerprint: ['SavedQuestionsContext-parseJSON-critical'],
            tags: { 
              component: 'SavedQuestionsContext',
              errorType: 'critical',
              critical: true,
              feature: 'storage'
            },
            extra: { 
              componentName: 'SavedQuestionsContext',
              method: 'parseJSON',
              critical: true
            },
            severity: 'error'
          });
          
          parsed = {};
        }

        setSavedQuestions(parsed);
      }
    } catch (error) {
      logAsyncStorageError(error, 'getItem', 'savedQuestions', {
        fingerprint: ['SavedQuestionsContext-getItem-critical'],
        tags: { 
          component: 'SavedQuestionsContext',
          errorType: 'critical',
          critical: true,
          feature: 'storage'
        },
        extra: { 
          componentName: 'SavedQuestionsContext',
          method: 'getItem',
          critical: true
        },
        severity: 'error'
      });
      
      setSavedQuestions({});
    }
  };

  // Optimistic UI: update immediately, rollback on error
  const toggleSaveQuestion = async (questionId) => {
    try {
      const updatedSavedQuestions = { ...savedQuestions };
      const wasAlreadySaved = !!updatedSavedQuestions[questionId];
      updatedSavedQuestions[questionId] = !updatedSavedQuestions[questionId];
      
      setSavedQuestions(updatedSavedQuestions);

      try {
        await AsyncStorage.setItem('savedQuestions', JSON.stringify(updatedSavedQuestions));
      } catch (storageError) {
        // Rollback on storage failure
        setSavedQuestions(savedQuestions);
        throw storageError;
      }

    } catch (error) {
      // Quota exceeded: show user-friendly message (user can fix by deleting items)
      if (error.message?.includes('QuotaExceededError') || 
          error.message?.includes('quota') ||
          error.name === 'QuotaExceededError') {
        
        Alert.alert(
          'Speicher voll',
          'Der Gerätespeicher ist voll. Bitte lösche einige gespeicherte Fragen oder mache Platz frei.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Other storage errors are critical
      logAsyncStorageError(error, 'setItem', 'savedQuestions', {
        fingerprint: ['SavedQuestionsContext-setItem-critical'],
        tags: { 
          component: 'SavedQuestionsContext',
          errorType: 'critical',
          critical: true,
          feature: 'storage'
        },
        extra: { 
          componentName: 'SavedQuestionsContext',
          method: 'setItem',
          critical: true
        },
        severity: 'error'
      });
    }
  };

  return (
    <SavedQuestionsContext.Provider value={{ savedQuestions, toggleSaveQuestion, loadSavedQuestions }}>
      {children}
    </SavedQuestionsContext.Provider>
  );
};

export const useSavedQuestions = () => useContext(SavedQuestionsContext);
export { SavedQuestionsContext };