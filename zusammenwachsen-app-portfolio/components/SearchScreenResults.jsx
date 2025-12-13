/**
 * SearchScreenResults.jsx
 * 
 * Displays fuzzy search results as expandable accordion cards.
 * 
 * Performance optimizations:
 * - React.memo on individual cards
 * - FlatList with windowSize={5} (keeps only 5 screens in memory)
 * - InteractionManager for smooth scroll after card expansion
 * 
 * Error handling:
 * Critical errors (search flow, card rendering) are logged to Sentry.
 * Non-critical errors (analytics, scroll position) fail silently.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import InterText from '../components/InterText';
import { View, FlatList, StyleSheet, TouchableOpacity, Keyboard, Image, InteractionManager } from 'react-native';
import Collapsible from 'react-native-collapsible';
import fallbackImage from '../assets/images/fallback.png';
import { imageMap } from '../assets/mappings/imageMap';
import Icon from '../components/Icon';
import AnswerContent from './AnswerContent';
import { useSavedQuestions } from '../contexts/SavedQuestionsContext';
import { usePopup } from '../contexts/PopupContext';
import Popup from './PopUp';
import DonationHintBanner from './DonationHintBanner';
import { useFavoriteTabAnimation } from '../contexts/FavoriteTabAnimationContext';
import { logUIRenderError } from '../utils/logError';
import { trackQuestionSaved, trackCardOpened } from '../utils/analytics';

const SearchScreenResults = ({ results, selectedResult }) => {
  const [expandedCardId, setExpandedCardId] = useState(null);
  const [initialCardOpened, setInitialCardOpened] = useState(false);
  const flatListRef = useRef(null);

  // Context-Hooks
  const { savedQuestions, toggleSaveQuestion } = useSavedQuestions();
  const { triggerHighlight } = useFavoriteTabAnimation();
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

  // Auto-open and scroll to selected result (from deep link or category navigation)
  useEffect(() => {
    if (!initialCardOpened && selectedResult) {
      try {
        const selectedIndex = results.findIndex(
          (result) => result.QuestionIndex === selectedResult.QuestionIndex
        );
        if (selectedIndex !== -1) {
          setExpandedCardId(results[selectedIndex].QuestionIDIndex);
          setInitialCardOpened(true);
          
          // Delay scroll to prevent race condition with card expansion animation
          setTimeout(() => {
            try {
              flatListRef.current?.scrollToIndex({ index: selectedIndex, animated: true });
            } catch (scrollError) {
              // scrollToIndex fails if item layout isn't calculated yet - acceptable
            }
          }, 500);
        }
      } catch (error) {
        logUIRenderError(error, 'SearchScreenResults', 'findSelectedResult');
      }
    }
  }, [selectedResult, initialCardOpened, results]);

  const handleHeartPress = (questionId) => {
    try {
      // Trigger tabbar animation only when saving (not when removing)
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
      // Silent fail - favorites are non-critical
    }
  };

  const handleCardPress = (questionId, index) => {
    try {
      Keyboard.dismiss();
      const isExpanded = expandedCardId === questionId;
      setExpandedCardId(isExpanded ? null : questionId);

      if (!isExpanded) {
        try {
          trackCardOpened(questionId);
        } catch (analyticsError) {
          // Analytics failure doesn't impact UX
        }
      }
      
      // Wait for card expansion animation before scrolling (prevents jank)
      if (!isExpanded && flatListRef.current) {
        InteractionManager.runAfterInteractions(() => {
          try {
            flatListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0 });
          } catch (scrollError) {
            // scrollToIndex can fail with dynamic card heights - acceptable
          }
        });
        incrementOpenCardCount();
      }
    } catch (error) {
      // Critical: this is the main user interaction
      logUIRenderError(error, 'SearchScreenResults', 'handleCardPress');
    }
  };

  // Show donation popup
  useEffect(() => {
    try {
      if (openCardCount === 15) {
        showPopup();
        resetOpenCardCount();
      }
    } catch (error) {
      // Silent fail - donation prompt is non-critical
    }
  }, [openCardCount, showPopup, resetOpenCardCount]);

  const renderItem = useCallback(
    ({ item, index }) => {
      try {
        const questionId = item.QuestionIDIndex;
        return (
          <SearchResultItem
            item={item}
            isExpanded={expandedCardId === questionId}
            onToggle={() => handleCardPress(questionId, index)}
            isSaved={savedQuestions[questionId]}
            onToggleSave={() => handleHeartPress(questionId)}
          />
        );
      } catch (error) {
        return (
          <View style={styles.errorCard}>
            <InterText style={styles.errorCardText}>Item konnte nicht geladen werden</InterText>
          </View>
        );
      }
    },
    [expandedCardId, savedQuestions, handleCardPress, handleHeartPress]
  );

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        ref={flatListRef}
        data={results}
        keyExtractor={(item) => item.QuestionIDIndex}
        contentContainerStyle={{ paddingBottom: 20 }}
        initialNumToRender={10}
        windowSize={5}
        renderItem={renderItem}
        onScrollToIndexFailed={(error) => {
          // Expected with dynamic content - no action needed
        }}
      />
      {showHintBanner && <DonationHintBanner onClose={closeHintBanner} />}
      <Popup visible={isPopupVisible} onClose={closePopup} />
    </View>
  );
};

// Memoized to prevent re-renders when other cards expand/collapse
const SearchResultItem = React.memo(function ({
  item,
  isExpanded,
  onToggle,
  isSaved,
  onToggleSave,
}) {
  let IconComponent;
  try {
    IconComponent = imageMap[item.imagePosition]?.();
  } catch {
    IconComponent = null;
  }

  return (
    <TouchableOpacity
      onPress={onToggle}
      activeOpacity={1}
      accessibilityRole="button"
      accessibilityLabel={`Thema: ${item.QuestionIndex}`}
      accessibilityHint={
        isExpanded
          ? 'Tippe doppelt, um die Antwort zu schließen'
          : 'Tippe doppelt, um die Antwort zu öffnen'
      }
      accessibilityState={{ expanded: isExpanded }}
    >
      <View style={[styles.card, { backgroundColor: '#f3f3f3' }]}>
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
          <InterText style={styles.cardText} accessible={false}>
            {item.QuestionIndex}
          </InterText>
          <TouchableOpacity
            activeOpacity={1}
            onPress={onToggleSave}
            accessibilityLabel={isSaved ? 'Frage entfernen' : 'Frage speichern'}
            accessibilityHint="Tippe doppelt, um diese Frage zu speichern oder zu entfernen"
            accessibilityRole="button"
            accessibilityState={{ selected: isSaved }}
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
            importantForAccessibility={isExpanded ? 'yes' : 'no-hide-descendants'}
            pointerEvents={isExpanded ? 'auto' : 'none'}
          >
            <AnswerContent
              color="#f3f3f3"
              answer={item.AnswerIndex}
              questionId={item.QuestionIDIndex}
              questionText={item.QuestionIndex}
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardText: {
    flex: 1,
    fontSize: 14,
    color: '#56626a',
    marginLeft: 5,
    marginRight: 5,
  },
  image: {
    width: 60,
    height: 60,
    marginRight: 2,
  },
  errorCard: {
    marginVertical: 5,
    marginHorizontal: 10,
    padding: 15,
    borderRadius: 10,
    backgroundColor: '#ffebee',
    borderWidth: 1,
    borderColor: '#f44336',
  },
  errorCardText: {
    fontSize: 14,
    color: '#f44336',
    textAlign: 'center',
  },
});

export default SearchScreenResults;