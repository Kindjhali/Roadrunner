/**
 * useNotifications.js - Notification system composable
 * 
 * Following AGENTS.md principles:
 * - Modular, testable components only
 * - Rule of 3: Input → Process → Output
 * - All logic commented and attributed
 * 
 * @version 1.0.0
 * @author Roadrunner Autocoder System
 */

import { ref, reactive, computed } from 'vue'

/**
 * Notification system composable
 * 
 * @returns {Object} Notification interface
 */
export function useNotifications() {
  // State management
  const notifications = ref([])
  const maxNotifications = ref(5)
  const defaultDuration = ref(5000) // 5 seconds
  
  // Settings
  const settings = reactive({
    position: 'top-right', // top-right, top-left, bottom-right, bottom-left
    enableSound: false,
    enableAnimation: true,
    pauseOnHover: true,
    showProgress: true
  })
  
  // Computed properties
  const hasNotifications = computed(() => {
    return notifications.value.length > 0
  })
  
  const notificationsByType = computed(() => {
    return notifications.value.reduce((acc, notification) => {
      const type = notification.type || 'info'
      if (!acc[type]) acc[type] = []
      acc[type].push(notification)
      return acc
    }, {})
  })
  
  /**
   * Add a new notification
   * Input → Process → Output pattern
   * 
   * @param {Object} notification - Notification data
   */
  const addNotification = (notification) => {
    try {
      // Input: Validate notification
      if (!notification || typeof notification !== 'object') {
        throw new Error('Invalid notification object')
      }
      
      if (!notification.message) {
        throw new Error('Notification message is required')
      }
      
      // Process: Create notification object
      const newNotification = {
        id: generateNotificationId(),
        message: notification.message,
        title: notification.title || '',
        type: notification.type || 'info', // info, success, warning, error
        duration: notification.duration !== undefined ? notification.duration : defaultDuration.value,
        persistent: notification.persistent || false,
        actions: notification.actions || [],
        data: notification.data || {},
        createdAt: new Date().toISOString(),
        isVisible: true,
        isPaused: false
      }
      
      // Add to notifications array
      notifications.value.unshift(newNotification)
      
      // Limit number of notifications
      if (notifications.value.length > maxNotifications.value) {
        notifications.value = notifications.value.slice(0, maxNotifications.value)
      }
      
      // Auto-remove if not persistent
      if (!newNotification.persistent && newNotification.duration > 0) {
        setTimeout(() => {
          removeNotification(newNotification.id)
        }, newNotification.duration)
      }
      
      // Play sound if enabled
      if (settings.enableSound) {
        playNotificationSound(newNotification.type)
      }
      
      // Output: Return notification ID
      return newNotification.id
      
    } catch (error) {
      console.error('Failed to add notification:', error)
      throw error
    }
  }
  
  /**
   * Remove a notification
   * 
   * @param {string} id - Notification ID
   */
  const removeNotification = (id) => {
    const index = notifications.value.findIndex(n => n.id === id)
    if (index !== -1) {
      notifications.value.splice(index, 1)
    }
  }
  
  /**
   * Clear all notifications
   * 
   * @param {string} type - Optional type filter
   */
  const clearNotifications = (type = null) => {
    if (type) {
      notifications.value = notifications.value.filter(n => n.type !== type)
    } else {
      notifications.value = []
    }
  }
  
  /**
   * Update notification
   * 
   * @param {string} id - Notification ID
   * @param {Object} updates - Updates to apply
   */
  const updateNotification = (id, updates) => {
    const notification = notifications.value.find(n => n.id === id)
    if (notification) {
      Object.assign(notification, updates)
    }
  }
  
  /**
   * Pause/resume notification auto-removal
   * 
   * @param {string} id - Notification ID
   * @param {boolean} paused - Pause state
   */
  const pauseNotification = (id, paused) => {
    const notification = notifications.value.find(n => n.id === id)
    if (notification) {
      notification.isPaused = paused
    }
  }
  
  // Convenience methods for different notification types
  
  /**
   * Show success notification
   * 
   * @param {string} message - Success message
   * @param {Object} options - Additional options
   */
  const success = (message, options = {}) => {
    return addNotification({
      message,
      type: 'success',
      ...options
    })
  }
  
  /**
   * Show error notification
   * 
   * @param {string} message - Error message
   * @param {Object} options - Additional options
   */
  const error = (message, options = {}) => {
    return addNotification({
      message,
      type: 'error',
      persistent: true, // Errors are persistent by default
      ...options
    })
  }
  
  /**
   * Show warning notification
   * 
   * @param {string} message - Warning message
   * @param {Object} options - Additional options
   */
  const warning = (message, options = {}) => {
    return addNotification({
      message,
      type: 'warning',
      duration: 8000, // Longer duration for warnings
      ...options
    })
  }
  
  /**
   * Show info notification
   * 
   * @param {string} message - Info message
   * @param {Object} options - Additional options
   */
  const info = (message, options = {}) => {
    return addNotification({
      message,
      type: 'info',
      ...options
    })
  }
  
  /**
   * Show loading notification
   * 
   * @param {string} message - Loading message
   * @param {Object} options - Additional options
   */
  const loading = (message, options = {}) => {
    return addNotification({
      message,
      type: 'loading',
      persistent: true, // Loading notifications are persistent
      ...options
    })
  }
  
  /**
   * Update settings
   * 
   * @param {Object} newSettings - Settings to update
   */
  const updateSettings = (newSettings) => {
    Object.assign(settings, newSettings)
  }
  
  /**
   * Get notification statistics
   * 
   * @returns {Object} Statistics
   */
  const getStats = () => {
    const stats = {
      total: notifications.value.length,
      byType: {},
      persistent: 0,
      temporary: 0
    }
    
    notifications.value.forEach(notification => {
      const type = notification.type
      stats.byType[type] = (stats.byType[type] || 0) + 1
      
      if (notification.persistent) {
        stats.persistent++
      } else {
        stats.temporary++
      }
    })
    
    return stats
  }
  
  // Internal helper functions
  
  /**
   * Generate unique notification ID
   * 
   * @returns {string} Unique ID
   */
  const generateNotificationId = () => {
    return 'notification_' + Date.now().toString(36) + Math.random().toString(36).substr(2)
  }
  
  /**
   * Play notification sound
   * 
   * @param {string} type - Notification type
   */
  const playNotificationSound = (type) => {
    try {
      // Create audio context if needed
      if (typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined') {
        const AudioCtx = AudioContext || webkitAudioContext
        const audioContext = new AudioCtx()
        
        // Generate different tones for different types
        const frequencies = {
          success: 800,
          error: 400,
          warning: 600,
          info: 500,
          loading: 300
        }
        
        const frequency = frequencies[type] || 500
        const oscillator = audioContext.createOscillator()
        const gainNode = audioContext.createGain()
        
        oscillator.connect(gainNode)
        gainNode.connect(audioContext.destination)
        
        oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime)
        oscillator.type = 'sine'
        
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime)
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3)
        
        oscillator.start(audioContext.currentTime)
        oscillator.stop(audioContext.currentTime + 0.3)
      }
    } catch (error) {
      console.warn('Failed to play notification sound:', error)
    }
  }
  
  /**
   * Format notification for display
   * 
   * @param {Object} notification - Notification object
   * @returns {Object} Formatted notification
   */
  const formatNotification = (notification) => {
    return {
      ...notification,
      timeAgo: getTimeAgo(notification.createdAt),
      icon: getNotificationIcon(notification.type),
      className: getNotificationClassName(notification.type)
    }
  }
  
  /**
   * Get time ago string
   * 
   * @param {string} timestamp - ISO timestamp
   * @returns {string} Time ago string
   */
  const getTimeAgo = (timestamp) => {
    const now = new Date()
    const created = new Date(timestamp)
    const diffMs = now - created
    const diffSeconds = Math.floor(diffMs / 1000)
    const diffMinutes = Math.floor(diffSeconds / 60)
    const diffHours = Math.floor(diffMinutes / 60)
    
    if (diffSeconds < 60) return 'just now'
    if (diffMinutes < 60) return `${diffMinutes}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return created.toLocaleDateString()
  }
  
  /**
   * Get notification icon
   * 
   * @param {string} type - Notification type
   * @returns {string} Icon name
   */
  const getNotificationIcon = (type) => {
    const icons = {
      success: 'corvidae-validate',
      error: 'passeriformes-error',
      warning: 'passeriformes-warning',
      info: 'passeriformes-info',
      loading: 'passeriformes-loading'
    }
    
    return icons[type] || 'passeriformes-info'
  }
  
  /**
   * Get notification CSS class
   * 
   * @param {string} type - Notification type
   * @returns {string} CSS class
   */
  const getNotificationClassName = (type) => {
    const classes = {
      success: 'notification-success',
      error: 'notification-error',
      warning: 'notification-warning',
      info: 'notification-info',
      loading: 'notification-loading'
    }
    
    return classes[type] || 'notification-info'
  }
  
  return {
    // State
    notifications,
    settings,
    
    // Computed
    hasNotifications,
    notificationsByType,
    
    // Core methods
    addNotification,
    removeNotification,
    clearNotifications,
    updateNotification,
    pauseNotification,
    
    // Convenience methods
    success,
    error,
    warning,
    info,
    loading,
    
    // Utilities
    updateSettings,
    getStats,
    formatNotification
  }
}

export default useNotifications
