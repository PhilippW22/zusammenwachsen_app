/**
 * FavoriteTabAnimationContext.js
 * 
 * Provides shake animation for the favorites tab icon.
 * Triggered when a user saves a question to visually indicate where favorites are stored.
 * 
 * Animation duration: 800ms
 * Timeout cleanup prevents memory leaks on unmount
 */

import React, { createContext, useContext, useState, useRef, useEffect } from 'react';

const FavoriteTabAnimationContext = createContext();

export const useFavoriteTabAnimation = () => {
  const context = useContext(FavoriteTabAnimationContext);
 
  if (!context) {
    // Graceful fallback when used outside provider
    return {
      highlight: false,
      triggerHighlight: () => {}
    };
  }
 
  return context;
};

export const FavoriteTabAnimationProvider = ({ children }) => {
  const [highlight, setHighlight] = useState(false);
  const timeoutRef = useRef(null);

  // Cleanup timeout on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  const triggerHighlight = () => {
    // Clear existing timeout to prevent overlapping animations
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    setHighlight(true);
   
    timeoutRef.current = setTimeout(() => {
      setHighlight(false);
      timeoutRef.current = null;
    }, 800);
  };

  const contextValue = { highlight, triggerHighlight };

  return (
    <FavoriteTabAnimationContext.Provider value={contextValue}>
      {children}
    </FavoriteTabAnimationContext.Provider>
  );
};