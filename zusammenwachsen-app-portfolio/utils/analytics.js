/**
 * analytics.js
 * 
 * DSGVO-compliant analytics implementation.
 * 
 * Privacy features:
 * - No personal data collected
 * - Only minimal event types (card_opened, card_saved, etc.)
 * - Question IDs validated (format: q[0-9a-zA-Z]{1,10})
 * - Event queue for failed requests (max 10 items)
 * - 5s timeout on requests
 * 
 * Events tracked:
 * - card_opened (with questionId)
 * - card_saved (with questionId)
 * - popup_shown
 * - donation_banner_shown
 * - donation_button_clicked
 */

const ANALYTICS_CONFIG = {
  endpoint: 'PLACEHOLDER_ANALYTICS_ENDPOINT',
  enabled: true,
  timeout: 5000,
};

class DSGVOAnalytics {
  constructor() {
    this.isEnabled = ANALYTICS_CONFIG.enabled;
    this.endpoint = ANALYTICS_CONFIG.endpoint;
    this.queue = [];
    this.isInitialized = false;
    this.hasError = false;
    this.error = null;
    this.apiKeyConfigured = !!this.endpoint;
  }

  async initialize() {
    try {
      if (!this.isEnabled) return;
      this.isInitialized = true;
    } catch (error) {
      this.hasError = true;
      this.error = error.message;
    }
  }

  async sendEvent(eventType, questionId = null) {
    if (!this.isEnabled || !this.isInitialized) return;

    try {
      const eventData = {
        event_type: eventType,
        ...(questionId && { question_id: questionId })
      };

      if (!this.validateEvent(eventData)) return;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), ANALYTICS_CONFIG.timeout);

      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventData),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

    } catch (error) {
      // Network failures are non-critical - queue for retry (max 10 items)
      if (this.queue.length < 10) {
        this.queue.push({ eventType, questionId, timestamp: Date.now() });
      }
    }
  }

  // Validate event type and question ID format
  validateEvent(eventData) {
    const validEvents = [
      'card_opened', 
      'card_saved', 
      'popup_shown',
      'donation_banner_shown',
      'donation_button_clicked'
    ];
    
    if (!validEvents.includes(eventData.event_type)) return false;

    // Events without question context should not have questionId
    if (['popup_shown', 'donation_banner_shown', 'donation_button_clicked'].includes(eventData.event_type)) {
      return eventData.question_id === undefined;
    } else {
      // Question events must have valid questionId (format: q[0-9a-zA-Z]{1,10})
      return eventData.question_id && 
             typeof eventData.question_id === 'string' &&
             /^q[0-9a-zA-Z]{1,10}$/.test(eventData.question_id);
    }
  }

  trackCardOpened(questionId) {
    this.sendEvent('card_opened', questionId);
  }

  trackQuestionSaved(questionId) {
    this.sendEvent('card_saved', questionId);
  }

  trackPopupShown() {
    this.sendEvent('popup_shown');
  }

  trackDonationBannerShown() {
    this.sendEvent('donation_banner_shown');
  }

  trackDonationButtonClicked() {
    this.sendEvent('donation_button_clicked');
  }

  getStatus() {
    return {
      isEnabled: this.isEnabled,
      isInitialized: this.isInitialized,
      hasError: this.hasError,
      error: this.error,
      apiKeyConfigured: this.apiKeyConfigured,
      endpoint: this.endpoint,
      queueLength: this.queue.length
    };
  }

  disable() {
    this.isEnabled = false;
  }

  clearQueue() {
    this.queue = [];
  }

  getQueuedEvents() {
    return this.queue;
  }
}

// Singleton instance
const analytics = new DSGVOAnalytics();

export default analytics;

// Convenience exports for backward compatibility
export const trackCardOpened = (questionId) => analytics.trackCardOpened(questionId);
export const trackQuestionSaved = (questionId) => analytics.trackQuestionSaved(questionId);
export const trackPopupShown = () => analytics.trackPopupShown();
export const trackDonationBannerShown = () => analytics.trackDonationBannerShown();
export const trackDonationButtonClicked = () => analytics.trackDonationButtonClicked();

export const initializeAnalytics = () => analytics.initialize();
export const getAnalyticsStatus = () => analytics.getStatus();
export const disableAnalytics = () => analytics.disable();