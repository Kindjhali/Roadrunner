<!--
  BaseButton.vue - Foundation button component with variants and states
  
  Following AGENTS.md principles:
  - No inline code or styles
  - Modular, testable components only
  - All logic in composables and services
  
  @version 1.0.0
  @author Roadrunner Autocoder System
-->

<template>
  <component
    :is="tag"
    :type="buttonType"
    :disabled="disabled || loading"
    :aria-disabled="disabled || loading"
    :aria-label="ariaLabel"
    :class="buttonClasses"
    :style="buttonStyles"
    @click="handleClick"
    @keydown="handleKeydown"
  >
    <!-- Loading state -->
    <Icon 
      v-if="loading" 
      name="loading" 
      :size="iconSize"
      animation="spin"
      class="button__loading-icon"
    />
    
    <!-- Icon (left) -->
    <Icon 
      v-else-if="icon && iconPosition === 'left'" 
      :name="icon" 
      :size="iconSize"
      class="button__icon button__icon--left"
    />
    
    <!-- Button content -->
    <span v-if="$slots.default || label" class="button__content">
      <slot>{{ label }}</slot>
    </span>
    
    <!-- Icon (right) -->
    <Icon 
      v-if="!loading && icon && iconPosition === 'right'" 
      :name="icon" 
      :size="iconSize"
      class="button__icon button__icon--right"
    />
    
    <!-- Badge/Counter -->
    <span 
      v-if="badge && !loading" 
      class="button__badge"
      :class="badgeClasses"
    >
      {{ badge }}
    </span>
  </component>
</template>

<script>
import { computed } from 'vue'
import Icon from './Icon.vue'

/**
 * BaseButton Component
 * 
 * Foundation button with comprehensive variants and states:
 * 1. Multiple variants (primary, secondary, ghost, danger, etc.)
 * 2. Size variants (xs, sm, md, lg, xl)
 * 3. Loading, disabled, and active states
 * 4. Icon support with positioning
 * 5. Badge/counter support
 * 6. Accessibility features
 */
