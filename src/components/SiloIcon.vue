<script setup lang="ts">
/**
 * SiloIcon - Text-based icon component
 * Renders icon identifiers in a consistent, brutalist style
 */

const props = defineProps<{
  name: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
}>()

// Map icon names to display characters
const iconMap: Record<string, string> = {
  // Pipeline icons
  'chat': '[>]',
  'doc': '[=]',
  'image': '[#]',
  'write': '[~]',
  'search': '[?]',
  'data': '[%]',
  'creative': '[*]',
  'audio': '[o]',
  'tool': '[+]',
  'list': '[-]',
  'check': '[v]',
  'target': '[@]',
  'idea': '[!]',
  'ai': '[M]',

  // UI icons
  'settings': '[:]',
  'close': '[x]',
  'back': '[<]',
  'forward': '[>]',
  'add': '[+]',
  'attach': '[+]',
  'lock': '[*]',
  'disk': '[D]',
  'box': '[#]',
}

function getDisplayIcon(name: string): string {
  return iconMap[name] || `[${name.charAt(0).toUpperCase()}]`
}
</script>

<template>
  <span
    :class="['silo-icon', `silo-icon--${size || 'md'}`]"
    :title="name"
    :aria-label="name"
  >
    {{ getDisplayIcon(name) }}
  </span>
</template>

<style scoped>
.silo-icon {
  font-family: var(--font-mono);
  font-weight: var(--weight-bold);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--color-accent);
}

.silo-icon--sm {
  font-size: var(--text-xs);
  min-width: 1.5em;
}

.silo-icon--md {
  font-size: var(--text-sm);
  min-width: 2em;
}

.silo-icon--lg {
  font-size: var(--text-lg);
  min-width: 2.5em;
}

.silo-icon--xl {
  font-size: var(--text-2xl);
  min-width: 3em;
}
</style>
