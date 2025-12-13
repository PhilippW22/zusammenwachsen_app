/**
 * useDeepLinking.js
 * 
 * Handles deep linking for direct navigation to questions.
 * 
 * URL format: app://question/{questionId}
 * Example: app://question/Q123 → navigates to SingleQuestionScreen with questionId="Q123"
 * 
 * Deep linking is non-critical - app continues normally if it fails.
 */

import { useEffect } from 'react';
import * as Linking from 'expo-linking';
import { useNavigationContainerRef } from '@react-navigation/native';
import { logNavigationError } from '../utils/logError';

export function useDeepLinking() {
  const navigationRef = useNavigationContainerRef();

  useEffect(() => {
    const handleUrl = ({ url }) => {
      try {
        if (!url || typeof url !== 'string' || !navigationRef?.current) {
          return;
        }

        const parsed = Linking.parse(url);
        if (!parsed) return;

        const parts = parsed.path?.split('/') || [];
        
        if (parts.length < 2) return;

        // Handle question deep links: app://question/{questionId}
        if (parts[0] === 'question' && parts[1]) {
          const questionId = parts[1];
          
          if (!questionId || typeof questionId !== 'string') {
            throw new Error('[USEDEEPLINKING] Invalid questionId from URL');
          }

          navigationRef.current.navigate('SingleQuestionScreen', { questionId });
        }
      } catch (error) {
        logNavigationError(error, 'useDeepLinking', 'handleUrl');
      }
    };

    const handleInitialUrl = async () => {
      try {
        const url = await Linking.getInitialURL();
        if (url) {
          // Delay to ensure navigation is ready
          setTimeout(() => handleUrl({ url }), 500);
        }
      } catch (error) {
        // Initial URL loading failures are non-critical
      }
    };

    const setupEventListener = () => {
      try {
        return Linking.addEventListener('url', handleUrl);
      } catch (error) {
        return null;
      }
    };

    let subscription = null;
    
    try {
      handleInitialUrl();
      subscription = setupEventListener();
    } catch (setupError) {
      // Deep linking init failures are non-critical - app works without it
    }

    return () => {
      if (subscription?.remove) {
        subscription.remove();
      }
    };
  }, [navigationRef]);

  return navigationRef;
}