/**
 * FuseSearch.js
 * 
 * Offline fuzzy search with security & performance optimizations.
 * 
 * Key features:
 * - Stopword filtering (preserves negations like "nicht", "kein")
 * - Weighted search (synonyms > questions > concepts)
 * - Rate limiting (5 requests/second)
 * - Security limits (query length, word count, XSS prevention)
 * - Exact match prioritization
 * - Error deduplication (prevents Sentry spam)
 * 
 * Search strategy:
 * 1. Remove stopwords but keep important negations
 * 2. Search across weighted fields (synonyms weighted highest)
 * 3. Prioritize exact matches in results
 * 4. Return max 25 results
 */

import Fuse from 'fuse.js';
import stopwords from 'stopwords-de';
import rawData from '../assets/data/index_data.json';
import { logDataError } from './logError';

const SECURITY_LIMITS = {
  MAX_QUERY_LENGTH: 300,
  MAX_WORD_COUNT: 30,
  MIN_QUERY_LENGTH: 1,
  DANGEROUS_CHARS: /[<>&\x00-\x08\x0B\x0C\x0E-\x1F]/g,
  MAX_REQUESTS_PER_SECOND: 5,
};

// Prevent duplicate error reports to Sentry
const reportedErrors = new Set();
const MAX_ERROR_CACHE_SIZE = 50;

// Rate limiting state
let lastRequestTime = 0;
let requestCount = 0;

// Prepare search index
let indexData;
let fuse;

try {
  indexData = rawData.map(entry => ({
    ...entry,
    SynonymQuestionsIndex: (entry.SynonymQuestionsIndex || []).map(q => q.toLowerCase()),
    QuestionIndex: entry.QuestionIndex,
    SynonymConceptsIndex: (entry.SynonymConceptsIndex || []).map(c => c.toLowerCase())
  }));
} catch (error) {
  logDataError(error, 'FuseSearch', 'indexDataPreprocessing');
  indexData = [];
}

// Weighted search configuration (synonyms > questions > concepts)
const fuseOptions = {
  keys: [
    { name: 'SynonymQuestionsIndex', weight: 1.0 },
    { name: 'QuestionIndex', weight: 0.4 },
    { name: 'SynonymConceptsIndex', weight: 0.2 }
  ],
  threshold: 0.4,
  includeScore: true,
  includeMatches: false,
  shouldSort: true,
  isCaseSensitive: false,
  ignoreLocation: true
};

try {
  fuse = new Fuse(indexData, fuseOptions);
} catch (error) {
  logDataError(error, 'FuseSearch', 'fuseInitialization');
  
  // Fallback: mock Fuse to prevent crashes
  fuse = {
    search: () => []
  };
}

const validateQuery = (query) => {
  try {
    if (typeof query !== 'string') return null;
    
    if (query.length > SECURITY_LIMITS.MAX_QUERY_LENGTH) {
      query = query.substring(0, SECURITY_LIMITS.MAX_QUERY_LENGTH);
    }
    
    if (query.length < SECURITY_LIMITS.MIN_QUERY_LENGTH) return null;

    const words = query.trim().split(/\s+/);
    if (words.length > SECURITY_LIMITS.MAX_WORD_COUNT) {
      query = words.slice(0, SECURITY_LIMITS.MAX_WORD_COUNT).join(' ');
    }

    // Remove potentially dangerous characters (XSS prevention)
    const cleanQuery = query.replace(SECURITY_LIMITS.DANGEROUS_CHARS, '');
    return cleanQuery.trim();
  } catch (error) {
    return null;
  }
};

const checkRateLimit = () => {
  const now = Date.now();
  
  if (now - lastRequestTime > 1000) {
    requestCount = 0;
    lastRequestTime = now;
  }
  
  requestCount++;
  return requestCount <= SECURITY_LIMITS.MAX_REQUESTS_PER_SECOND;
};

// Remove stopwords but preserve negations (important for search intent)
const preprocessQuery = (query) => {
  const errorKey = 'FuseSearch-preprocessQuery';
  
  try {
    if (!query || !query.trim()) return '';
    
    const validatedQuery = validateQuery(query);
    if (!validatedQuery) return '';
    
    const importantWords = ["nicht", "kein", "keine", "ohne", "nein"];
    let words = validatedQuery.toLowerCase().split(/\s+/);
    words = words.filter(word => !stopwords.includes(word) || importantWords.includes(word));
    return words.join(' ');
  } catch (error) {
    // Deduplicate error reports
    if (!reportedErrors.has(errorKey)) {
      if (reportedErrors.size >= MAX_ERROR_CACHE_SIZE) {
        const firstKey = reportedErrors.values().next().value;
        reportedErrors.delete(firstKey);
      }
      reportedErrors.add(errorKey);
    }
    
    const fallbackQuery = validateQuery(query);
    return fallbackQuery?.toLowerCase() || '';
  }
};

