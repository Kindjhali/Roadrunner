<!--
  ThemeCustomizer.vue - Advanced theme customization interface
  
  Following AGENTS.md principles:
  - No inline code or styles
  - Modular, testable components only
  - All logic in composables and services
  
  @version 1.0.0
  @author Roadrunner Autocoder System
-->

<template>
  <div class="theme-customizer">
    <!-- Color Customization -->
    <div class="customization-section">
      <h4 class="section-title">
        <Icon name="passeriformes-palette" size="sm" />
        Color Palette
      </h4>
      
      <div class="color-grid">
        <!-- Primary Colors -->
        <div class="color-group">
          <label class="color-label">Primary Color</label>
          <div class="color-input-group">
            <input
              v-model="localSettings.colors.primary"
              type="color"
              class="color-picker"
              @input="updateColor('primary', $event.target.value)"
            />
            <input
              v-model="localSettings.colors.primary"
              type="text"
              class="color-text-input"
              placeholder="#FF6A00"
              @input="updateColor('primary', $event.target.value)"
            />
          </div>
          <div class="color-preview" :style="{ backgroundColor: localSettings.colors.primary }"></div>
        </div>
        
        <!-- Secondary Colors -->
        <div class="color-group">
          <label class="color-label">Secondary Color</label>
          <div class="color-input-group">
            <input
              v-model="localSettings.colors.secondary"
              type="color"
              class="color-picker"
              @input="updateColor('secondary', $event.target.value)"
            />
            <input
              v-model="localSettings.colors.secondary"
              type="text"
              class="color-text-input"
              placeholder="#6B7280"
              @input="updateColor('secondary', $event.target.value)"
            />
          </div>
          <div class="color-preview" :style="{ backgroundColor: localSettings.colors.secondary }"></div>
        </div>
        
        <!-- Accent Colors -->
        <div class="color-group">
          <label class="color-label">Accent Color</label>
          <div class="color-input-group">
            <input
              v-model="localSettings.colors.accent"
              type="color"
              class="color-picker"
              @input="updateColor('accent', $event.target.value)"
            />
            <input
              v-model="localSettings.colors.accent"
              type="text"
              class="color-text-input"
              placeholder="#10B981"
              @input="updateColor('accent', $event.target.value)"
            />
          </div>
          <div class="color-preview" :style="{ backgroundColor: localSettings.colors.accent }"></div>
        </div>
        
        <!-- Background Colors -->
        <div class="color-group">
          <label class="color-label">Background</label>
          <div class="color-input-group">
            <input
              v-model="localSettings.colors.background"
              type="color"
              class="color-picker"
              @input="updateColor('background', $event.target.value)"
            />
            <input
              v-model="localSettings.colors.background"
              type="text"
              class="color-text-input"
              placeholder="#FFFFFF"
              @input="updateColor('background', $event.target.value)"
            />
          </div>
          <div class="color-preview" :style="{ backgroundColor: localSettings.colors.background }"></div>
        </div>
        
        <!-- Surface Colors -->
        <div class="color-group">
          <label class="color-label">Surface</label>
          <div class="color-input-group">
            <input
              v-model="localSettings.colors.surface"
              type="color"
              class="color-picker"
              @input="updateColor('surface', $event.target.value)"
            />
            <input
              v-model="localSettings.colors.surface"
              type="text"
              class="color-text-input"
              placeholder="#F9FAFB"
              @input="updateColor('surface', $event.target.value)"
            />
          </div>
          <div class="color-preview" :style="{ backgroundColor: localSettings.colors.surface }"></div>
        </div>
        
        <!-- Text Colors -->
        <div class="color-group">
          <label class="color-label">Text Primary</label>
          <div class="color-input-group">
            <input
              v-model="localSettings.colors.textPrimary"
              type="color"
              class="color-picker"
              @input="updateColor('textPrimary', $event.target.value)"
            />
            <input
              v-model="localSettings.colors.textPrimary"
              type="text"
              class="color-text-input"
              placeholder="#111827"
              @input="updateColor('textPrimary', $event.target.value)"
            />
          </div>
          <div class="color-preview" :style="{ backgroundColor: localSettings.colors.textPrimary }"></div>
        </div>
      </div>
      
      <!-- Predefined Color Schemes -->
      <div class="color-schemes">
        <h5 class="schemes-title">Predefined Schemes</h5>
        <div class="schemes-grid">
          <div
            v-for="scheme in colorSchemes"
            :key="scheme.name"
            class="color-scheme"
            :class="{ 'color-scheme--active': isActiveScheme(scheme) }"
            @click="applyColorScheme(scheme)"
          >
            <div class="scheme-preview">
              <div
                v-for="color in scheme.preview"
                :key="color"
                class="scheme-color"
                :style="{ backgroundColor: color }"
              ></div>
            </div>
            <span class="scheme-name">{{ scheme.name }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Typography -->
    <div class="customization-section">
      <h4 class="section-title">
        <Icon name="passeriformes-text" size="sm" />
        Typography
      </h4>
      
      <div class="typography-controls">
        <!-- Font Family -->
        <div class="control-group">
          <label class="control-label">Font Family</label>
          <select
            v-model="localSettings.typography.fontFamily"
            class="font-select"
            @change="updateTypography"
          >
            <option value="Inter, system-ui, sans-serif">Inter (Default)</option>
            <option value="Roboto, sans-serif">Roboto</option>
            <option value="Open Sans, sans-serif">Open Sans</option>
            <option value="Lato, sans-serif">Lato</option>
            <option value="Poppins, sans-serif">Poppins</option>
            <option value="Montserrat, sans-serif">Montserrat</option>
            <option value="Source Sans Pro, sans-serif">Source Sans Pro</option>
            <option value="system-ui, sans-serif">System Default</option>
          </select>
        </div>
        
        <!-- Font Size Scale -->
        <div class="control-group">
          <label class="control-label">Font Size Scale</label>
          <div class="scale-control">
            <input
              v-model.number="localSettings.typography.scale"
              type="range"
              min="0.8"
              max="1.4"
              step="0.1"
              class="scale-slider"
              @input="updateTypography"
            />
            <span class="scale-value">{{ localSettings.typography.scale }}x</span>
          </div>
        </div>
        
        <!-- Line Height -->
        <div class="control-group">
          <label class="control-label">Line Height</label>
          <div class="scale-control">
            <input
              v-model.number="localSettings.typography.lineHeight"
              type="range"
              min="1.2"
              max="2.0"
              step="0.1"
              class="scale-slider"
              @input="updateTypography"
            />
            <span class="scale-value">{{ localSettings.typography.lineHeight }}</span>
          </div>
        </div>
        
        <!-- Letter Spacing -->
        <div class="control-group">
          <label class="control-label">Letter Spacing</label>
          <div class="scale-control">
            <input
              v-model.number="localSettings.typography.letterSpacing"
              type="range"
              min="-0.05"
              max="0.1"
              step="0.01"
              class="scale-slider"
              @input="updateTypography"
            />
            <span class="scale-value">{{ localSettings.typography.letterSpacing }}em</span>
          </div>
        </div>
      </div>
      
      <!-- Typography Preview -->
      <div class="typography-preview" :style="typographyPreviewStyle">
        <h1>Heading 1 - Large Title</h1>
        <h2>Heading 2 - Section Title</h2>
        <h3>Heading 3 - Subsection</h3>
        <p>This is a paragraph of body text to demonstrate the typography settings. It shows how the font family, size, line height, and letter spacing work together.</p>
        <small>Small text for captions and metadata</small>
      </div>
    </div>

    <!-- Layout Preferences -->
    <div class="customization-section">
      <h4 class="section-title">
        <Icon name="furnariidae-layout" size="sm" />
        Layout & Spacing
      </h4>
      
      <div class="layout-controls">
        <!-- Border Radius -->
        <div class="control-group">
          <label class="control-label">Border Radius</label>
          <div class="radius-options">
            <button
              v-for="radius in borderRadiusOptions"
              :key="radius.value"
              class="radius-option"
              :class="{ 'radius-option--active': localSettings.layout.borderRadius === radius.value }"
              @click="updateLayout('borderRadius', radius.value)"
            >
              <div class="radius-preview" :style="{ borderRadius: radius.preview }"></div>
              <span>{{ radius.label }}</span>
            </button>
          </div>
        </div>
        
        <!-- Spacing Scale -->
        <div class="control-group">
          <label class="control-label">Spacing Scale</label>
          <div class="scale-control">
            <input
              v-model.number="localSettings.layout.spacingScale"
              type="range"
              min="0.5"
              max="2.0"
              step="0.1"
              class="scale-slider"
              @input="updateLayout('spacingScale', $event.target.value)"
            />
            <span class="scale-value">{{ localSettings.layout.spacingScale }}x</span>
          </div>
        </div>
        
        <!-- Sidebar Width -->
        <div class="control-group">
          <label class="control-label">Sidebar Width</label>
          <div class="scale-control">
            <input
              v-model.number="localSettings.layout.sidebarWidth"
              type="range"
              min="200"
              max="400"
              step="20"
              class="scale-slider"
              @input="updateLayout('sidebarWidth', $event.target.value)"
            />
            <span class="scale-value">{{ localSettings.layout.sidebarWidth }}px</span>
          </div>
        </div>
        
        <!-- Content Max Width -->
        <div class="control-group">
          <label class="control-label">Content Max Width</label>
          <div class="scale-control">
            <input
              v-model.number="localSettings.layout.contentMaxWidth"
              type="range"
              min="1024"
              max="1920"
              step="64"
              class="scale-slider"
              @input="updateLayout('contentMaxWidth', $event.target.value)"
            />
            <span class="scale-value">{{ localSettings.layout.contentMaxWidth }}px</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Theme Mode -->
    <div class="customization-section">
      <h4 class="section-title">
        <Icon name="passeriformes-moon" size="sm" />
        Theme Mode
      </h4>
      
      <div class="theme-mode-controls">
        <div class="mode-options">
          <button
            v-for="mode in themeModes"
            :key="mode.value"
            class="mode-option"
            :class="{ 'mode-option--active': localSettings.mode === mode.value }"
            @click="updateMode(mode.value)"
          >
            <Icon :name="mode.icon" size="lg" />
            <span>{{ mode.label }}</span>
          </button>
        </div>
        
        <!-- Auto Mode Settings -->
        <div v-if="localSettings.mode === 'auto'" class="auto-mode-settings">
          <div class="control-group">
            <label class="control-label">Auto Switch Time</label>
            <div class="time-inputs">
              <div class="time-input">
                <label>Light Mode Start</label>
                <input
                  v-model="localSettings.autoMode.lightStart"
                  type="time"
                  class="time-field"
                  @change="updateAutoMode"
                />
              </div>
              <div class="time-input">
                <label>Dark Mode Start</label>
                <input
                  v-model="localSettings.autoMode.darkStart"
                  type="time"
                  class="time-field"
                  @change="updateAutoMode"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Preview Section -->
    <div class="customization-section">
      <h4 class="section-title">
        <Icon name="corvidae-preview" size="sm" />
        Live Preview
      </h4>
      
      <div class="theme-preview" :style="previewStyle">
        <div class="preview-header">
          <h3>Roadrunner Autocoder</h3>
          <div class="preview-buttons">
            <button class="preview-btn preview-btn--primary">Primary</button>
            <button class="preview-btn preview-btn--secondary">Secondary</button>
          </div>
        </div>
        
        <div class="preview-content">
          <div class="preview-sidebar">
            <div class="preview-nav-item preview-nav-item--active">Planning</div>
            <div class="preview-nav-item">Execution</div>
            <div class="preview-nav-item">Configuration</div>
          </div>
          
          <div class="preview-main">
            <div class="preview-card">
              <h4>Sample Card</h4>
              <p>This is how your content will look with the current theme settings.</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="theme-actions">
      <BaseButton
        variant="ghost"
        size="sm"
        icon="corvidae-validate"
        @click="resetToDefaults"
      >
        Reset to Defaults
      </BaseButton>
      
      <BaseButton
        variant="secondary"
        size="sm"
        icon="turdus-export"
        @click="exportTheme"
      >
        Export Theme
      </BaseButton>
      
      <BaseButton
        variant="primary"
        size="sm"
        icon="accipiter-save"
        @click="applyTheme"
      >
        Apply Theme
      </BaseButton>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch, onMounted } from 'vue'