export default {
  name: 'BaseButton',
  
  components: {
    Icon
  },
  
  props: {
    /**
     * Button variant
     */
    variant: {
      type: String,
      default: 'primary',
      validator: (value) => {
        const variants = [
          'primary', 'secondary', 'ghost', 'outline', 
          'danger', 'warning', 'success', 'info',
          'link', 'minimal'
        ]
        return variants.includes(value)
      }
    },
    
    /**
     * Button size
     */
    size: {
      type: String,
      default: 'md',
      validator: (value) => {
        const sizes = ['xs', 'sm', 'md', 'lg', 'xl']
        return sizes.includes(value)
      }
    },
    
    /**
     * Button label text
     */
    label: {
      type: String,
      default: null
    },
    
    /**
     * Icon name
     */
    icon: {
      type: String,
      default: null
    },
    
    /**
     * Icon position
     */
    iconPosition: {
      type: String,
      default: 'left',
      validator: (value) => ['left', 'right'].includes(value)
    },
    
    /**
     * Whether button is disabled
     */
    disabled: {
      type: Boolean,
      default: false
    },
    
    /**
     * Whether button is in loading state
     */
    loading: {
      type: Boolean,
      default: false
    },
    
    /**
     * Whether button is active/pressed
     */
    active: {
      type: Boolean,
      default: false
    },
    
    /**
     * Whether button takes full width
     */
    block: {
      type: Boolean,
      default: false
    },
    
    /**
     * Whether button is rounded
     */
    rounded: {
      type: Boolean,
      default: false
    },
    
    /**
     * Badge content (number or text)
     */
    badge: {
      type: [String, Number],
      default: null
    },
    
    /**
     * Badge variant
     */
    badgeVariant: {
      type: String,
      default: 'primary',
      validator: (value) => {
        const variants = ['primary', 'secondary', 'danger', 'warning', 'success', 'info']
        return variants.includes(value)
      }
    },
    
    /**
     * HTML tag to render
     */
    tag: {
      type: String,
      default: 'button',
      validator: (value) => ['button', 'a', 'router-link', 'nuxt-link'].includes(value)
    },
    
    /**
     * Button type (for button tag)
     */
    type: {
      type: String,
      default: 'button',
      validator: (value) => ['button', 'submit', 'reset'].includes(value)
    },
    
    /**
     * ARIA label for accessibility
     */
    ariaLabel: {
      type: String,
      default: null
    },
    
    /**
     * Custom CSS classes
     */
    customClass: {
      type: [String, Array, Object],
      default: null
    }
  },
  
  emits: ['click', 'focus', 'blur'],
  
  setup(props, { emit }) {
    // Computed properties
    const buttonClasses = computed(() => {
      const classes = ['button', `button--${props.variant}`, `button--${props.size}`]
      
      // State classes
      if (props.disabled) classes.push('button--disabled')
      if (props.loading) classes.push('button--loading')
      if (props.active) classes.push('button--active')
      if (props.block) classes.push('button--block')
      if (props.rounded) classes.push('button--rounded')
      
      // Icon-only button
      if (props.icon && !props.label && !props.$slots?.default) {
        classes.push('button--icon-only')
      }
      
      // Custom classes
      if (props.customClass) {
        if (typeof props.customClass === 'string') {
          classes.push(props.customClass)
        } else if (Array.isArray(props.customClass)) {
          classes.push(...props.customClass)
        } else if (typeof props.customClass === 'object') {
          Object.entries(props.customClass).forEach(([key, value]) => {
            if (value) classes.push(key)
          })
        }
      }
      
      return classes
    })
    
    const buttonStyles = computed(() => {
      const styles = {}
      
      // Add any dynamic styles here if needed
      
      return styles
    })
    
    const buttonType = computed(() => {
      return props.tag === 'button' ? props.type : undefined
    })
    
    const iconSize = computed(() => {
      const sizeMap = {
        xs: 'xs',
        sm: 'sm',
        md: 'sm',
        lg: 'md',
        xl: 'lg'
      }
      return sizeMap[props.size] || 'sm'
    })
    
    const badgeClasses = computed(() => {
      return [
        'button__badge',
        `button__badge--${props.badgeVariant}`
      ]
    })

    // Methods
    
    /**
     * Handle button click
     * Input → Process → Output pattern
     */
    function handleClick(event) {
      // Input: Check if button should respond to click
      if (props.disabled || props.loading) {
        event.preventDefault()
        event.stopPropagation()
        return
      }
      
      // Process: Add click feedback
      addClickFeedback(event.target)
      
      // Output: Emit click event
      emit('click', event)
    }
    
    /**
     * Handle keyboard interactions
     * 
     * @param {KeyboardEvent} event - Keyboard event
     */
    function handleKeydown(event) {
      // Handle Enter and Space for accessibility
      if (event.key === 'Enter' || event.key === ' ') {
        if (!props.disabled && !props.loading) {
          event.preventDefault()
          handleClick(event)
        }
      }
    }
    
    /**
     * Add visual click feedback
     * 
     * @param {HTMLElement} element - Button element
     */
    function addClickFeedback(element) {
      // Add ripple effect class
      element.classList.add('button--clicked')
      
      // Remove class after animation
      setTimeout(() => {
        element.classList.remove('button--clicked')
      }, 200)
    }

    return {
      buttonClasses,
      buttonStyles,
      buttonType,
      iconSize,
      badgeClasses,
      handleClick,
      handleKeydown
    }
  }
}
</script>

<style scoped>
.button {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-xs);
  font-family: inherit;
  font-weight: var(--font-weight-medium);
  text-decoration: none;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: var(--transition-fast);
  user-select: none;
  white-space: nowrap;
  overflow: hidden;
}

.button:focus {
  outline: 2px solid var(--primary-orange);
  outline-offset: 2px;
}

.button:focus:not(:focus-visible) {
  outline: none;
}

/* Size variants */
.button--xs {
  height: 28px;
  padding: 0 var(--spacing-sm);
  font-size: var(--font-size-xs);
  min-width: 28px;
}

.button--sm {
  height: 32px;
  padding: 0 var(--spacing-md);
  font-size: var(--font-size-sm);
  min-width: 32px;
}

.button--md {
  height: var(--button-height);
  padding: 0 var(--spacing-lg);
  font-size: var(--font-size-base);
  min-width: var(--button-height);
}

.button--lg {
  height: 48px;
  padding: 0 var(--spacing-xl);
  font-size: var(--font-size-lg);
  min-width: 48px;
}

.button--xl {
  height: 56px;
  padding: 0 var(--spacing-2xl);
  font-size: var(--font-size-xl);
  min-width: 56px;
}

/* Variant styles */
.button--primary {
  background-color: var(--primary-orange);
  color: var(--text-inverse);
  border-color: var(--primary-orange);
}

.button--primary:hover:not(:disabled) {
  background-color: var(--orange-dark);
  border-color: var(--orange-dark);
  box-shadow: var(--glow-subtle);
}

.button--primary:active {
  background-color: var(--orange-dark);
  transform: translateY(1px);
}

.button--secondary {
  background-color: var(--surface-card);
  color: var(--text-primary);
  border-color: var(--surface-border);
}

.button--secondary:hover:not(:disabled) {
  background-color: var(--surface-hover);
  border-color: var(--primary-orange);
}