/**
 * Main search function
 * Returns max 25 results with exact matches prioritized
 */
export const searchQuestions = (query) => {
  const errorKey = `FuseSearch-searchQuestions-${typeof query}`;
  
  try {
    if (!checkRateLimit()) {
      return []; // Silent throttling
    }

    if (!query || typeof query !== 'string') {
      if (!reportedErrors.has('FuseSearch-invalidQuery')) {
        if (reportedErrors.size >= MAX_ERROR_CACHE_SIZE) {
          const firstKey = reportedErrors.values().next().value;
          reportedErrors.delete(firstKey);
        }
        reportedErrors.add('FuseSearch-invalidQuery');
      }
      return [];
    }

    const optimizedQuery = preprocessQuery(query);
    if (!optimizedQuery) return [];

    if (!fuse || typeof fuse.search !== 'function') {
      if (!reportedErrors.has('FuseSearch-fuseNotInitialized')) {
        if (reportedErrors.size >= MAX_ERROR_CACHE_SIZE) {
          const firstKey = reportedErrors.values().next().value;
          reportedErrors.delete(firstKey);
        }
        reportedErrors.add('FuseSearch-fuseNotInitialized');
        logDataError(new Error('[SEARCH] Fuse.js instance not properly initialized'), 'FuseSearch', 'searchQuestions');
      }
      return [];
    }

    const results = fuse.search(optimizedQuery);
    
    if (!Array.isArray(results)) {
      if (!reportedErrors.has('FuseSearch-invalidResults')) {
        if (reportedErrors.size >= MAX_ERROR_CACHE_SIZE) {
          const firstKey = reportedErrors.values().next().value;
          reportedErrors.delete(firstKey);
        }
        reportedErrors.add('FuseSearch-invalidResults');
      }
      return [];
    }

    // Prioritize exact matches (better UX for precise queries)
    const exactMatch = results.find(res =>
      res.item?.SynonymQuestionsIndex?.some(q =>
        q.includes(optimizedQuery)
      )
    );
    
    if (exactMatch) {
      return [
        exactMatch.item,
        ...results
          .filter(r => r.item !== exactMatch.item)
          .slice(0, 24)
          .map(r => r.item)
      ];
    }
    
    return results.slice(0, 25).map(res => res.item);
    
  } catch (error) {
    // Deduplicate errors by query type
    if (!reportedErrors.has(errorKey)) {
      if (reportedErrors.size >= MAX_ERROR_CACHE_SIZE) {
        const firstKey = reportedErrors.values().next().value;
        reportedErrors.delete(firstKey);
      }
      reportedErrors.add(errorKey);
      logDataError(error, 'FuseSearch', 'searchQuestions');
    }
    
    return [];
  }
};

// Helper: Reset error cache and rate limits
export const resetFuseSearchErrors = () => {
  try {
    const previousSize = reportedErrors.size;
    reportedErrors.clear();
    requestCount = 0;
    lastRequestTime = 0;
    
    if (__DEV__) {
      console.log(`[FuseSearch] Error session & rate limits reset (${previousSize} Einträge entfernt)`);
    }
  } catch (error) {
    // Silent fail
  }
};

// Helper: Get search statistics (useful for debugging)
export const getSearchStats = () => {
  try {
    return {
      indexSize: indexData?.length || 0,
      fuseInitialized: !!fuse && typeof fuse.search === 'function',
      stopwordsCount: stopwords?.length || 0,
      hasRawData: !!rawData,
      reportedErrorsCount: reportedErrors.size,
      maxErrorCacheSize: MAX_ERROR_CACHE_SIZE,
      security: {
        maxQueryLength: SECURITY_LIMITS.MAX_QUERY_LENGTH,
        maxWordCount: SECURITY_LIMITS.MAX_WORD_COUNT,
        currentRequestCount: requestCount,
        maxRequestsPerSecond: SECURITY_LIMITS.MAX_REQUESTS_PER_SECOND,
      }
    };
  } catch (error) {
    return {
      indexSize: 0,
      fuseInitialized: false,
      stopwordsCount: 0,
      hasRawData: false,
      reportedErrorsCount: 0,
      maxErrorCacheSize: MAX_ERROR_CACHE_SIZE,
      security: {
        maxQueryLength: SECURITY_LIMITS.MAX_QUERY_LENGTH,
        maxWordCount: SECURITY_LIMITS.MAX_WORD_COUNT,
        currentRequestCount: 0,
        maxRequestsPerSecond: SECURITY_LIMITS.MAX_REQUESTS_PER_SECOND,
      }
    };
  }
};

export const getSecurityLimits = () => {
  if (__DEV__) {
    return { ...SECURITY_LIMITS };
  }
  return null;
};