/**
 * Browser-compatible EventEmitter implementation
 * 
 * Following AGENTS.md principles:
 * - Modular, testable components only
 * - Clean implementation without Node.js dependencies
 * 
 * @version 1.0.0
 * @author Roadrunner Autocoder System
 */

export class EventEmitter {
  constructor() {
    this.events = new Map()
  }

  /**
   * Add an event listener
   * @param {string} event - Event name
   * @param {Function} listener - Event handler function
   * @returns {EventEmitter} - Returns this for chaining
   */
  on(event, listener) {
    if (!this.events.has(event)) {
      this.events.set(event, [])
    }
    this.events.get(event).push(listener)
    return this
  }

  /**
   * Add a one-time event listener
   * @param {string} event - Event name
   * @param {Function} listener - Event handler function
   * @returns {EventEmitter} - Returns this for chaining
   */
  once(event, listener) {
    const onceWrapper = (...args) => {
      listener(...args)
      this.off(event, onceWrapper)
    }
    return this.on(event, onceWrapper)
  }

  /**
   * Remove an event listener
   * @param {string} event - Event name
   * @param {Function} listener - Event handler function to remove
   * @returns {EventEmitter} - Returns this for chaining
   */
  off(event, listener) {
    if (!this.events.has(event)) {
      return this
    }
    
    const listeners = this.events.get(event)
    const index = listeners.indexOf(listener)
    
    if (index !== -1) {
      listeners.splice(index, 1)
    }
    
    if (listeners.length === 0) {
      this.events.delete(event)
    }
    
    return this
  }

  /**
   * Remove all listeners for an event, or all events if no event specified
   * @param {string} [event] - Event name (optional)
   * @returns {EventEmitter} - Returns this for chaining
   */
  removeAllListeners(event) {
    if (event) {
      this.events.delete(event)
    } else {
      this.events.clear()
    }
    return this
  }

  /**
   * Emit an event
   * @param {string} event - Event name
   * @param {...any} args - Arguments to pass to listeners
   * @returns {boolean} - Returns true if event had listeners
   */
  emit(event, ...args) {
    if (!this.events.has(event)) {
      return false
    }
    
    const listeners = this.events.get(event).slice() // Copy array to avoid issues if listeners are modified during emit
    
    for (const listener of listeners) {
      try {
        listener(...args)
      } catch (error) {
        console.error(`Error in event listener for '${event}':`, error)
      }
    }
    
    return true
  }

  /**
   * Get the number of listeners for an event
   * @param {string} event - Event name
   * @returns {number} - Number of listeners
   */
  listenerCount(event) {
    return this.events.has(event) ? this.events.get(event).length : 0
  }

  /**
   * Get all event names that have listeners
   * @returns {string[]} - Array of event names
   */
  eventNames() {
    return Array.from(this.events.keys())
  }

  /**
   * Get all listeners for an event
   * @param {string} event - Event name
   * @returns {Function[]} - Array of listener functions
   */
  listeners(event) {
    return this.events.has(event) ? this.events.get(event).slice() : []
  }
}

// Export as default for easier importing
export default EventEmitter
