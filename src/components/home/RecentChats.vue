<script setup lang="ts">
import { computed } from 'vue'
import type { StoredChat } from '@/stores/chats'

const props = defineProps<{
  chats: StoredChat[]
}>()

const emit = defineEmits<{
  select: [chat: StoredChat]
  viewAll: []
}>()

function formatTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  return new Date(timestamp).toLocaleDateString()
}

const displayChats = computed(() => props.chats.slice(0, 5))
</script>

<template>
  <div class="recent-chats">
    <div class="recent-header">
      <h3 class="recent-title">Recent Chats</h3>
      <button v-if="chats.length > 5" class="btn btn-ghost btn-sm" @click="emit('viewAll')">
        View All
      </button>
    </div>

    <div v-if="displayChats.length === 0" class="recent-empty">
      <p class="text-muted">No recent chats yet. Start a conversation!</p>
    </div>

    <div v-else class="recent-list">
      <button
        v-for="chat in displayChats"
        :key="chat.id"
        class="recent-item"
        @click="emit('select', chat)"
      >
        <span class="recent-icon">[>]</span>
        <span class="recent-content">
          <span class="recent-item-title">{{ chat.title }}</span>
          <span class="recent-meta">
            <span class="recent-model">{{ chat.model }}</span>
            <span class="recent-time">{{ formatTime(chat.updatedAt) }}</span>
          </span>
        </span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.recent-chats {
  margin-top: var(--space-8);
}

.recent-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-4);
  padding-bottom: var(--space-3);
  border-bottom: var(--border-width) solid var(--color-border);
}

.recent-title {
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wider);
}

.recent-empty {
  padding: var(--space-6);
  text-align: center;
  background: var(--color-surface);
  border: var(--border-width) dashed var(--color-border);
}

.recent-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.recent-item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-3);
  background: transparent;
  border: var(--border-width) solid transparent;
  text-align: left;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
  width: 100%;
}

.recent-item:hover {
  background: var(--color-surface);
  border-color: var(--color-border);
}

.recent-icon {
  flex-shrink: 0;
  font-size: var(--text-base);
  opacity: 0.6;
}

.recent-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.recent-item-title {
  font-size: var(--text-sm);
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.recent-meta {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  font-size: var(--text-xs);
  color: var(--color-text-subtle);
}

.recent-model {
  color: var(--color-text-muted);
}

.recent-time {
  color: var(--color-text-subtle);
}
</style>
