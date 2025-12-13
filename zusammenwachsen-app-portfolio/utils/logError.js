/**
 * logError.js
 * 
 * GDPR-compliant error logging with Sentry integration.
 * 
 * Privacy features:
 * - Anonymizes all error messages (removes emails, tokens, IDs)
 * - Deduplicates errors (max 500 per session)
 * - Only critical errors sent to Sentry (reduces noise & costs)
 * - Sanitizes tags and extra data (whitelist approach)
 * 
 * Critical error criteria:
 * - Explicit critical tag
 * - Error type (ReferenceError, TypeError, etc.)
 * - Message keywords (render failed, navigation failed, etc.)
 * - UI/component errors
 * 
 * Helper functions:
 * - logNavigationError() - for navigation failures
 * - logUIRenderError() - for component render failures
 * - logDataError() - for data loading failures
 * - logAsyncStorageError() - for storage failures
 */

import * as Sentry from '@sentry/react-native';

// Deduplicate errors within session (max 500 unique errors)
const reportedErrors = new Set();
const MAX_ERROR_CACHE_SIZE = 500;

export function logError(error, {
  context = null,
  tags = {},
  extra = {},
  userMessageCallback = null,
  allowDuplicates = false,
  severity = 'error',
  fingerprint = null,
} = {}) {
  
  try {
    const anonymizedMessage = anonymizeErrorMessage(error.message || 'No message');
    const errorKey = `${error.name || 'UnknownError'}-${anonymizedMessage}`;
    
    // Skip if already reported (unless duplicates allowed)
    if (!allowDuplicates && reportedErrors.has(errorKey)) {
      return;
    }
    
    // Only send critical errors to reduce Sentry traffic
    const isCritical = checkIfCritical(error, tags, extra);
    if (!isCritical) {
      return;
    }
    
    // Memory management: cap at MAX_ERROR_CACHE_SIZE
    if (reportedErrors.size >= MAX_ERROR_CACHE_SIZE) {
      const firstKey = reportedErrors.values().next().value;
      reportedErrors.delete(firstKey);
    }
    
    reportedErrors.add(errorKey);
    
    if (severity === 'error') {
      Sentry.addBreadcrumb({
        message: `Critical Error: ${error.name}`,
        data: {
          component: tags.component,
          errorType: tags.errorType,
        },
        level: severity,
        category: 'error',
      });
    }
    
    const sanitizedError = {
      ...error,
      message: anonymizedMessage,
      stack: undefined, // Stack traces removed for privacy
    };
    
    const cleanTags = sanitizeTags(tags);
    const cleanExtra = sanitizeExtra(extra);
    
    const sentryOptions = {
      tags: cleanTags,
      extra: {
        ...cleanExtra,
        errorKey: errorKey.substring(0, 50),
      },
      level: severity,
    };
    
    if (fingerprint && Array.isArray(fingerprint)) {
      sentryOptions.fingerprint = fingerprint;
    }
    
    Sentry.captureException(sanitizedError, sentryOptions);
    
    if (typeof userMessageCallback === 'function') {
      userMessageCallback("Ein Fehler ist aufgetreten. Bitte versuche es später erneut.");
    }
    
  } catch (sentryError) {
    // Silent fail - Sentry errors shouldn't crash the app
  }
}

// Determine if error is critical enough to report
function checkIfCritical(error, tags, extra) {
  if (tags.critical === true || tags.critical === 'true' || 
      tags.errorType === 'critical' || extra.critical === true) {
    return true;
  }
  
  const criticalTypes = [
    'ReferenceError',
    'TypeError', 
    'SyntaxError',
    'RangeError'
  ];
  
  if (criticalTypes.includes(error.name)) {
    return true;
  }
  
  const criticalMessages = [
    'Cannot read prop',
    'undefined is not',
    'null is not a function',
    '[CRITICAL]',
    'Component render failed',
    'Navigation failed',
    'Critical state corruption',
    'Data array is invalid',
    'Route params are missing',
    'Question not found',
    'Invalid question structure'
  ];
  
  if (criticalMessages.some(msg => error.message?.includes(msg))) {
    return true;
  }
  
  // Component errors are critical
  if (tags.component && (
    error.message?.includes('render') ||
    error.message?.includes('Component') ||
    tags.errorType === 'ui'
  )) {
    return true;
  }
  
  return false;
}

