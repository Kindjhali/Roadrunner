<template>
  <div class="prompt-editor">
    <textarea
      class="prompt-textarea"
      v-model="localValue"
      :placeholder="placeholder"
      :disabled="disabled"
      rows="10"
    ></textarea>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: 'Enter prompt...' },
  disabled: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue'])

const localValue = ref(props.modelValue)

watch(() => props.modelValue, v => {
  localValue.value = v
})

watch(localValue, v => {
  emit('update:modelValue', v)
})
</script>

<style scoped>
.prompt-textarea {
  @apply w-full p-4 font-mono text-sm text-primary bg-surface-elevated border border-border rounded custom-scrollbar;
}
</style>
