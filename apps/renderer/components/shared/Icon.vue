 <!--
  Icon.vue - SVG icon component using Flaticon assets
  
  Following AGENTS.md principles:
  - No inline code or styles
  - Modular, testable components only
  - All logic in composables and services
  
  @version 1.0.0
  @author Roadrunner Autocoder System
-->

<template>
  <span 
    class="icon"
    :class="iconClasses"
    :style="iconStyles"
    :title="title"
    :aria-label="ariaLabel || name"
    role="img"
  >
    <img 
      v-if="iconSrc"
      :src="iconSrc" 
      :alt="name"
      class="icon-image"
    />
    <svg v-else viewBox="0 0 24 24" fill="currentColor" class="icon-fallback">
      <path :d="fallbackPath" />
    </svg>
  </span>
</template>

<script>
import { computed, ref, onMounted } from 'vue'

/**
 * Icon Component - Uses Flaticon SVG assets
 * 
 * Dynamically loads SVG files from assets/icons folder
 * with fallback to hardcoded paths for essential icons
 */
export default {
  name: 'Icon',
  
  props: {
    /**
     * Icon name (maps to SVG filename)
     */
    name: {
      type: String,
      required: true
    },
    
    /**
     * Icon size
     */
    size: {
      type: [String, Number],
      default: 'md',
      validator: (value) => {
        if (typeof value === 'number') return true
        return ['xs', 'sm', 'md', 'lg', 'xl', '2xl'].includes(value)
      }
    },
    
    /**
     * Icon color
     */
    color: {
      type: String,
      default: 'currentColor'
    },
    
    /**
     * Icon title for accessibility
     */
    title: {
      type: String,
      default: null
    },
    
    /**
     * ARIA label for accessibility
     */
    ariaLabel: {
      type: String,
      default: null
    },
    
    /**
     * Animation type
     */
    animation: {
      type: String,
      default: null,
      validator: (value) => {
        if (!value) return true
        return ['spin', 'pulse', 'bounce', 'ping'].includes(value)
      }
    }
  },
  
  setup(props) {
    const iconSrc = ref(null)
    
    // Icon name mapping for bird taxonomy and common names
    const iconMapping = {
      // Bird taxonomy mapping to available icons
      'turdus-brainstorm': 'brainstorm.svg',
      'turdus-creative': 'creative.svg',
      'turdus-discuss': 'discuss.svg',
      'turdus-export': 'export.svg',
      'turdus-import': 'download.svg',
      'corvidae-plan': 'blueprint.svg',
      'corvidae-code': 'code.svg',
      'corvidae-analyze': 'analyze.svg',
      'corvidae-validate': 'check.svg',
      'corvidae-info': 'info.svg',
      'corvidae-optimize': 'build.svg',
      'corvidae-preview': 'eye.svg',
      'accipiter-execute': 'execute.svg',
      'accipiter-run': 'run.svg',
      'accipiter-test': 'test.svg',
      'accipiter-debug': 'debug.svg',
      'accipiter-file': 'file.svg',
      'accipiter-folder': 'folder.svg',
      'accipiter-upload': 'upload.svg',
      'piciformes-settings': 'config.svg',
      'piciformes-config': 'config.svg',
      'piciformes-tools': 'tools.svg',
      'piciformes-terminal': 'terminal.svg',
      'piciformes-token': 'token.svg',
      'passeriformes-edit': 'edit.svg',
      'passeriformes-save': 'save.svg',
      'passeriformes-load': 'load.svg',
      'passeriformes-copy': 'copy.svg',
      'passeriformes-text': 'text.svg',
      'passeriformes-clock': 'clock.svg',
      'passeriformes-sun': 'sun.svg',
      'passeriformes-moon': 'moon.svg',
      'passeriformes-undo': 'undo.svg',
      'tyrannidae-close': 'close.svg',
      'tyrannidae-menu': 'menu.svg',
      'tyrannidae-grid': 'grid.svg',
      'tyrannidae-collapse': 'collapse.svg',
      'tyrannidae-expand': 'expand.svg',
      'tyrannidae-pause': 'pause.svg',
      'furnariidae-component': 'component.svg',
      'furnariidae-module': 'module.svg',
      
      // Common icon names
      'brain': 'brain.svg',
      'settings': 'config.svg',
      'config': 'config.svg',
      'plus': 'add.svg',
      'minus': 'minus.svg',
      'check': 'check.svg',
      'cross': 'cross.svg',
      'close': 'close.svg',
      'menu': 'menu.svg',
      'loading': 'loading.svg',
      'refresh': 'refresh.svg',
      'warning': 'error.svg',
      'error': 'error.svg',
      'info': 'info.svg',
      'success': 'check.svg',
      'edit': 'edit.svg',
      'delete': 'delete.svg',
      'save': 'save.svg',
      'copy': 'copy.svg',
      'download': 'download.svg',
      'upload': 'upload.svg',
      
      // Configuration specific icons
      'corvidae-clear': 'close.svg',
      'tyrannidae-scroll': 'refresh.svg',
      'tyrannidae-expand': 'expand.svg',
      'tyrannidae-collapse': 'collapse.svg',
      'passeriformes-info': 'info.svg',
      
      // Backend log viewer icons
      'accipiter-terminal': 'terminal.svg',
      'search': 'search.svg',
      'filter': 'filter.svg',
      'sort': 'sort.svg',
      'eye': 'eye.svg',
      'eye-off': 'eye-off.svg',
      'lock': 'lock.svg',
      'unlock': 'unlock.svg',
      'user': 'user.svg',
      'users': 'users.svg',
      'home': 'home.svg',
      'folder': 'folder.svg',
      'file': 'file.svg',
      'image': 'image.svg',
      'video': 'video.svg',
      'audio': 'audio.svg',
      'calendar': 'calendar.svg',
      'clock': 'clock.svg',
      'mail': 'mail.svg',
      'phone': 'phone.svg',
      'location': 'location.svg',
      'map': 'map.svg',
      'star': 'star.svg',
      'heart': 'heart.svg',
      'bookmark': 'bookmark.svg',
      'tag': 'tag.svg',
      'flag': 'flag.svg',
      'bell': 'bell.svg',
      'notification': 'notification.svg',
      'message': 'message.svg',
      'chat': 'chat.svg',
      'comment': 'comment.svg',
      'share': 'share.svg',
      'link': 'link.svg',
      'external': 'external.svg',
      'arrow-up': 'arrow-up.svg',
      'arrow-down': 'arrow-down.svg',
      'arrow-left': 'arrow-left.svg',
      'arrow-right': 'arrow-right.svg',
      'chevron-up': 'chevron-up.svg',
      'chevron-down': 'chevron-down.svg',
      'chevron-left': 'chevron-left.svg',
      'chevron-right': 'chevron-right.svg'
    }
    
    // Fallback SVG paths for essential icons
    const fallbackPaths = {
      'loading': 'M12,4V2A10,10 0 0,0 2,12H4A8,8 0 0,1 12,4Z',
      'check': 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
      'cross': 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
      'plus': 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z',
      'minus': 'M19 13H5v-2h14v2z',
      'settings': 'M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.82,11.69,4.82,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z'
    }
    
    // Computed properties
    const iconClasses = computed(() => {
      const classes = ['icon']
      
      // Size classes
      if (typeof props.size === 'string') {
        classes.push(`icon--${props.size}`)
      }
      
      // Animation classes
      if (props.animation) {
        classes.push(`icon--${props.animation}`)
      }
      
      return classes
    })
    
    const iconStyles = computed(() => {
      const styles = {}
      
      // Custom size
      if (typeof props.size === 'number') {
        styles.width = `${props.size}px`
        styles.height = `${props.size}px`
      }
      
      // Custom color (for SVG fallbacks)
      if (props.color && props.color !== 'currentColor') {
        styles.color = props.color
      }
      
      return styles
    })
    
    const fallbackPath = computed(() => {
      return fallbackPaths[props.name] || fallbackPaths['check']
    })
    
    // Methods
    
    /**
     * Load icon from assets
     * Input → Process → Output pattern
     */
    async function loadIcon() {
      try {
        // Input: Get mapped filename
        const filename = iconMapping[props.name] || `${props.name}.svg`
        
        // Process: Use Vite's asset handling
        try {
          // Use dynamic import with proper Vite syntax
          const iconPath = new URL(`../../assets/icons/${filename}`, import.meta.url).href
          iconSrc.value = iconPath
        } catch (importError) {
          // Fallback to direct path for development
          iconSrc.value = `/src/assets/icons/${filename}`
        }
        
      } catch (error) {
        console.warn(`Icon not found: ${props.name}`, error)
        iconSrc.value = null
      }
    }
    
    // Lifecycle
    onMounted(() => {
      loadIcon()
    })
    
    return {
      iconSrc,
      iconClasses,
      iconStyles,
      fallbackPath
    }
  }
}
</script>