// Whitelist approach: only allowed tags are sent
function sanitizeTags(tags) {
  const allowedTags = [
    'component',
    'errorType', 
    'reason',
    'status',
    'feature',
    'critical'
  ];
  
  const cleanTags = {};
  allowedTags.forEach(key => {
    if (tags[key] !== undefined) {
      cleanTags[key] = String(tags[key]).substring(0, 50);
    }
  });
  
  return cleanTags;
}

// Whitelist approach: only allowed extra data is sent
function sanitizeExtra(extra) {
  const allowedExtra = [
    'errorName',
    'componentName', 
    'method',
    'operation',
    'critical'
  ];
  
  const cleanExtra = {};
  allowedExtra.forEach(key => {
    if (extra[key] !== undefined) {
      cleanExtra[key] = String(extra[key]).substring(0, 100);
    }
  });
  
  return cleanExtra;
}

// Remove sensitive data from error messages
function anonymizeErrorMessage(message) {
  if (!message) return 'No message';
  
  return message
    .replace(/user_?\d+/g, 'user_[ID]')
    .replace(/email=[\w.-]+@[\w.-]+/g, 'email=[HIDDEN]')
    .replace(/token=[\w.-]+/g, 'token=[HIDDEN]')
    .replace(/password=[\w.-]+/g, 'password=[HIDDEN]')
    .replace(/api_key=[\w.-]+/g, 'api_key=[HIDDEN]')
    .replace(/\/users\/\d+/g, '/users/[ID]')
    .replace(/categoryName: '[^']*'/g, "categoryName: '[HIDDEN]'")
    .replace(/questionId: '[^']*'/g, "questionId: '[HIDDEN]'")
    .replace(/file:\/\/\/.*\//g, '')
    .substring(0, 200);
}

export function logUIError(error, componentName, userAction, options = {}) {
  const cleanOptions = {
    tags: {
      errorType: options.tags?.errorType || 'ui',
      component: componentName?.substring(0, 30),
      critical: options.tags?.critical || false,
      ...sanitizeTags(options.tags || {}),
    },
    extra: {
      componentName: componentName?.substring(0, 30),
      method: userAction?.substring(0, 30),
      critical: options.extra?.critical || false,
      ...sanitizeExtra(options.extra || {}),
    },
    fingerprint: options.fingerprint,
    severity: options.severity || 'error',
    allowDuplicates: options.allowDuplicates || false,
  };

  logError(error, cleanOptions);
}

export function logCriticalError(error, componentName, method, options = {}) {
  const cleanOptions = {
    tags: {
      errorType: 'critical',
      component: componentName?.substring(0, 30),
      critical: true,
      ...sanitizeTags(options.tags || {}),
    },
    extra: {
      componentName: componentName?.substring(0, 30),
      method: method?.substring(0, 30),
      critical: true,
      ...sanitizeExtra(options.extra || {}),
    },
    fingerprint: options.fingerprint || [`${componentName}-${method}-critical`],
    severity: 'error',
    allowDuplicates: true,
  };

  logError(error, cleanOptions);
}

export function logAsyncStorageError(error, operation, key, options = {}) {
  if (!checkIfCritical(error, { errorType: 'storage' }, {})) {
    return;
  }
  
  const cleanOptions = {
    tags: {
      errorType: 'storage',
      operation: operation?.substring(0, 20),
      critical: true,
      ...sanitizeTags(options.tags || {}),
    },
    extra: {
      operation: operation?.substring(0, 20),
      critical: true,
      ...sanitizeExtra(options.extra || {}),
    },
    fingerprint: options.fingerprint,
    severity: 'error',
  };

  logError(error, cleanOptions);
}

export function logNetworkError(error, url, method = 'GET', options = {}) {
  if (!checkIfCritical(error, { errorType: 'network' }, {})) {
    return;
  }
  
  const cleanOptions = {
    tags: {
      errorType: 'network',
      method: method,
      critical: true,
      ...sanitizeTags(options.tags || {}),
    },
    extra: {
      method: method,
      critical: true,
      ...sanitizeExtra(options.extra || {}),
    },
    fingerprint: options.fingerprint,
    severity: 'error',
  };

  logError(error, cleanOptions);
}

export function logPerformanceError(error, componentName, operation, metrics = {}, options = {}) {
  if (!checkIfCritical(error, { errorType: 'performance' }, {})) {
    return;
  }
  
  const cleanOptions = {
    tags: {
      errorType: 'performance',
      component: componentName?.substring(0, 30),
      critical: true,
      ...sanitizeTags(options.tags || {}),
    },
    extra: {
      componentName: componentName?.substring(0, 30),
      operation: operation?.substring(0, 30),
      critical: true,
      ...sanitizeExtra(options.extra || {}),
    },
    fingerprint: options.fingerprint,
    severity: options.severity || 'warning',
  };

  logError(error, cleanOptions);
}

export function resetErrorSession() {
  try {
    reportedErrors.clear();
  } catch (error) {
    // Silent fail
  }
}

export function getErrorSessionStats() {
  return {
    totalReportedErrors: reportedErrors.size,
    maxCacheSize: MAX_ERROR_CACHE_SIZE,
    memoryUsage: Math.round(reportedErrors.size / MAX_ERROR_CACHE_SIZE * 100),
  };
}

export function isErrorAlreadyReported(error) {
  const anonymizedMessage = anonymizeErrorMessage(error.message || 'No message');
  const errorKey = `${error.name || 'UnknownError'}-${anonymizedMessage}`;
  return reportedErrors.has(errorKey);
}

export function isSentryAvailable() {
  try {
    return !!(Sentry && Sentry.captureException);
  } catch {
    return false;
  }
}


// Convenience helper: logs navigation errors (1 line instead of 15)
export function logNavigationError(error, componentName, method) {
  const cleanOptions = {
    tags: {
      errorType: 'critical',
      component: componentName?.substring(0, 30),
      critical: true,
      feature: 'navigation',
    },
    extra: {
      componentName: componentName?.substring(0, 30),
      method: method?.substring(0, 30),
      critical: true,
    },
    fingerprint: [`${componentName}-${method}-critical`],
    severity: 'error',
    allowDuplicates: false,
  };

  logError(error, cleanOptions);
}

// Convenience helper: logs UI render errors (1 line instead of 15)
export function logUIRenderError(error, componentName, method) {
  const cleanOptions = {
    tags: {
      errorType: 'critical',
      component: componentName?.substring(0, 30),
      critical: true,
      feature: 'ui',
    },
    extra: {
      componentName: componentName?.substring(0, 30),
      method: method?.substring(0, 30),
      critical: true,
    },
    fingerprint: [`${componentName}-${method}-critical`],
    severity: 'error',
    allowDuplicates: false,
  };

  logError(error, cleanOptions);
}

// Convenience helper: logs data loading errors (1 line instead of 15)
export function logDataError(error, componentName, method) {
  const cleanOptions = {
    tags: {
      errorType: 'critical',
      component: componentName?.substring(0, 30),
      critical: true,
      feature: 'data-loading',
    },
    extra: {
      componentName: componentName?.substring(0, 30),
      method: method?.substring(0, 30),
      critical: true,
    },
    fingerprint: [`${componentName}-${method}-critical`],
    severity: 'error',
    allowDuplicates: false,
  };

  logError(error, cleanOptions);
}


export function logDebugInfo(message, data = {}) {
  // Debug info removed in production
}