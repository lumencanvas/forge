<script setup lang="ts">
import { computed } from 'vue'
import type { StoredChat } from '@/stores/chats'

const props = defineProps<{
  chats: StoredChat[]
  currentChatId: string | null
  collapsed?: boolean
}>()

const emit = defineEmits<{
  select: [chat: StoredChat]
  new: []
  delete: [chatId: string]
  toggle: []
}>()

interface ChatGroup {
  label: string
  chats: StoredChat[]
}

const groupedChats = computed((): ChatGroup[] => {
  const now = Date.now()
  const dayMs = 24 * 60 * 60 * 1000

  const groups: Record<string, StoredChat[]> = {
    today: [],
    yesterday: [],
    thisWeek: [],
    older: []
  }

  for (const chat of props.chats) {
    const age = now - chat.updatedAt
    if (age < dayMs) {
      groups.today.push(chat)
    } else if (age < 2 * dayMs) {
      groups.yesterday.push(chat)
    } else if (age < 7 * dayMs) {
      groups.thisWeek.push(chat)
    } else {
      groups.older.push(chat)
    }
  }

  // Sort each group by most recent
  for (const key of Object.keys(groups)) {
    groups[key]!.sort((a, b) => b.updatedAt - a.updatedAt)
  }

  const result: ChatGroup[] = []
  if (groups.today.length) result.push({ label: 'Today', chats: groups.today })
  if (groups.yesterday.length) result.push({ label: 'Yesterday', chats: groups.yesterday })
  if (groups.thisWeek.length) result.push({ label: 'This Week', chats: groups.thisWeek })
  if (groups.older.length) result.push({ label: 'Older', chats: groups.older })

  return result
})

function handleSelect(chat: StoredChat) {
  emit('select', chat)
}

function handleNew() {
  emit('new')
}

function handleDelete(e: Event, chatId: string) {
  e.stopPropagation()
  if (confirm('Delete this chat?')) {
    emit('delete', chatId)
  }
}
</script>

<template>
  <aside :class="['chat-sidebar', { collapsed }]">
    <div class="sidebar-header">
      <button class="btn btn-primary btn-sm new-chat-btn" @click="handleNew">
        + New Chat
      </button>
      <button class="btn btn-ghost btn-sm toggle-btn" @click="emit('toggle')">
        {{ collapsed ? '→' : '←' }}
      </button>
    </div>

    <div v-if="!collapsed" class="sidebar-content">
      <div v-if="groupedChats.length === 0" class="sidebar-empty">
        <p class="text-muted">No chats yet</p>
      </div>

      <div v-for="group in groupedChats" :key="group.label" class="chat-group">
        <div class="group-label">{{ group.label }}</div>
        <div
          v-for="chat in group.chats"
          :key="chat.id"
          :class="['chat-item', { active: chat.id === currentChatId }]"
          @click="handleSelect(chat)"
        >
          <span class="chat-title">{{ chat.title }}</span>
          <button class="chat-delete" @click="(e) => handleDelete(e, chat.id)">
            ✕
          </button>
        </div>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.chat-sidebar {
  width: var(--sidebar-width);
  min-width: var(--sidebar-width);
  background: var(--color-surface);
  border-right: var(--border-width) solid var(--color-border);
  display: flex;
  flex-direction: column;
  transition: width var(--duration-normal) var(--ease-out),
              min-width var(--duration-normal) var(--ease-out);
}

.chat-sidebar.collapsed {
  width: 48px;
  min-width: 48px;
}

.sidebar-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3);
  /* Account for macOS traffic light buttons */
  padding-top: 40px;
  border-bottom: var(--border-width) solid var(--color-border);
}

.collapsed .sidebar-header {
  flex-direction: column;
  padding: var(--space-2);
}

.new-chat-btn {
  flex: 1;
}

.collapsed .new-chat-btn {
  display: none;
}

.toggle-btn {
  flex-shrink: 0;
  padding: var(--space-2);
}

.sidebar-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-2);
}

.sidebar-empty {
  padding: var(--space-4);
  text-align: center;
}

.chat-group {
  margin-bottom: var(--space-4);
}

.group-label {
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wider);
  color: var(--color-text-subtle);
  padding: var(--space-2) var(--space-2);
  margin-bottom: var(--space-1);
}

.chat-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: var(--space-2);
  background: transparent;
  border: var(--border-width) solid transparent;
  text-align: left;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--color-text);
}

.chat-item:hover {
  background: var(--color-surface-raised);
  border-color: var(--color-border);
}

.chat-item.active {
  background: var(--color-accent-glow);
  border-color: var(--color-accent);
}

.chat-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-delete {
  opacity: 0;
  padding: var(--space-1);
  background: transparent;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: var(--text-xs);
  transition: opacity var(--duration-fast) var(--ease-out);
}

.chat-item:hover .chat-delete {
  opacity: 1;
}

.chat-delete:hover {
  color: var(--color-error);
}
</style>