import { useThemeCustomizer } from '../../composables/useThemeCustomizer.js'
import BaseButton from '../shared/BaseButton.vue'
import Icon from '../shared/Icon.vue'

/**
 * ThemeCustomizer Component
 * 
 * Advanced theme customization interface:
 * 1. Color palette customization
 * 2. Typography controls
 * 3. Layout preferences
 * 4. Live preview
 * 5. Theme export/import
 */
export default {
  name: 'ThemeCustomizer',
  
  components: {
    BaseButton,
    Icon
  },
  
  props: {
    settings: {
      type: Object,
      default: () => ({})
    }
  },
  
  emits: ['update'],
  
  setup(props, { emit }) {
    // Composables
    const {
      applyThemeSettings,
      generateThemeCSS,
      validateThemeSettings,
      getDefaultTheme
    } = useThemeCustomizer()
    
    // Local settings state
    const localSettings = ref({
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
    })
    
    // Predefined color schemes
    const colorSchemes = ref([
      {
        name: 'Neo Art Deco (Default)',
        colors: {
          primary: '#FF6A00',
          secondary: '#6B7280',
          accent: '#10B981',
          background: '#FFFFFF',
          surface: '#F9FAFB',
          textPrimary: '#111827'
        },
        preview: ['#FF6A00', '#6B7280', '#10B981', '#FFFFFF']
      },
      {
        name: 'Ocean Blue',
        colors: {
          primary: '#0EA5E9',
          secondary: '#64748B',
          accent: '#06B6D4',
          background: '#F8FAFC',
          surface: '#F1F5F9',
          textPrimary: '#0F172A'
        },
        preview: ['#0EA5E9', '#64748B', '#06B6D4', '#F8FAFC']
      },
      {
        name: 'Forest Green',
        colors: {
          primary: '#059669',
          secondary: '#6B7280',
          accent: '#10B981',
          background: '#F9FDF9',
          surface: '#F0FDF4',
          textPrimary: '#064E3B'
        },
        preview: ['#059669', '#6B7280', '#10B981', '#F9FDF9']
      },
      {
        name: 'Royal Purple',
        colors: {
          primary: '#7C3AED',
          secondary: '#6B7280',
          accent: '#A855F7',
          background: '#FAFAFA',
          surface: '#F5F3FF',
          textPrimary: '#3C1361'
        },
        preview: ['#7C3AED', '#6B7280', '#A855F7', '#FAFAFA']
      },
      {
        name: 'Sunset Orange',
        colors: {
          primary: '#EA580C',
          secondary: '#78716C',
          accent: '#F97316',
          background: '#FFFBFA',
          surface: '#FFF7ED',
          textPrimary: '#9A3412'
        },
        preview: ['#EA580C', '#78716C', '#F97316', '#FFFBFA']
      }
    ])
    
    // Border radius options
    const borderRadiusOptions = ref([
      { label: 'None', value: '0', preview: '0' },
      { label: 'Small', value: '0.25rem', preview: '4px' },
      { label: 'Medium', value: '0.5rem', preview: '8px' },
      { label: 'Large', value: '0.75rem', preview: '12px' },
      { label: 'Extra Large', value: '1rem', preview: '16px' }
    ])
    
    // Theme modes
    const themeModes = ref([
      { label: 'Light', value: 'light', icon: 'passeriformes-sun' },
      { label: 'Dark', value: 'dark', icon: 'passeriformes-moon' },
      { label: 'Auto', value: 'auto', icon: 'corvidae-auto' }
    ])
    
    // Computed properties
    const typographyPreviewStyle = computed(() => ({
      fontFamily: localSettings.value.typography.fontFamily,
      fontSize: `${localSettings.value.typography.scale}rem`,
      lineHeight: localSettings.value.typography.lineHeight,
      letterSpacing: `${localSettings.value.typography.letterSpacing}em`
    }))
    
    const previewStyle = computed(() => ({
      '--primary-color': localSettings.value.colors.primary,
      '--secondary-color': localSettings.value.colors.secondary,
      '--accent-color': localSettings.value.colors.accent,
      '--background-color': localSettings.value.colors.background,
      '--surface-color': localSettings.value.colors.surface,
      '--text-primary': localSettings.value.colors.textPrimary,
      '--border-radius': localSettings.value.layout.borderRadius,
      fontFamily: localSettings.value.typography.fontFamily
    }))

    // Methods
    
    /**
     * Update color value
     * Input → Process → Output pattern
     */
    function updateColor(colorKey, value) {
      // Input: Validate color format
      if (!isValidColor(value)) {
        console.warn('Invalid color format:', value)
        return
      }
      
      // Process: Update local settings
      localSettings.value.colors[colorKey] = value
      
      // Output: Emit update
      emitUpdate()
    }
    
    /**
     * Apply color scheme
     */
    function applyColorScheme(scheme) {
      localSettings.value.colors = { ...scheme.colors }
      emitUpdate()
    }
    
    /**
     * Check if scheme is active
     */
    function isActiveScheme(scheme) {
      return JSON.stringify(localSettings.value.colors) === JSON.stringify(scheme.colors)
    }
    
    /**
     * Update typography settings
     */
    function updateTypography() {
      emitUpdate()
    }
    
    /**
     * Update layout settings
     */
    function updateLayout(key, value) {
      localSettings.value.layout[key] = value
      emitUpdate()
    }
    
    /**
     * Update theme mode
     */
    function updateMode(mode) {
      localSettings.value.mode = mode
      emitUpdate()
    }
    
    /**
     * Update auto mode settings
     */
    function updateAutoMode() {
      emitUpdate()
    }
    
    /**
     * Reset to default theme
     */
    function resetToDefaults() {
      const defaultTheme = getDefaultTheme()
      localSettings.value = { ...defaultTheme }
      emitUpdate()
    }
    
    /**
     * Export theme configuration
     */
    function exportTheme() {
      const themeData = {
        name: 'Custom Theme',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        settings: localSettings.value
      }
      
      const blob = new Blob([JSON.stringify(themeData, null, 2)], { 
        type: 'application/json' 
      })
      
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `roadrunner-theme-${Date.now()}.json`
      a.click()
      
      URL.revokeObjectURL(url)
    }
    
    /**
     * Apply theme to application
     */
    function applyTheme() {
      applyThemeSettings(localSettings.value)
      emitUpdate()
    }
    
    /**
     * Emit settings update
     * Question → Explore → Apply pattern
     */
    function emitUpdate() {
      // Question: Are settings valid?
      const validation = validateThemeSettings(localSettings.value)
      if (!validation.isValid) {
        console.warn('Invalid theme settings:', validation.errors)
        return
      }
      
      // Explore: Generate CSS
      const css = generateThemeCSS(localSettings.value)
      
      // Apply: Emit update with CSS
      emit('update', {
        ...localSettings.value,
        generatedCSS: css
      })
    }
    
    /**
     * Validate color format
     */
    function isValidColor(color) {
      const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/
      const rgbRegex = /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/
      const hslRegex = /^hsl\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%\s*\)$/
      
      return hexRegex.test(color) || rgbRegex.test(color) || hslRegex.test(color)
    }

    // Watchers
    watch(() => props.settings, (newSettings) => {
      if (newSettings && Object.keys(newSettings).length > 0) {
        localSettings.value = { ...localSettings.value, ...newSettings }
      }
    }, { immediate: true, deep: true })

    // Lifecycle
    onMounted(() => {
      if (props.settings && Object.keys(props.settings).length > 0) {
        localSettings.value = { ...localSettings.value, ...props.settings }
      }
    })

    return {
      // State
      localSettings,
      colorSchemes,
      borderRadiusOptions,
      themeModes,
      
      // Computed
      typographyPreviewStyle,
      previewStyle,
      
      // Methods
      updateColor,
      applyColorScheme,
      isActiveScheme,
      updateTypography,
      updateLayout,
      updateMode,
      updateAutoMode,
      resetToDefaults,
      exportTheme,
      applyTheme
    }
  }
}
</script>