<style scoped>
.icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  user-select: none;
  vertical-align: middle;
}

/* Size variants */
.icon--xs {
  width: 0.75rem;
  height: 0.75rem;
}

.icon--sm {
  width: 1rem;
  height: 1rem;
}

.icon--md {
  width: 1.25rem;
  height: 1.25rem;
}

.icon--lg {
  width: 1.5rem;
  height: 1.5rem;
}

.icon--xl {
  width: 2rem;
  height: 2rem;
}

.icon--2xl {
  width: 2.5rem;
  height: 2.5rem;
}

/* Icon image */
.icon-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  filter: var(--icon-filter, none);
}

/* SVG fallback */
.icon-fallback {
  width: 100%;
  height: 100%;
  fill: currentColor;
}

/* Animations */
.icon--spin .icon-image,
.icon--spin .icon-fallback {
  animation: icon-spin 1s linear infinite;
}

.icon--pulse .icon-image,
.icon--pulse .icon-fallback {
  animation: icon-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

.icon--bounce .icon-image,
.icon--bounce .icon-fallback {
  animation: icon-bounce 1s infinite;
}

.icon--ping .icon-image,
.icon--ping .icon-fallback {
  animation: icon-ping 1s cubic-bezier(0, 0, 0.2, 1) infinite;
}

/* Animation keyframes */
@keyframes icon-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@keyframes icon-pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

@keyframes icon-bounce {
  0%, 100% {
    transform: translateY(-25%);
    animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
  }
  50% {
    transform: translateY(0);
    animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
  }
}

@keyframes icon-ping {
  75%, 100% {
    transform: scale(2);
    opacity: 0;
  }
}

/* Theme support */
.icon-image {
  /* Orange theme filter for dark backgrounds */
  filter: var(--icon-filter, brightness(0) saturate(100%) invert(65%) sepia(85%) saturate(2341%) hue-rotate(4deg) brightness(101%) contrast(101%));
}

/* Dark theme adjustments */
@media (prefers-color-scheme: dark) {
  .icon-image {
    filter: var(--icon-filter-dark, brightness(0) saturate(100%) invert(100%));
  }
}

/* High contrast mode */
@media (prefers-contrast: high) {
  .icon-image {
    filter: var(--icon-filter-high-contrast, contrast(2));
  }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .icon--spin .icon-image,
  .icon--spin .icon-fallback,
  .icon--pulse .icon-image,
  .icon--pulse .icon-fallback,
  .icon--bounce .icon-image,
  .icon--bounce .icon-fallback,
  .icon--ping .icon-image,
  .icon--ping .icon-fallback {
    animation: none;
  }
}
</style>
