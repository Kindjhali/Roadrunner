<!--
  SettingsSection.vue - Reusable settings section component
  
  Following AGENTS.md principles:
  - No inline code or styles
  - Modular, testable components only
  
  @version 1.0.0
  @author Roadrunner Autocoder System
-->

<template>
  <div class="settings-section" :class="{ 'settings-section--collapsible': collapsible }">
    <div 
      class="section-header"
      :class="{ 'section-header--clickable': collapsible }"
      @click="toggleCollapse"
    >
      <div class="section-title-group">
        <Icon v-if="icon" :name="icon" size="sm" class="section-icon" />
        <h3 class="section-title">{{ title }}</h3>
        <span v-if="badge" class="section-badge">{{ badge }}</span>
      </div>
      
      <div class="section-actions">
        <slot name="actions" />
        
        <button
          v-if="collapsible"
          class="collapse-button"
          :class="{ 'collapse-button--expanded': !isCollapsed }"
          @click.stop="toggleCollapse"
        >
          <Icon name="corvidae-chevron-down" size="sm" />
        </button>
      </div>
    </div>
    
    <div v-if="description" class="section-description">
      {{ description }}
    </div>
    
    <Transition name="collapse">
      <div v-show="!isCollapsed" class="section-content">
        <slot />
      </div>
    </Transition>
  </div>
</template>

<script>
import { ref, computed } from 'vue'
import Icon from '../shared/Icon.vue'

export default {
  name: 'SettingsSection',
  
  components: {
    Icon
  },
  
  props: {
    title: {
      type: String,
      required: true
    },
    description: {
      type: String,
      default: ''
    },
    icon: {
      type: String,
      default: ''
    },
    badge: {
      type: [String, Number],
      default: ''
    },
    collapsible: {
      type: Boolean,
      default: false
    },
    defaultCollapsed: {
      type: Boolean,
      default: false
    }
  },
  
  emits: ['toggle'],
  
  setup(props, { emit }) {
    const isCollapsed = ref(props.defaultCollapsed)
    
    const toggleCollapse = () => {
      if (props.collapsible) {
        isCollapsed.value = !isCollapsed.value
        emit('toggle', isCollapsed.value)
      }
    }
    
    return {
      isCollapsed,
      toggleCollapse
    }
  }
}
</script>

<style scoped>
.settings-section {
  @apply bg-surface-card rounded-lg border border-border overflow-hidden;
}

.section-header {
  @apply flex items-center justify-between p-4 border-b border-border;
}

.section-header--clickable {
  @apply cursor-pointer hover:bg-surface-hover transition-colors;
}

.section-title-group {
  @apply flex items-center gap-3;
}

.section-icon {
  @apply text-primary;
}

.section-title {
  @apply text-lg font-semibold text-primary m-0;
}

.section-badge {
  @apply px-2 py-1 bg-primary text-white text-xs font-medium rounded-full;
}

.section-actions {
  @apply flex items-center gap-2;
}

.collapse-button {
  @apply p-1 rounded hover:bg-surface-hover transition-all duration-200;
}

.collapse-button--expanded {
  @apply transform rotate-180;
}

.section-description {
  @apply px-4 py-2 text-sm text-secondary bg-surface-elevated;
}

.section-content {
  @apply p-4;
}

/* Collapse transition */
.collapse-enter-active,
.collapse-leave-active {
  transition: all 0.3s ease;
  overflow: hidden;
}

.collapse-enter-from,
.collapse-leave-to {
  max-height: 0;
  opacity: 0;
}

.collapse-enter-to,
.collapse-leave-from {
  max-height: 1000px;
  opacity: 1;
}
</style>