<style scoped>
.theme-customizer {
  @apply space-y-6;
}

.customization-section {
  @apply bg-surface-card rounded-lg p-4 border border-border;
}

.section-title {
  @apply flex items-center gap-2 font-medium text-primary mb-4;
}

.color-grid {
  @apply grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6;
}

.color-group {
  @apply space-y-2;
}

.color-label {
  @apply block text-sm font-medium text-primary;
}

.color-input-group {
  @apply flex gap-2;
}

.color-picker {
  @apply w-12 h-10 rounded border border-border cursor-pointer;
}

.color-text-input {
  @apply flex-1 px-3 py-2 border border-border rounded text-sm font-mono;
}

.color-preview {
  @apply w-full h-8 rounded border border-border;
}

.color-schemes {
  @apply mt-6;
}

.schemes-title {
  @apply font-medium text-primary mb-3;
}

.schemes-grid {
  @apply grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3;
}

.color-scheme {
  @apply p-3 border border-border rounded-lg cursor-pointer transition-colors hover:bg-surface-hover;
}

.color-scheme--active {
  @apply border-primary bg-primary bg-opacity-5;
}

.scheme-preview {
  @apply flex gap-1 mb-2;
}

.scheme-color {
  @apply flex-1 h-6 rounded;
}

.scheme-name {
  @apply text-xs text-center block;
}

