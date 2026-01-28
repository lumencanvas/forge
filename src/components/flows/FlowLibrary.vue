<script setup lang="ts">
import { computed, ref } from 'vue'
import { useFlowsStore } from '@/stores/flows'
import type { Flow } from '@/lib/flows/schema'
import SiloIcon from '@/components/SiloIcon.vue'

const flowsStore = useFlowsStore()

const emit = defineEmits<{
  select: [flow: Flow]
  create: []
  edit: [flow: Flow]
  close: []
}>()

const searchQuery = ref('')

const filteredFlows = computed(() => {
  const query = searchQuery.value.toLowerCase()
  if (!query) return flowsStore.flowsByCategory

  const filtered: Record<string, Flow[]> = {}
  for (const [category, flows] of Object.entries(flowsStore.flowsByCategory)) {
    const matches = flows.filter(f =>
      f.name.toLowerCase().includes(query) ||
      f.description.toLowerCase().includes(query) ||
      f.tags?.some(t => t.toLowerCase().includes(query))
    )
    if (matches.length > 0) {
      filtered[category] = matches
    }
  }
  return filtered
})

async function handleImport() {
  try {
    const files = await window.silo.files.selectFiles()
    if (files.length === 0) return

    // In a real implementation, we'd read the file content
    // For now, show a placeholder
    alert('Import functionality coming soon')
  } catch (e) {
    console.error('Import failed:', e)
  }
}

function handleDelete(flow: Flow) {
  if (flow.category === 'builtin') {
    alert('Cannot delete built-in flows')
    return
  }
  if (confirm(`Delete "${flow.name}"?`)) {
    flowsStore.deleteFlow(flow.id)
  }
}

function handleDuplicate(flow: Flow) {
  const newFlow = flowsStore.duplicateFlow(flow.id)
  if (newFlow) {
    emit('edit', newFlow)
  }
}
</script>

<template>
  <div class="flow-library">
    <header class="library-header drag-region">
      <h2 class="library-title">Flow Library</h2>
      <button class="btn btn-ghost btn-sm" @click="emit('close')">✕</button>
    </header>

    <div class="library-toolbar">
      <input
        v-model="searchQuery"
        type="text"
        class="input search-input"
        placeholder="Search flows..."
      />
      <button class="btn btn-primary" @click="emit('create')">
        + Create New
      </button>
    </div>

    <div class="library-content">
      <!-- Built-in flows -->
      <div v-if="filteredFlows.builtin?.length" class="flow-category">
        <h3 class="category-title">Built-in Flows</h3>
        <div class="flow-grid">
          <div
            v-for="flow in filteredFlows.builtin"
            :key="flow.id"
            class="flow-card"
          >
            <div class="flow-header">
              <SiloIcon :name="flow.icon" size="md" class="flow-icon" />
              <span class="flow-name">{{ flow.name }}</span>
            </div>
            <p class="flow-description">{{ flow.description }}</p>
            <div class="flow-meta">
              <span class="flow-steps">{{ flow.steps.length }} step(s)</span>
              <span v-if="flow.tags?.length" class="flow-tags">
                {{ flow.tags.slice(0, 2).join(', ') }}
              </span>
            </div>
            <div class="flow-actions">
              <button class="btn btn-primary btn-sm" @click="emit('select', flow)">
                Use
              </button>
              <button class="btn btn-ghost btn-sm" @click="handleDuplicate(flow)">
                Duplicate
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Custom flows -->
      <div v-if="filteredFlows.custom?.length" class="flow-category">
        <h3 class="category-title">My Flows</h3>
        <div class="flow-grid">
          <div
            v-for="flow in filteredFlows.custom"
            :key="flow.id"
            class="flow-card"
          >
            <div class="flow-header">
              <SiloIcon :name="flow.icon" size="md" class="flow-icon" />
              <span class="flow-name">{{ flow.name }}</span>
            </div>
            <p class="flow-description">{{ flow.description }}</p>
            <div class="flow-meta">
              <span class="flow-steps">{{ flow.steps.length }} step(s)</span>
            </div>
            <div class="flow-actions">
              <button class="btn btn-primary btn-sm" @click="emit('select', flow)">
                Use
              </button>
              <button class="btn btn-secondary btn-sm" @click="emit('edit', flow)">
                Edit
              </button>
              <button class="btn btn-ghost btn-sm" @click="handleDelete(flow)">
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <div v-if="Object.keys(filteredFlows).length === 0" class="empty-state">
        <p class="text-muted">No flows found matching your search.</p>
      </div>
    </div>

    <div class="library-footer">
      <button class="btn btn-secondary" @click="handleImport">
        Import Flow
      </button>
    </div>
  </div>
</template>

<style scoped>
.flow-library {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--color-base);
}

.library-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-6);
  /* Account for macOS traffic light buttons */
  padding-left: 80px;
  background: var(--color-surface);
  border-bottom: var(--border-width-2) solid var(--color-border);
}

.library-title {
  font-size: var(--text-lg);
  font-weight: var(--weight-semibold);
  color: var(--color-text-strong);
}

.library-toolbar {
  display: flex;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-6);
  background: var(--color-surface);
  border-bottom: var(--border-width) solid var(--color-border);
}

.search-input {
  flex: 1;
}

.library-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-6);
}

.flow-category {
  margin-bottom: var(--space-8);
}

.category-title {
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wider);
  color: var(--color-text-muted);
  margin-bottom: var(--space-4);
  padding-bottom: var(--space-2);
  border-bottom: var(--border-width) solid var(--color-border);
}

.flow-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--space-4);
}

.flow-card {
  display: flex;
  flex-direction: column;
  padding: var(--space-4);
  background: var(--color-surface);
  border: var(--border-width) solid var(--color-border);
  transition: border-color var(--duration-fast) var(--ease-out);
}

.flow-card:hover {
  border-color: var(--color-border-strong);
}

.flow-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}

.flow-icon {
  font-size: var(--text-lg);
}

.flow-name {
  font-weight: var(--weight-medium);
  color: var(--color-text-strong);
}

.flow-description {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  margin-bottom: var(--space-3);
  flex: 1;
}

.flow-meta {
  display: flex;
  gap: var(--space-3);
  font-size: var(--text-xs);
  color: var(--color-text-subtle);
  margin-bottom: var(--space-3);
}

.flow-actions {
  display: flex;
  gap: var(--space-2);
}

.empty-state {
  text-align: center;
  padding: var(--space-8);
}

.library-footer {
  padding: var(--space-4) var(--space-6);
  background: var(--color-surface);
  border-top: var(--border-width) solid var(--color-border);
}
</style>