.button--ghost {
  background-color: transparent;
  color: var(--text-primary);
  border-color: transparent;
}

.button--ghost:hover:not(:disabled) {
  background-color: var(--surface-hover);
  color: var(--primary-orange);
}

.button--outline {
  background-color: transparent;
  color: var(--primary-orange);
  border-color: var(--primary-orange);
}

.button--outline:hover:not(:disabled) {
  background-color: var(--primary-orange);
  color: var(--text-inverse);
}

.button--danger {
  background-color: var(--color-error);
  color: var(--text-inverse);
  border-color: var(--color-error);
}

.button--danger:hover:not(:disabled) {
  background-color: var(--color-error-dark);
  border-color: var(--color-error-dark);
}

.button--warning {
  background-color: var(--color-warning);
  color: var(--text-inverse);
  border-color: var(--color-warning);
}

.button--warning:hover:not(:disabled) {
  background-color: var(--color-warning-dark);
  border-color: var(--color-warning-dark);
}

.button--success {
  background-color: var(--color-success);
  color: var(--text-inverse);
  border-color: var(--color-success);
}

.button--success:hover:not(:disabled) {
  background-color: var(--color-success-dark);
  border-color: var(--color-success-dark);
}

.button--info {
  background-color: var(--color-info);
  color: var(--text-inverse);
  border-color: var(--color-info);
}

.button--info:hover:not(:disabled) {
  background-color: var(--color-info-dark);
  border-color: var(--color-info-dark);
}

.button--link {
  background-color: transparent;
  color: var(--primary-orange);
  border-color: transparent;
  text-decoration: underline;
  padding: 0;
  height: auto;
  min-width: auto;
}

.button--link:hover:not(:disabled) {
  color: var(--orange-dark);
  text-decoration: none;
}

.button--minimal {
  background-color: transparent;
  color: var(--text-secondary);
  border-color: transparent;
  padding: var(--spacing-xs);
}

.button--minimal:hover:not(:disabled) {
  color: var(--text-primary);
  background-color: var(--surface-hover);
}

/* State modifiers */
.button--disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}

.button--loading {
  cursor: wait;
  pointer-events: none;
}

.button--active {
  background-color: var(--surface-active);
  color: var(--primary-orange);
}

.button--block {
  width: 100%;
}

.button--rounded {
  border-radius: var(--radius-full);
}

.button--icon-only {
  padding: 0;
  aspect-ratio: 1;
}

/* Icon positioning */
.button__icon--left {
  margin-right: var(--spacing-xs);
}

.button__icon--right {
  margin-left: var(--spacing-xs);
}

.button__loading-icon {
  margin-right: var(--spacing-xs);
}

/* Badge */
.button__badge {
  position: absolute;
  top: -6px;
  right: -6px;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  font-size: 10px;
  font-weight: var(--font-weight-bold);
  line-height: 18px;
  text-align: center;
  border-radius: var(--radius-full);
  border: 2px solid var(--surface-card);
}

.button__badge--primary {
  background-color: var(--primary-orange);
  color: var(--text-inverse);
}

.button__badge--secondary {
  background-color: var(--surface-border);
  color: var(--text-primary);
}

.button__badge--danger {
  background-color: var(--color-error);
  color: var(--text-inverse);
}

.button__badge--warning {
  background-color: var(--color-warning);
  color: var(--text-inverse);
}

.button__badge--success {
  background-color: var(--color-success);
  color: var(--text-inverse);
}

.button__badge--info {
  background-color: var(--color-info);
  color: var(--text-inverse);
}

/* Click feedback */
.button--clicked {
  transform: scale(0.98);
}

.button--clicked::after {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.3) 0%, transparent 70%);
  border-radius: inherit;
  animation: ripple 0.2s ease-out;
}

@keyframes ripple {
  0% {
    transform: scale(0);
    opacity: 1;
  }
  100% {
    transform: scale(1);
    opacity: 0;
  }
}

/* Responsive adjustments */
@media (max-width: 640px) {
  .button--lg {
    height: 44px;
    font-size: var(--font-size-base);
  }
  
  .button--xl {
    height: 48px;
    font-size: var(--font-size-lg);
  }
}

/* High contrast mode */
@media (prefers-contrast: high) {
  .button {
    border-width: 2px;
  }
  
  .button--ghost,
  .button--minimal {
    border-color: currentColor;
  }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .button {
    transition: none;
  }
  
  .button--clicked {
    transform: none;
  }
  
  .button--clicked::after {
    animation: none;
  }
}

/* Print styles */
@media print {
  .button {
    background: transparent !important;
    color: black !important;
    border: 1px solid black !important;
  }
}
</style>
