/**
 * SILO - Settings Service
 * Persistent settings using electron-store
 */

import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'

export interface AppSettings {
  // General
  theme: 'dark' | 'light' | 'system'
  language: string

  // Models
  defaultLanguageModel: string
  defaultVisionModel: string
  defaultAudioModel: string

  // Chat
  sendOnEnter: boolean
  showTimestamps: boolean

  // Storage
  chatHistoryPath: string
  pipelinesPath: string
  reservePath: string
  maxChatHistory: number

  // Privacy
  telemetryEnabled: boolean

  // First run
  setupComplete: boolean
  setupVersion: number
}

export interface ChatMessage {
  id: string
  role: 'system' | 'user' | 'assistant'
  content: string
  images?: string[]
  timestamp: number
  model?: string
}

export interface Chat {
  id: string
  title: string
  messages: ChatMessage[]
  model: string
  pipelineId?: string
  createdAt: number
  updatedAt: number
}

const defaultSettings: AppSettings = {
  theme: 'dark',
  language: 'en',
  defaultLanguageModel: '',
  defaultVisionModel: '',
  defaultAudioModel: '',
  sendOnEnter: true,
  showTimestamps: true,
  chatHistoryPath: '',
  pipelinesPath: '',
  reservePath: '',
  maxChatHistory: 100,
  telemetryEnabled: false,
  setupComplete: false,
  setupVersion: 0
}

class SettingsService {
  private settingsPath: string
  private chatsPath: string
  private settings: AppSettings
  private chats: Chat[]

  constructor() {
    // Store app data in Documents/SILO for cross-platform user accessibility
    // macOS: ~/Documents/SILO
    // Windows: C:\Users\<user>\Documents\SILO
    // Linux: ~/Documents/SILO (or XDG equivalent)
    const documentsPath = app.getPath('documents')

    // Ensure directories exist
    const siloDir = join(documentsPath, 'SILO')
    if (!existsSync(siloDir)) {
      mkdirSync(siloDir, { recursive: true })
    }

    this.settingsPath = join(siloDir, 'settings.json')
    this.chatsPath = join(siloDir, 'chats.json')

    // Initialize with defaults
    this.settings = {
      ...defaultSettings,
      chatHistoryPath: join(siloDir, 'chats'),
      pipelinesPath: join(siloDir, 'pipelines'),
      reservePath: join(siloDir, 'reserve')
    }
    this.chats = []

    // Load existing data
    this.loadSettings()
    this.loadChats()
  }

  private loadSettings(): void {
    try {
      if (existsSync(this.settingsPath)) {
        const data = readFileSync(this.settingsPath, 'utf-8')
        const loaded = JSON.parse(data)
        this.settings = { ...this.settings, ...loaded }
      }
    } catch (e) {
      console.error('[Settings] Failed to load settings:', e)
    }
  }

  private saveSettings(): void {
    try {
      writeFileSync(this.settingsPath, JSON.stringify(this.settings, null, 2))
    } catch (e) {
      console.error('[Settings] Failed to save settings:', e)
    }
  }

  private loadChats(): void {
    try {
      if (existsSync(this.chatsPath)) {
        const data = readFileSync(this.chatsPath, 'utf-8')
        this.chats = JSON.parse(data)
      }
    } catch (e) {
      console.error('[Settings] Failed to load chats:', e)
    }
  }

  private saveChats(): void {
    try {
      writeFileSync(this.chatsPath, JSON.stringify(this.chats, null, 2))
    } catch (e) {
      console.error('[Settings] Failed to save chats:', e)
    }
  }

  // Settings operations
  get<K extends keyof AppSettings>(key: K): AppSettings[K] {
    return this.settings[key]
  }

  set<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
    this.settings[key] = value
    this.saveSettings()
  }

  getAll(): AppSettings {
    return { ...this.settings }
  }

  setAll(settings: Partial<AppSettings>): void {
    this.settings = { ...this.settings, ...settings }
    this.saveSettings()
  }

  reset(): void {
    const documentsPath = app.getPath('documents')
    const siloDir = join(documentsPath, 'SILO')
    this.settings = {
      ...defaultSettings,
      chatHistoryPath: join(siloDir, 'chats'),
      pipelinesPath: join(siloDir, 'pipelines'),
      reservePath: join(siloDir, 'reserve')
    }
    this.saveSettings()
  }

  // Chat operations
  getChats(): Chat[] {
    return [...this.chats]
  }

  getChat(id: string): Chat | undefined {
    return this.chats.find(c => c.id === id)
  }

  saveChat(chat: Chat): void {
    const index = this.chats.findIndex(c => c.id === chat.id)

    if (index >= 0) {
      this.chats[index] = chat
    } else {
      this.chats.unshift(chat)
    }

    // Limit chat history
    const maxHistory = this.settings.maxChatHistory
    if (this.chats.length > maxHistory) {
      this.chats = this.chats.slice(0, maxHistory)
    }

    this.saveChats()
  }

  deleteChat(id: string): void {
    this.chats = this.chats.filter(c => c.id !== id)
    this.saveChats()
  }

  clearChats(): void {
    this.chats = []
    this.saveChats()
  }

  // Export/Import
  exportData(): { settings: AppSettings; chats: Chat[] } {
    return {
      settings: this.getAll(),
      chats: this.getChats()
    }
  }

  importData(data: { settings?: Partial<AppSettings>; chats?: Chat[] }): void {
    if (data.settings) {
      this.setAll(data.settings)
    }
    if (data.chats) {
      this.chats = data.chats
      this.saveChats()
    }
  }

  // Storage info
  getStoragePath(): string {
    return this.settingsPath
  }
}

export const settingsService = new SettingsService()
