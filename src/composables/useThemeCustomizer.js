/**
 * useThemeCustomizer.js - Theme customization composable
 * 
 * Following AGENTS.md principles:
 * - Modular, testable components only
 * - Rule of 3: Input → Process → Output
 * - All logic commented and attributed
 * 
 * @version 1.0.0
 * @author Roadrunner Autocoder System
 */

import { ref, reactive } from 'vue'

/**
 * Theme customizer composable for advanced theming
 * 
 * @returns {Object} Theme customization interface
 */
export function useThemeCustomizer() {
  
  /**
   * Apply theme settings to the application
   * Input → Process → Output pattern
   * 
   * @param {Object} settings - Theme settings
   */
  const applyThemeSettings = (settings) => {
    try {
      // Input: Validate settings
      if (!settings || typeof settings !== 'object') {
        throw new Error('Invalid theme settings')
      }
      
      // Process: Apply CSS custom properties
      const root = document.documentElement
      
      if (settings.colors) {
        Object.entries(settings.colors).forEach(([key, value]) => {
          const cssVar = `--color-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`
          root.style.setProperty(cssVar, value)
        })
      }
      
      if (settings.typography) {
        if (settings.typography.fontFamily) {
          root.style.setProperty('--font-family-primary', settings.typography.fontFamily)
        }
        if (settings.typography.scale) {
          root.style.setProperty('--font-scale', settings.typography.scale.toString())
        }
        if (settings.typography.lineHeight) {
          root.style.setProperty('--line-height-base', settings.typography.lineHeight.toString())
        }
        if (settings.typography.letterSpacing) {
          root.style.setProperty('--letter-spacing-base', `${settings.typography.letterSpacing}em`)
        }
      }
      
      if (settings.layout) {
        if (settings.layout.borderRadius) {
          root.style.setProperty('--border-radius-base', settings.layout.borderRadius)
        }
        if (settings.layout.spacingScale) {
          root.style.setProperty('--spacing-scale', settings.layout.spacingScale.toString())
        }
        if (settings.layout.sidebarWidth) {
          root.style.setProperty('--sidebar-width', `${settings.layout.sidebarWidth}px`)
        }
        if (settings.layout.contentMaxWidth) {
          root.style.setProperty('--content-max-width', `${settings.layout.contentMaxWidth}px`)
        }
      }
      
      // Output: Apply theme mode
      if (settings.mode) {
        document.documentElement.setAttribute('data-theme', settings.mode)
      }
      
      console.log('Theme settings applied successfully')
      
    } catch (error) {
      console.error('Failed to apply theme settings:', error)
      throw error
    }
  }
  
  /**
   * Generate CSS from theme settings
   * 
   * @param {Object} settings - Theme settings
   * @returns {string} Generated CSS
   */
  const generateThemeCSS = (settings) => {
    let css = ':root {\n'
    
    // Colors
    if (settings.colors) {
      Object.entries(settings.colors).forEach(([key, value]) => {
        const cssVar = `--color-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`
        css += `  ${cssVar}: ${value};\n`
      })
    }
    
    // Typography
    if (settings.typography) {
      if (settings.typography.fontFamily) {
        css += `  --font-family-primary: ${settings.typography.fontFamily};\n`
      }
      if (settings.typography.scale) {
        css += `  --font-scale: ${settings.typography.scale};\n`
      }
      if (settings.typography.lineHeight) {
        css += `  --line-height-base: ${settings.typography.lineHeight};\n`
      }
      if (settings.typography.letterSpacing) {
        css += `  --letter-spacing-base: ${settings.typography.letterSpacing}em;\n`
      }
    }
    
    // Layout
    if (settings.layout) {
      if (settings.layout.borderRadius) {
        css += `  --border-radius-base: ${settings.layout.borderRadius};\n`
      }
      if (settings.layout.spacingScale) {
        css += `  --spacing-scale: ${settings.layout.spacingScale};\n`
      }
      if (settings.layout.sidebarWidth) {
        css += `  --sidebar-width: ${settings.layout.sidebarWidth}px;\n`
      }
      if (settings.layout.contentMaxWidth) {
        css += `  --content-max-width: ${settings.layout.contentMaxWidth}px;\n`
      }
    }
    
    css += '}\n'
    
    return css
  }
  
  /**
   * Validate theme settings
   * 
   * @param {Object} settings - Theme settings to validate
   * @returns {Object} Validation result
   */
  const validateThemeSettings = (settings) => {
    const errors = []
    
    try {
      // Validate colors
      if (settings.colors) {
        Object.entries(settings.colors).forEach(([key, value]) => {
          if (!isValidColor(value)) {
            errors.push(`Invalid color value for ${key}: ${value}`)
          }
        })
      }
      
      // Validate typography
      if (settings.typography) {
        if (settings.typography.scale && (settings.typography.scale < 0.5 || settings.typography.scale > 3)) {
          errors.push('Typography scale must be between 0.5 and 3')
        }
        if (settings.typography.lineHeight && (settings.typography.lineHeight < 1 || settings.typography.lineHeight > 3)) {
          errors.push('Line height must be between 1 and 3')
        }
        if (settings.typography.letterSpacing && (settings.typography.letterSpacing < -0.1 || settings.typography.letterSpacing > 0.2)) {
          errors.push('Letter spacing must be between -0.1 and 0.2')
        }
      }
      
      // Validate layout
      if (settings.layout) {
        if (settings.layout.spacingScale && (settings.layout.spacingScale < 0.5 || settings.layout.spacingScale > 3)) {
          errors.push('Spacing scale must be between 0.5 and 3')
        }
        if (settings.layout.sidebarWidth && (settings.layout.sidebarWidth < 200 || settings.layout.sidebarWidth > 500)) {
          errors.push('Sidebar width must be between 200 and 500 pixels')
        }
        if (settings.layout.contentMaxWidth && (settings.layout.contentMaxWidth < 800 || settings.layout.contentMaxWidth > 2000)) {
          errors.push('Content max width must be between 800 and 2000 pixels')
        }
      }
      
      return {
        isValid: errors.length === 0,
        errors
      }
      
    } catch (error) {
      return {
        isValid: false,
        errors: [`Validation error: ${error.message}`]
      }
    }
  }
  
  /**
   * Get default theme settings
   * 
   * @returns {Object} Default theme settings
   */
  const getDefaultTheme = () => {
    return {
      colors: {
        primary: '#FF6A00',
        secondary: '#6B7280',
        accent: '#10B981',
        background: '#FFFFFF',
        surface: '#F9FAFB',
        textPrimary: '#111827'
      },
      typography: {
        fontFamily: 'Inter, system-ui, sans-serif',
        scale: 1.0,
        lineHeight: 1.6,
        letterSpacing: 0
      },
      layout: {
        borderRadius: '0.5rem',
        spacingScale: 1.0,
        sidebarWidth: 280,
        contentMaxWidth: 1280
      },
      mode: 'light',
      autoMode: {
        lightStart: '06:00',
        darkStart: '18:00'
      }
    }
  }
  
  /**
   * Export theme settings
   * 
   * @param {Object} settings - Theme settings
   * @param {string} format - Export format
   * @returns {string} Exported theme data
   */
  const exportTheme = (settings, format = 'json') => {
    const themeData = {
      name: 'Custom Theme',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      settings
    }
    
    switch (format) {
      case 'json':
        return JSON.stringify(themeData, null, 2)
      
      case 'css':
        return generateThemeCSS(settings)
      
      default:
        throw new Error(`Unsupported export format: ${format}`)
    }
  }
  
  /**
   * Import theme settings
   * 
   * @param {string} data - Theme data
   * @param {string} format - Data format
   * @returns {Object} Parsed theme settings
   */
  const importTheme = (data, format = 'json') => {
    try {
      switch (format) {
        case 'json': {
          const parsed = JSON.parse(data)
          return parsed.settings || parsed
        }
        
        default:
          throw new Error(`Unsupported import format: ${format}`)
      }
    } catch (error) {
      throw new Error(`Failed to import theme: ${error.message}`)
    }
  }
  
  /**
   * Get current theme settings from CSS
   * 
   * @returns {Object} Current theme settings
   */
  const getCurrentTheme = () => {
    const root = document.documentElement
    const computedStyle = getComputedStyle(root)
    
    return {
      colors: {
        primary: computedStyle.getPropertyValue('--color-primary').trim(),
        secondary: computedStyle.getPropertyValue('--color-secondary').trim(),
        accent: computedStyle.getPropertyValue('--color-accent').trim(),
        background: computedStyle.getPropertyValue('--color-background').trim(),
        surface: computedStyle.getPropertyValue('--color-surface').trim(),
        textPrimary: computedStyle.getPropertyValue('--color-text-primary').trim()
      },
      typography: {
        fontFamily: computedStyle.getPropertyValue('--font-family-primary').trim(),
        scale: parseFloat(computedStyle.getPropertyValue('--font-scale').trim()) || 1.0,
        lineHeight: parseFloat(computedStyle.getPropertyValue('--line-height-base').trim()) || 1.6,
        letterSpacing: parseFloat(computedStyle.getPropertyValue('--letter-spacing-base').trim()) || 0
      },
      layout: {
        borderRadius: computedStyle.getPropertyValue('--border-radius-base').trim(),
        spacingScale: parseFloat(computedStyle.getPropertyValue('--spacing-scale').trim()) || 1.0,
        sidebarWidth: parseInt(computedStyle.getPropertyValue('--sidebar-width').trim()) || 280,
        contentMaxWidth: parseInt(computedStyle.getPropertyValue('--content-max-width').trim()) || 1280
      },
      mode: document.documentElement.getAttribute('data-theme') || 'light'
    }
  }
  
  // Helper functions
  
  /**
   * Validate color format
   * 
   * @param {string} color - Color value to validate
   * @returns {boolean} Is valid color
   */
  const isValidColor = (color) => {
    if (!color || typeof color !== 'string') return false
    
    // Test hex colors
    if (/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color)) return true
    
    // Test rgb/rgba colors
    if (/^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(,\s*[\d.]+)?\s*\)$/.test(color)) return true
    
    // Test hsl/hsla colors
    if (/^hsla?\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%\s*(,\s*[\d.]+)?\s*\)$/.test(color)) return true
    
    // Test named colors (basic check)
    const namedColors = ['red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink', 'brown', 'black', 'white', 'gray', 'grey']
    if (namedColors.includes(color.toLowerCase())) return true
    
    return false
  }
  
  /**
   * Convert color to hex format
   * 
   * @param {string} color - Color value
   * @returns {string} Hex color
   */
  const colorToHex = (color) => {
    // Create a temporary element to get computed color
    const div = document.createElement('div')
    div.style.color = color
    document.body.appendChild(div)
    
    const computedColor = getComputedStyle(div).color
    document.body.removeChild(div)
    
    // Convert rgb to hex
    const rgb = computedColor.match(/\d+/g)
    if (rgb) {
      return '#' + rgb.map(x => parseInt(x).toString(16).padStart(2, '0')).join('')
    }
    
    return color
  }
  
  return {
    // Core functions
    applyThemeSettings,
    generateThemeCSS,
    validateThemeSettings,
    getDefaultTheme,
    getCurrentTheme,
    
    // Import/Export
    exportTheme,
    importTheme,
    
    // Utilities
    isValidColor,
    colorToHex
  }
}

export default useThemeCustomizer
