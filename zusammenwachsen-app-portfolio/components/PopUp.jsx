/**
 * PopUp.jsx
 * 
 * Modal donation prompt with rotating content and quick donation options.
 * Shows after user opens 14 cards.
 * 
 * Features:
 * - 4 rotating popup messages (cycled via popupIndex)
 * - 3 quick IAP buttons for donations
 * - Link to full donations screen
 * - Graceful error handling with fallback content
 */

import React from 'react';
import { View, Modal, StyleSheet, TouchableOpacity, Image } from 'react-native';
import Icon from '../components/Icon';
import InterText from '../components/InterText';
import TipButton from './TipButton';
import { useNavigation } from '@react-navigation/native';
import { logUIRenderError, logNavigationError } from '../utils/logError';
import { POPUP_TIP_OPTIONS } from '../utils/iapService';

const popups = [
  {
    text: `Kleine Beiträge bewirken Großes.\n\nDiese App lebt von vielen helfenden Händen.\n\nSchon ein kleiner Betrag, eine Bewertung oder das Weitererzählen hilft enorm.\n\nDanke, dass du mithilfst!`,
    image: require('../assets/images/donation1.png'),
  },
  {
    text: `Dein Beitrag macht den Unterschied.\n\nWir arbeiten ohne Werbung oder Bezahlschranke.\n\nMit deiner Hilfe bleibt das auch so.`,
    image: require('../assets/images/donation2.png'),
  },
  {
    text: `Wusstest du, dass jede Funktion in dieser App während der Elternzeit entstanden ist?\n\nDeine Unterstützung hilft, dass wir daran weiterarbeiten können – Schritt für Schritt.`,
    image: require('../assets/images/donation3.png'),
  },
  {
    text: `Kein großes Unternehmen, sondern ein Herzensprojekt für Familien.\n\nSchön, dass du dabei bist.\n\nUnterstütze uns dabei, dass daraus noch mehr wachsen kann.`,
    image: require('../assets/images/donation4.png'),
  }
];

const Popup = ({ visible, onClose, popupIndex = 0 }) => {
  const navigation = useNavigation();

  // Safely get popup content with modulo to prevent out-of-bounds
  const getPopupContent = () => {
    try {
      const safeIndex = Math.max(0, popupIndex) % popups.length;
      const selectedContent = popups[safeIndex];

      if (!selectedContent?.text) {
        throw new Error('[POPUP] Selected popup content is invalid');
      }

      return selectedContent;
    } catch (error) {
      logUIRenderError(error, 'Popup', 'getPopupContent');

      return {
        text: 'Danke für deine Unterstützung! 💛',
        image: popups[0]?.image || null
      };
    }
  };

  const content = getPopupContent();

  const handleMoreOptions = () => {
    try {
      if (typeof onClose === 'function') {
        onClose();
      }
      
      if (navigation?.navigate) {
        navigation.navigate('DonationsTab');
      }
    } catch (error) {
      logNavigationError(error, 'Popup', 'handleMoreOptions');
    }
  };

  const handleClose = () => {
    if (onClose && typeof onClose === 'function') {
      onClose();
    }
  };

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={handleClose}
      accessible={true}
      accessibilityViewIsModal={true}
      accessibilityLabel="Unterstuetzenhinweis"
      accessibilityHint="Enthält eine Nachricht mit Unterstützungsmöglichkeiten. Wische weiter, um Aktionen zu sehen."
    >
      <View style={styles.centeredView}>
        <View style={styles.modalView}>
          {content.image ? (
            <Image
              source={content.image}
              style={styles.image}
              resizeMode="contain"
              accessible={true}
              accessibilityLabel="Illustration: Menschen mit Unterstützerbox und Herzen"
            />
          ) : (
            <View style={styles.placeholderImage}>
              <InterText style={styles.placeholderText}>💛</InterText>
            </View>
          )}
          
          <InterText style={styles.modalText}>
            {content.text || 'Danke für deine Unterstützung!'}
          </InterText>

          {/* Quick donation options */}
          <View style={styles.tipButtonsContainer}>
            {POPUP_TIP_OPTIONS.map((opt) => (
              <TipButton 
                key={opt.id} 
                productId={opt.id} 
                label={opt.label} 
                compact={true}
              />
            ))}
          </View>

          <TouchableOpacity 
            onPress={handleMoreOptions} 
            style={styles.moreBtn} 
            accessibilityRole="button"
            accessibilityLabel="Weitere Möglichkeiten"
            accessibilityHint="Tippe doppelt, um weitere Unterstützungsoptionen zu sehen"
          >
            <InterText style={styles.moreBtnText}>Weitere Möglichkeiten</InterText>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleClose}
            accessibilityRole="button"
            accessibilityLabel="Popup schließen"
            accessibilityHint="Tippe doppelt, um dieses Fenster zu schließen"
            style={styles.closeButton}
          >
            <Icon name="close" size={24} color="black" /> {/* ✅ Angepasst für Icon.js */}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalView: {
    margin: 20,
    backgroundColor: '#fefbe9',
    borderRadius: 10,
    padding: 25,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.50,
    shadowRadius: 4,
    elevation: 5,
    position: 'relative',
  },
  image: {
    width: 150,
    height: 150,
    marginBottom: 15,
  },
  modalText: {
    marginBottom: 12,
    textAlign: 'center',
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#56626a',
  },
  tipButtonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 15,
  },
  placeholderImage: {
    width: 150,
    height: 150,
    marginBottom: 15,
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 48,
    color: '#ccc',
  },
  moreBtn: {
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#c0897f',
  },
  moreBtnText: {
    color: '#c0897f',
    fontFamily: 'Inter-Bold',
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
});

export default Popup;