.typography-controls {
  @apply space-y-4 mb-6;
}

.control-group {
  @apply space-y-2;
}

.control-label {
  @apply block text-sm font-medium text-primary;
}

.font-select {
  @apply w-full px-3 py-2 border border-border rounded;
}

.scale-control {
  @apply flex items-center gap-3;
}

.scale-slider {
  @apply flex-1;
}

.scale-value {
  @apply text-sm font-mono text-secondary min-w-12;
}

.typography-preview {
  @apply p-4 bg-surface-elevated rounded-lg border border-border space-y-2;
}

.layout-controls {
  @apply space-y-4;
}

.radius-options {
  @apply flex gap-2 flex-wrap;
}

.radius-option {
  @apply flex flex-col items-center gap-2 p-3 border border-border rounded-lg cursor-pointer transition-colors hover:bg-surface-hover;
}

.radius-option--active {
  @apply border-primary bg-primary bg-opacity-5;
}

.radius-preview {
  @apply w-8 h-8 bg-primary;
}

.theme-mode-controls {
  @apply space-y-4;
}

.mode-options {
  @apply flex gap-3;
}

.mode-option {
  @apply flex flex-col items-center gap-2 p-4 border border-border rounded-lg cursor-pointer transition-colors hover:bg-surface-hover;
}

