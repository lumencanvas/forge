import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

export interface FileInfo {
  path: string
  name: string
  extension: string
  category: string
}

const FILE_CATEGORIES: Record<string, string[]> = {
  image: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff', 'svg'],
  document: ['pdf', 'doc', 'docx', 'txt', 'md', 'rtf', 'odt'],
  audio: ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac'],
  video: ['mp4', 'mov', 'avi', 'mkv', 'webm'],
  code: ['js', 'ts', 'py', 'rs', 'go', 'java', 'c', 'cpp', 'h', 'css', 'html', 'vue', 'jsx', 'tsx'],
  data: ['json', 'csv', 'xml', 'yaml', 'yml', 'toml']
}

const FILE_ICONS: Record<string, string> = {
  image: 'IMG',
  document: 'DOC',
  audio: 'AUD',
  video: 'VID',
  code: 'COD',
  data: 'DAT',
  other: 'FIL'
}

function getExtension(filePath: string): string {
  const parts = filePath.split('.')
  const lastPart = parts[parts.length - 1]
  return parts.length > 1 && lastPart ? lastPart.toLowerCase() : ''
}

function getCategory(ext: string): string {
  for (const [category, extensions] of Object.entries(FILE_CATEGORIES)) {
    if (extensions.includes(ext)) return category
  }
  return 'other'
}

function getName(filePath: string): string {
  // Handle both Unix and Windows path separators
  const parts = filePath.split(/[/\\]/)
  return parts[parts.length - 1] || filePath
}

export const useFilesStore = defineStore('files', () => {
  const files = ref<FileInfo[]>([])

  const fileCount = computed(() => files.value.length)
  const hasFiles = computed(() => files.value.length > 0)

  const filesByCategory = computed(() => {
    const grouped: Record<string, FileInfo[]> = {}
    for (const file of files.value) {
      if (!grouped[file.category]) {
        grouped[file.category] = []
      }
      grouped[file.category]!.push(file)
    }
    return grouped
  })

  const categoryStats = computed(() => {
    const stats: Record<string, number> = {}
    for (const file of files.value) {
      stats[file.category] = (stats[file.category] || 0) + 1
    }
    return stats
  })

  function addFiles(paths: string[]) {
    const newFiles = paths
      .filter(path => !files.value.some(f => f.path === path))
      .map(path => {
        const ext = getExtension(path)
        return {
          path,
          name: getName(path),
          extension: ext,
          category: getCategory(ext)
        }
      })
    files.value = [...files.value, ...newFiles]
  }

  function removeFile(index: number) {
    files.value = files.value.filter((_, i) => i !== index)
  }

  function removeByPath(path: string) {
    files.value = files.value.filter(f => f.path !== path)
  }

  function clearFiles() {
    files.value = []
  }

  function getIcon(file: FileInfo): string {
    return FILE_ICONS[file.category] ?? FILE_ICONS.other!
  }

  async function browseFiles() {
    const selected = await window.silo.files.selectFiles()
    if (selected.length > 0) {
      addFiles(selected)
    }
    return selected
  }

  async function browseFolder() {
    const folder = await window.silo.files.selectFolder()
    if (folder) {
      addFiles([folder])
    }
    return folder
  }

  return {
    files,
    fileCount,
    hasFiles,
    filesByCategory,
    categoryStats,
    addFiles,
    removeFile,
    removeByPath,
    clearFiles,
    getIcon,
    browseFiles,
    browseFolder
  }
})
