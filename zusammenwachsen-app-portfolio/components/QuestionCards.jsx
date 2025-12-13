/**
 * QuestionCards.jsx
 * 
 * Displays question cards with expandable answers.
 * 
 * Performance optimizations:
 * - Lazy loading (starts with 10 cards, loads 10 more on scroll)
 * - React.memo on individual cards
 * - Ref-based toggle handlers (prevent recreation on re-renders)
 * - windowSize={5} and removeClippedSubviews for FlatList
 * 
 * Error handling:
 * Critical errors (question mapping, card press) are logged.
 * Non-critical errors (analytics, scroll, pagination) fail silently.
 */

import React, { useState, useRef, useEffect, memo, useCallback } from 'react';
import { logUIRenderError } from '../utils/logError';
import InterText from '../components/InterText';
import { View, FlatList, StyleSheet, TouchableOpacity, Keyboard, Image, InteractionManager } from 'react-native';
import Collapsible from 'react-native-collapsible';
import Icon from '../components/Icon';
import AnswerContent from './AnswerContent';
import { useSavedQuestions } from '../contexts/SavedQuestionsContext';
import { usePopup } from '../contexts/PopupContext';
import Popup from './PopUp';
import { imageMap } from '../assets/mappings/imageMap';
import DonationHintBanner from './DonationHintBanner';
import fallbackImage from '../assets/images/fallback.png';
import { useFavoriteTabAnimation } from '../contexts/FavoriteTabAnimationContext';
import { useIsQuestionSaved } from '../contexts/useIsQuestionSaved';
import { ActivityIndicator } from 'react-native';
import { trackCardOpened, trackQuestionSaved } from '../utils/analytics';

export default function QuestionCards({
  color,
  subCategory,
  questions: propQuestions = [],
  savedOnly = false,
}) {
  const [expandedCardIndex, setExpandedCardIndex] = useState(null);
  const flatListRef = useRef(null);
  const [popupIndex, setPopupIndex] = useState(0);
  const toggleHandlers = useRef({});
  const { savedQuestions, toggleSaveQuestion } = useSavedQuestions();
  const {
    openCardCount,
    incrementOpenCardCount,
    resetOpenCardCount,
    isPopupVisible,
    showPopup,
    closePopup,
    showHintBanner,
    closeHintBanner
  } = usePopup();
  const { triggerHighlight } = useFavoriteTabAnimation();
  const [questionError, setQuestionError] = useState(null);
  const [itemsToShow, setItemsToShow] = useState(10); // Lazy loading counter

  // Preload images to prevent flicker on first render
  useEffect(() => {
    const loadImages = async () => {
      try {
        const imageLoadPromises = Object.values(imageMap).map(async (loadFn) => {
          try {
            return await loadFn();
          } catch (error) {
            return null; // Individual image load failures are acceptable
          }
        });
        
        await Promise.allSettled(imageLoadPromises);
      } catch (error) {
        if (error.name === 'TypeError' || error.message?.includes('Cannot read properties')) {
          logUIRenderError(error, 'QuestionCards', 'imagePreloading');
        }
      }
    };
    
    loadImages();
  }, []);

  // Map questions from subCategory or use propQuestions directly
  const allQuestions = propQuestions.length > 0
    ? propQuestions
    : (() => {
        try {
          return (subCategory?.questions || []).map(q => ({
            questionId: q.questionID,
            questionText: q.question,
            answer: q.answer,
            imagePosition: q.imagePosition,
          }));
        } catch (error) {
          logUIRenderError(error, 'QuestionCards', 'questionMapping');
          
          setQuestionError("Fragen konnten nicht geladen werden. Bitte versuche es später erneut.");
          return [];
        }
      })();

  const handleHeartPress = useCallback((questionId) => {
    try {
      if (!savedQuestions[questionId]) {
        triggerHighlight(); // Visual feedback: shake heart icon in tab bar

        try {
          trackQuestionSaved(questionId);
        } catch (analyticsError) {
          // Analytics failure doesn't impact UX
        }
      }
      toggleSaveQuestion(questionId);
    } catch (error) {
      logUIRenderError(error, 'QuestionCards', 'handleHeartPress');
    }
  }, [savedQuestions, toggleSaveQuestion, triggerHighlight]);

  const handleCardPress = useCallback((index) => {
    try {
      Keyboard.dismiss();
      incrementOpenCardCount();
      
      setExpandedCardIndex((prevIndex) => {
        const isOpeningCard = prevIndex !== index;
        
        if (isOpeningCard && allQuestions[index]?.questionId) {
          try {
            trackCardOpened(allQuestions[index].questionId);
          } catch (analyticsError) {
            // Analytics failure doesn't impact UX
          }
        }
        
        return prevIndex === index ? null : index;
      });

      // Wait for card expansion before scrolling
      InteractionManager.runAfterInteractions(() => {
        try {
          flatListRef.current?.scrollToIndex({
            index,
            animated: true,
            viewPosition: 0,
          });
        } catch (scrollError) {
          // scrollToIndex can fail with dynamic heights - acceptable
        }
      });

      setPopupIndex((prev) => (prev + 1) % 4); // Rotate through 4 popup messages
    } catch (error) {
      // ✅ Card-Press-Fehler sind kritisch (Core-Interaction)
      logUIRenderError(error, 'QuestionCards', 'handleCardPress');
    }
  }, [incrementOpenCardCount, allQuestions]);

  // Show donation popup every 14 opened cards
  useEffect(() => {
    try {
      if (openCardCount % 14 === 0 && openCardCount !== 0) {
        setPopupIndex((prev) => (prev + 1) % 4);
        setTimeout(() => {
          showPopup();
          resetOpenCardCount();
        }, 50);
      }
    } catch (error) {
    }
  }, [openCardCount, showPopup, resetOpenCardCount]);
  
  const filteredQuestions = savedOnly
    ? allQuestions.filter(q => savedQuestions[q.questionId])
    : allQuestions;

  const visibleQuestions = filteredQuestions.slice(0, itemsToShow);

  // Load 10 more questions when scrolling near end
  const loadMoreQuestions = useCallback(() => {
    try {
      if (itemsToShow < filteredQuestions.length) {
        setTimeout(() => {
          setItemsToShow(prev => prev + 10);
        }, 200);
      }
    } catch (error) {
      // Pagination is non-critical
    }
  }, [itemsToShow, filteredQuestions.length]);

  const renderItem = useCallback(({ item, index }) => {
    try {
      // Reuse toggle handlers to prevent recreation on every render
      if (!toggleHandlers.current[index]) {
        toggleHandlers.current[index] = () => handleCardPress(index);
      }
    
      return (
        <QuestionItem
          questionId={item.questionId}
          questionText={item.questionText}
          answer={item.answer}
          imagePosition={item.imagePosition}
          index={index}
          color={color}
          isExpanded={expandedCardIndex === index}
          onToggle={toggleHandlers.current[index]}
        />
      );
    } catch (error) {
      return (
        <View style={styles.card}>
          <InterText style={styles.cardText}>Frage konnte nicht geladen werden</InterText>
        </View>
      );
    }
  }, [expandedCardIndex, color, handleCardPress]);

  return (
    <View style={{ flex: 1 }}>
      {questionError && (
        <InterText style={{ color: 'red', textAlign: 'center', margin: 10 }}>
          {questionError}
        </InterText>
      )}
      
      <FlatList
        ref={flatListRef}
        data={visibleQuestions}
        renderItem={renderItem}
        keyExtractor={(item) => String(item.questionId)}
        contentContainerStyle={{ paddingBottom: 40 }}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        windowSize={5}
        removeClippedSubviews={true}
        onEndReached={loadMoreQuestions}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          filteredQuestions.length > 15 && itemsToShow < filteredQuestions.length ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator size="small" color="#ccc" />
            </View>
          ) : null
        }
      />
      
      <Popup visible={isPopupVisible} onClose={closePopup} popupIndex={popupIndex} />
      {showHintBanner && <DonationHintBanner onClose={closeHintBanner} />}
    </View>
  );
}

