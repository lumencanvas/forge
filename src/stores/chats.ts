/**
 * SILO - Chats Store
 * Manages chat history and conversations
 */

import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { StoredChat, StoredChatMessage } from '../../electron/preload/index.d'

export type { StoredChat, StoredChatMessage }

export interface ChatMessage {
  id: string
  role: 'system' | 'user' | 'assistant'
  content: string
  images?: string[]
  timestamp: number
  model?: string
  isStreaming?: boolean
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

function generateTitle(content: string): string {
  // Take first 50 chars of first message as title
  const cleaned = content.replace(/\s+/g, ' ').trim()
  if (cleaned.length <= 50) return cleaned
  return cleaned.substring(0, 47) + '...'
}

export const useChatsStore = defineStore('chats', () => {
  // All stored chats
  const chats = ref<StoredChat[]>([])

  // Current active chat
  const currentChatId = ref<string | null>(null)
  const currentMessages = ref<ChatMessage[]>([])
  const currentModel = ref<string>('')
  const currentPipelineId = ref<string | undefined>(undefined)

  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Computed
  const currentChat = computed(() => {
    if (!currentChatId.value) return null
    return chats.value.find(c => c.id === currentChatId.value) || null
  })

  const recentChats = computed(() => {
    return [...chats.value]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 10)
  })

  const chatsByDate = computed(() => {
    const now = Date.now()
    const dayMs = 24 * 60 * 60 * 1000

    const groups: Record<string, StoredChat[]> = {
      today: [],
      yesterday: [],
      thisWeek: [],
      older: []
    }

    for (const chat of chats.value) {
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

    return groups
  })

  // Load all chats from storage
  async function loadChats(): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      chats.value = await window.silo.chats.getAll()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load chats'
      console.error('[Chats]', error.value)
    } finally {
      isLoading.value = false
    }
  }

  // Start a new chat
  function startNewChat(model: string, pipelineId?: string): string {
    const id = generateId()
    currentChatId.value = id
    currentMessages.value = []
    currentModel.value = model
    currentPipelineId.value = pipelineId
    return id
  }

  // Load an existing chat
  async function loadChat(id: string): Promise<void> {
    const chat = await window.silo.chats.get(id)
    if (chat) {
      currentChatId.value = chat.id
      currentMessages.value = chat.messages.map(m => ({ ...m, isStreaming: false }))
      currentModel.value = chat.model
      currentPipelineId.value = chat.pipelineId
    }
  }

  // Add a message to current chat
  function addMessage(message: Omit<ChatMessage, 'id' | 'timestamp'>): ChatMessage {
    const newMessage: ChatMessage = {
      ...message,
      id: generateId(),
      timestamp: Date.now()
    }
    currentMessages.value = [...currentMessages.value, newMessage]
    return newMessage
  }

  // Update a message (for streaming)
  function updateMessage(id: string, content: string, isStreaming = true): void {
    currentMessages.value = currentMessages.value.map(m =>
      m.id === id ? { ...m, content, isStreaming } : m
    )
  }

  // Complete a streaming message
  function completeMessage(id: string, content: string): void {
    updateMessage(id, content, false)
  }

  // Save current chat to storage
  async function saveCurrentChat(): Promise<void> {
    if (!currentChatId.value || currentMessages.value.length === 0) return

    const now = Date.now()
    const firstUserMessage = currentMessages.value.find(m => m.role === 'user')
    const title = firstUserMessage ? generateTitle(firstUserMessage.content) : 'New Chat'

    const chatToSave: StoredChat = {
      id: currentChatId.value,
      title,
      messages: currentMessages.value.map(({ isStreaming, ...m }) => m),
      model: currentModel.value,
      pipelineId: currentPipelineId.value,
      createdAt: currentChat.value?.createdAt || now,
      updatedAt: now
    }

    await window.silo.chats.save(chatToSave)

    // Update local state
    const index = chats.value.findIndex(c => c.id === chatToSave.id)
    if (index >= 0) {
      chats.value = [
        ...chats.value.slice(0, index),
        chatToSave,
        ...chats.value.slice(index + 1)
      ]
    } else {
      chats.value = [chatToSave, ...chats.value]
    }
  }

  // Delete a chat
  async function deleteChat(id: string): Promise<void> {
    await window.silo.chats.delete(id)
    chats.value = chats.value.filter(c => c.id !== id)

    if (currentChatId.value === id) {
      currentChatId.value = null
      currentMessages.value = []
    }
  }

  // Clear current chat (without deleting from storage)
  function clearCurrentChat(): void {
    currentChatId.value = null
    currentMessages.value = []
    currentModel.value = ''
    currentPipelineId.value = undefined
  }

  // Clear all chats
  async function clearAllChats(): Promise<void> {
    await window.silo.chats.clear()
    chats.value = []
    clearCurrentChat()
  }

  // Set model for current chat
  function setModel(model: string): void {
    currentModel.value = model
  }

  return {
    chats,
    currentChatId,
    currentMessages,
    currentModel,
    currentPipelineId,
    currentChat,
    recentChats,
    chatsByDate,
    isLoading,
    error,
    loadChats,
    startNewChat,
    loadChat,
    addMessage,
    updateMessage,
    completeMessage,
    saveCurrentChat,
    deleteChat,
    clearCurrentChat,
    clearAllChats,
    setModel
  }
})
