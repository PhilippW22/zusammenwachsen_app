/**
 * AnswerContent.jsx
 * 
 * Renders markdown-formatted answers with internal deep linking.
 * 
 * Internal navigation:
 * Links in markdown content are question IDs (e.g., "Q123"), not web URLs.
 * Clicking a link navigates to SingleQuestionScreen with that question ID.
 */

import React from 'react';
import { logNavigationError, logUIRenderError } from '../utils/logError';
import { View, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Markdown from 'react-native-markdown-display';
import ShareButton from './ShareButton';
import InterText from './InterText';

const AnswerContent = ({ color, answer, questionId, questionText }) => {
  const navigation = useNavigation();

  // Links are question IDs, not URLs (e.g., "Q123" -> navigate to question Q123)
  const handleLinkPress = (url) => {
    try {
      const targetQuestionId = url;
      navigation.push('SingleQuestionScreen', { questionId: targetQuestionId });
    } catch (error) {
      logNavigationError(error, 'AnswerContent', 'handleLinkPress');
    }
  };

  const renderMarkdown = () => {
    try {
      return (
        <Markdown 
          style={simpleMarkdownStyles}
          onLinkPress={handleLinkPress}
        >
          {answer || ''}
        </Markdown>
      );
    } catch (error) {
      logUIRenderError(error, 'AnswerContent', 'renderMarkdown');

      return (
        <InterText style={simpleMarkdownStyles.body}>
          {answer || 'Antwort konnte nicht geladen werden.'}
        </InterText>
      );
    }
  };

  return (
    <View style={[styles.answerContainer, { backgroundColor: color || "#eff0ea" }]}>
      {renderMarkdown()}
      
      <View style={styles.shareContainer}>
        <ShareButton 
          questionId={questionId} 
          questionText={questionText} 
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  answerContainer: {
    marginTop: 10,
    paddingHorizontal: 15,
    paddingTop: 10,
    paddingBottom: 8,
  },
  shareContainer: {
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 5,
  },
});

const simpleMarkdownStyles = {
  body: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#56626a',
  },
  strong: {
    fontFamily: 'Inter-Bold',
    fontSize: 14,
  },
  em: {
    fontFamily: 'Inter-Italic',
    fontSize: 14,
  },
  heading1: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    marginTop: 10,
    marginBottom: 4,
  },
  paragraph: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    marginTop: 0,
    marginBottom: 4,
  },
  link: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    textDecorationLine: 'underline',
    color: '#3b83bd',
  }
};

export default AnswerContent;