// Memoized to prevent re-renders when other cards expand/collapse
const QuestionItem = memo(function ({
  questionId,
  questionText,
  answer,
  imagePosition,
  index,
  color,
  isExpanded,
  onToggle,
}) {
  const { toggleSaveQuestion } = useSavedQuestions();
  const { triggerHighlight } = useFavoriteTabAnimation();
  const isSaved = useIsQuestionSaved(questionId);

  let IconComponent;
  try {
    IconComponent = imageMap[imagePosition]?.();
  } catch (error) {
    IconComponent = null;
  }

  return (
    <TouchableOpacity 
      onPress={onToggle} 
      activeOpacity={1}
      accessibilityRole="button"
      accessibilityLabel={questionText}
      accessibilityHint={isExpanded ? "Tippe doppelt, um die Antwort zu schließen" : "Tippe doppelt, um die Antwort zu öffnen"}
      accessibilityState={{ expanded: isExpanded }}
    >
      <View style={[styles.card, { backgroundColor: color || '#eff0ea' }]}>
        <View style={styles.cardHeader}>
          {IconComponent ? (
            <IconComponent width={60} height={60} style={styles.image} />
          ) : (
            <Image
              source={fallbackImage}
              style={styles.image}
              resizeMode="contain"
              accessibilityLabel="Symbolbild"
            />
          )}
          <InterText style={styles.cardText}>{questionText}</InterText>
          <TouchableOpacity 
            onPress={() => {
              try {
                if (!isSaved) {
                  triggerHighlight();
                  
                  try {
                    trackQuestionSaved(questionId);
                  } catch (analyticsError) {
                    // Analytics failure doesn't impact UX
                  }
                }
                toggleSaveQuestion(questionId);
              } catch (error) {
                logUIRenderError(error, 'QuestionItem', 'toggleSave');
              }
            }}
            accessibilityRole="button"
            accessibilityLabel={isSaved ? "Frage entfernen" : "Frage speichern"}
            accessibilityHint="Tippe doppelt, um diese Frage zu speichern oder zu entfernen"
          >
            <Icon
              name={isSaved ? 'heart' : 'heart-outline'}
              size={30}
              color={isSaved ? 'red' : 'grey'}
            />
          </TouchableOpacity>
        </View>
        <Collapsible collapsed={!isExpanded} duration={300}>
          <View
            accessible={isExpanded}
            importantForAccessibility={isExpanded ? "yes" : "no-hide-descendants"}
            pointerEvents={isExpanded ? 'auto' : 'none'}
          >
            <AnswerContent
              color={color}
              answer={answer}
              questionId={questionId}
              questionText={questionText}
            />
          </View>
        </Collapsible>
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  card: {
    marginVertical: 5,
    marginHorizontal: 10,
    padding: 15,
    paddingRight: 5,
    paddingLeft: 5,
    borderRadius: 10,
  },
  image: {
    width: 60,
    height: 60,
    marginRight: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardText: {
    flex: 1,
    fontSize: 14,
    color: '#56626a',
    marginLeft: 5,
    marginRight: 5,
  },
  footerLoader: {
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});