.mode-option--active {
  @apply border-primary bg-primary bg-opacity-5;
}

.auto-mode-settings {
  @apply mt-4 p-4 bg-surface-elevated rounded-lg;
}

.time-inputs {
  @apply flex gap-4;
}

.time-input {
  @apply flex-1 space-y-1;
}

.time-input label {
  @apply text-xs text-secondary;
}

.time-field {
  @apply w-full px-3 py-2 border border-border rounded;
}

.theme-preview {
  @apply border border-border rounded-lg overflow-hidden;
  background: var(--background-color);
  color: var(--text-primary);
}

.preview-header {
  @apply flex items-center justify-between p-4 border-b;
  background: var(--surface-color);
}

.preview-header h3 {
  @apply font-semibold;
}

.preview-buttons {
  @apply flex gap-2;
}

.preview-btn {
  @apply px-3 py-1 rounded text-sm font-medium transition-colors;
}

.preview-btn--primary {
  background: var(--primary-color);
  @apply text-white;
}

.preview-btn--secondary {
  background: var(--secondary-color);
  @apply text-white;
}

.preview-content {
  @apply flex;
}

.preview-sidebar {
  @apply w-48 p-4 space-y-2;
  background: var(--surface-color);
}

.preview-nav-item {
  @apply px-3 py-2 rounded text-sm cursor-pointer transition-colors;
}

.preview-nav-item--active {
  background: var(--primary-color);
  @apply text-white;
}

.preview-nav-item:not(.preview-nav-item--active) {
  @apply hover:bg-gray-100;
}

.preview-main {
  @apply flex-1 p-4;
}

.preview-card {
  @apply p-4 rounded border;
  background: var(--surface-color);
  border-radius: var(--border-radius);
}

.preview-card h4 {
  @apply font-medium mb-2;
}

.preview-card p {
  @apply text-sm;
  color: var(--secondary-color);
}

.theme-actions {
  @apply flex justify-end gap-2 pt-4 border-t border-border;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .color-grid {
    @apply grid-cols-1;
  }
  
  .schemes-grid {
    @apply grid-cols-2;
  }
  
  .radius-options {
    @apply grid grid-cols-3 gap-2;
  }
  
  .mode-options {
    @apply grid grid-cols-3 gap-2;
  }
  
  .time-inputs {
    @apply flex-col gap-2;
  }
  
  .preview-content {
    @apply flex-col;
  }
  
  .preview-sidebar {
    @apply w-full;
  }
  
  .theme-actions {
    @apply flex-col;
  }
}
</style>
