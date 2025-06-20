/**
 * main.js - Entry point for Roadrunner Autocoder
 * 
 * Following AGENTS.md principles:
 * - Modular, testable components only
 * - Clean initialization and setup
 * 
 * @version 1.0.0
 * @author Roadrunner Autocoder System
 */

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import FloatingVue from 'floating-vue'
import 'floating-vue/dist/style.css'

// Global styles
import './styles/global.css'
import './styles/theme.css'
import './styles/components.css'
import './styles/utilities.css'

// Create Vue application
const app = createApp(App)

// Create and use Pinia store
const pinia = createPinia()
app.use(pinia)
// Tooltip plugin for unified hover info
app.use(FloatingVue)

// Global error handler
app.config.errorHandler = (err, vm, info) => {
  console.error('Global error:', err)
  console.error('Component:', vm)
  console.error('Error info:', info)
  
  // In production, you might want to send this to an error reporting service
  if (process.env.NODE_ENV === 'production') {
    // Send to error reporting service
  }
}

// Global warning handler
app.config.warnHandler = (msg, vm, trace) => {
  console.warn('Vue warning:', msg)
  console.warn('Component trace:', trace)
}

// Mount the application
app.mount('#app')

// Export app for testing purposes
export default app
