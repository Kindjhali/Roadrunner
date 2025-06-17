<template>
  <div v-if="isVisible" class="modal-overlay" @click="handleOverlayClick">
    <div class="modal-container" @click.stop>
      <div class="modal-header">
        <h3 class="modal-title">{{ title }}</h3>
        <BaseButton
          variant="ghost"
          size="sm"
          @click="close"
          class="modal-close"
        >
          <Icon name="close" size="sm" />
        </BaseButton>
      </div>
      
      <div class="modal-body">
        <slot />
      </div>
      
      <div v-if="$slots.footer" class="modal-footer">
        <slot name="footer" />
      </div>
    </div>
  </div>
</template>

<script>
import { ref, watch } from 'vue'
import BaseButton from './BaseButton.vue'
import Icon from './Icon.vue'

export default {
  name: 'Modal',
  components: {
    BaseButton,
    Icon
  },
  props: {
    modelValue: {
      type: Boolean,
      default: false
    },
    title: {
      type: String,
      default: ''
    },
    closeOnOverlay: {
      type: Boolean,
      default: true
    }
  },
  emits: ['update:modelValue', 'close'],
  setup(props, { emit }) {
    const isVisible = ref(props.modelValue)

    watch(() => props.modelValue, (newValue) => {
      isVisible.value = newValue
    })

    const close = () => {
      isVisible.value = false
      emit('update:modelValue', false)
      emit('close')
    }

    const handleOverlayClick = () => {
      if (props.closeOnOverlay) {
        close()
      }
    }

    // Handle escape key
    const handleKeydown = (event) => {
      if (event.key === 'Escape' && isVisible.value) {
        close()
      }
    }

    // Add/remove event listeners
    watch(isVisible, (newValue) => {
      if (newValue) {
        document.addEventListener('keydown', handleKeydown)
        document.body.style.overflow = 'hidden'
      } else {
        document.removeEventListener('keydown', handleKeydown)
        document.body.style.overflow = ''
      }
    })

    return {
      isVisible,
      close,
      handleOverlayClick
    }
  }
}
</script>

<style scoped>
.modal-overlay {
  @apply fixed inset-0 z-50 flex items-center justify-center;
  background-color: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.modal-container {
  @apply bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full mx-4;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  @apply flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700;
}

.modal-title {
  @apply text-lg font-semibold text-gray-900 dark:text-white;
}

.modal-close {
  @apply text-gray-400 hover:text-gray-600 dark:hover:text-gray-300;
}

.modal-body {
  @apply p-6;
}

.modal-footer {
  @apply flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700;
}
</style>
