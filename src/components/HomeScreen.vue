<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useChatsStore } from '@/stores/chats'
import { useHardwareStore } from '@/stores/hardware'
import { useSettingsStore } from '@/stores/settings'
import { getTaskCardFlows } from '@/lib/flows/builtin'
import type { Flow } from '@/lib/flows/schema'
import type { StoredChat } from '@/stores/chats'

import TaskCard from '@/components/home/TaskCard.vue'
import RecentChats from '@/components/home/RecentChats.vue'
import QuickInput from '@/components/home/QuickInput.vue'

const chatsStore = useChatsStore()
const hardwareStore = useHardwareStore()
const settingsStore = useSettingsStore()

const emit = defineEmits<{
  openChat: [chatId?: string, flowId?: string, initialMessage?: string]
  openSettings: []
  openFlows: []
}>()

const quickInputRef = ref<InstanceType<typeof QuickInput> | null>(null)
const inputFocused = ref(false)

const taskFlows = computed(() => getTaskCardFlows())
const recentChats = computed(() => chatsStore.recentChats)

onMounted(async () => {
  await chatsStore.loadChats()
})

function handleTaskClick(flow: Flow) {
  emit('openChat', undefined, flow.id)
}

function handleRecentChatSelect(chat: StoredChat) {
  emit('openChat', chat.id)
}

function handleQuickSubmit(message: string) {
  emit('openChat', undefined, 'builtin-chat', message)
}

function handleQuickFocus() {
  inputFocused.value = true
}

function handleViewAllChats() {
  // For now, just open an empty chat which shows sidebar
  emit('openChat')
}

function handleOpenFlows() {
  emit('openFlows')
}

function handleOpenSettings() {
  emit('openSettings')
}

function getTierClass(tierName: string): string {
  return `tier-${tierName.toLowerCase()}`
}
</script>

<template>
  <div class="home-screen">
    <!-- Header -->
    <header class="home-header drag-region">
      <div class="header-left">
        <h1 class="logo">SILO</h1>
      </div>
      <div class="header-right">
        <span
          v-if="hardwareStore.hardwareInfo"
          :class="['badge', getTierClass(hardwareStore.tierName)]"
        >
          {{ hardwareStore.tierName }}
        </span>
        <button class="btn btn-ghost btn-sm icon-btn" @click="handleOpenSettings" aria-label="Settings">
          [:]
        </button>
      </div>
    </header>

    <!-- Main content -->
    <main class="home-main">
      <div class="container container-narrow">
        <!-- Hero section (hide when input focused for cleaner typing experience) -->
        <div v-if="!inputFocused" class="home-hero">
          <p class="home-tagline text-muted">
            Local AI for activists and creatives. Private. Powerful. Simple.
          </p>
        </div>

        <!-- Task cards grid (collapse when typing) -->
        <div v-if="!inputFocused" class="task-grid">
          <TaskCard
            v-for="flow in taskFlows"
            :key="flow.id"
            :flow="flow"
            @click="handleTaskClick"
          />
          <button class="task-card task-card-more" @click="handleOpenFlows">
            <span class="task-icon">[+]</span>
            <span class="task-name">More Flows</span>
            <span class="task-description">Browse all workflows</span>
          </button>
        </div>

        <!-- Recent chats -->
        <RecentChats
          v-if="!inputFocused && recentChats.length > 0"
          :chats="recentChats"
          @select="handleRecentChatSelect"
          @view-all="handleViewAllChats"
        />

        <!-- Quick input - always visible -->
        <QuickInput
          ref="quickInputRef"
          @submit="handleQuickSubmit"
          @focus="handleQuickFocus"
        />

        <!-- Back to home hint when focused -->
        <div v-if="inputFocused" class="back-hint">
          <button class="btn btn-ghost btn-sm" @click="inputFocused = false">
            ← Back to Home
          </button>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.home-screen {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--color-base);
}

.home-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-6);
  /* Account for macOS traffic light buttons */
  padding-left: 80px;
  border-bottom: var(--border-width-2) solid var(--color-border);
  background: var(--color-surface);
}

.header-left {
  display: flex;
  align-items: baseline;
  gap: var(--space-3);
}

.logo {
  font-size: var(--text-lg);
  font-weight: var(--weight-bold);
  color: var(--color-accent);
  letter-spacing: var(--tracking-wider);
  text-transform: uppercase;
}

.header-right {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.home-main {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-8) 0;
}

.home-hero {
  text-align: center;
  margin-bottom: var(--space-8);
}

.home-tagline {
  font-size: var(--text-base);
}

.task-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-3);
}

@media (max-width: 768px) {
  .task-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

.task-card-more {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-5);
  background: var(--color-surface);
  border: var(--border-width) dashed var(--color-border);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
  text-align: center;
  min-height: 120px;
}

.task-card-more:hover {
  border-color: var(--color-accent);
  border-style: solid;
  background: var(--color-accent-glow);
}

.task-card-more .task-icon {
  font-size: 1.75rem;
  margin-bottom: var(--space-2);
  opacity: 0.6;
}

.task-card-more .task-name {
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  color: var(--color-text-muted);
  margin-bottom: var(--space-1);
}

.task-card-more .task-description {
  font-size: var(--text-xs);
  color: var(--color-text-subtle);
}

.back-hint {
  margin-top: var(--space-4);
  text-align: center;
}
</style>
