<template>
  <template v-if="nodeList">
    <VueDraggable
      :model-value="nodeList ?? []"
      :itemKey="(id: string) => id"
      :group="{ name: 'stormTree', pull: true, put: true }"
      @add="onAdd"
      @update="onUpdate"
      @start="onDragInGroupStart"
      @end="onDragInGroupEnd"
      :empty-insert-threshold="25"
      :invert-swap="true"
      :swap-threshold="0.75"
      :fallback-on-body="true"
      :animation="150"
      class="pb-4 flex flex-col"
      tag="div"
    >
      <div
        v-for="(id, index) in nodeList"
        :key="id"
        class="relative ml-6 pt-1"
      >
        <!-- Tree Lines -->
        <div class="absolute left-[-12px] top-[2px] w-[1px] bg-base-content"
             :class="index === nodeList.length - 1 ? 'h-[20px]' : 'h-[calc(100%+6px)]'"
             style="transform: translateY(-3px);">
        </div>
        <div class="absolute left-[-12px] top-[18px] w-[12px] h-[1px] bg-base-content"></div>
        
        <!-- Node Info Display -->
        <div class="bg-base-300 text-sm px-3 py-2 rounded-t border flex items-center gap-2 flex-wrap">
          <span class="text-base-content/70">Total Load:</span> 
          <span class="badge badge-neutral badge-sm">{{ (getNodeInfo(id)?.totalArea || '0').toLocaleString('en-US') }} sqft</span>
          <span class="badge badge-info badge-sm">{{ getNodeInfo(id)?.totalSizing?.gpm?.toFixed(2) || '-' }} gpm</span>
          <span class="text-base-content/40">•</span>
          <span class="text-base-content/70">H:</span>
          <span class="badge badge-primary badge-sm">{{ getNodeInfo(id)?.totalSizing?.hPipeSize || '-' }}"</span>
          <span class="text-sm text-base-content/60">({{ getNodeInfo(id)?.totalSizing?.hCapacity?.toFixed(2) || '-' }} gpm rem)</span>
          <span class="text-base-content/40">•</span>
          <span class="text-base-content/70">V:</span>
          <span class="badge badge-secondary badge-sm">{{ getNodeInfo(id)?.totalSizing?.vPipeSize || '-' }}"</span>
          <span class="text-sm text-base-content/60">({{ getNodeInfo(id)?.totalSizing?.vCapacity?.toFixed(2) || '-' }} gpm rem)</span>
        </div>
        
        <!-- Draggable Node Content -->
        <div class="bg-base-100 border border-t-0 rounded-b p-2">
          <!-- Delete Button -->
          <div class="flex items-center gap-2">
            <button class="btn btn-ghost btn-xs btn-circle text-error" @click="store.deleteNode(id)">
              <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
            
            <!-- Branch Node -->
            <template v-if="nodeMap.get(id)?.nodeType === NodeType.Branch">
              <input 
                v-model="getBranchNameBinding(id).value" 
                placeholder="Branch Name"
                class="input input-bordered input-sm flex-1"
              />
              <button class="btn btn-outline btn-sm" @click="newBranch(id)">
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 5v14M5 12h14"/>
                </svg>
                New Branch
              </button>
            </template>
            
            <!-- Leaf Node (Drain) -->
            <template v-else-if="nodeMap.get(id)?.nodeType === NodeType.Leaf">
              <div class="flex items-center gap-2 flex-1">
                <span class="badge badge-outline">{{ getDrainName(id) }}</span>
                <span class="badge badge-neutral badge-sm">{{ (getNodeInfo(id)?.ownArea || '0').toLocaleString('en-US') }} sqft</span>
                <span class="badge badge-info badge-sm">{{ getNodeInfo(id)?.ownSizing?.gpm?.toFixed(2) || '-' }} gpm</span>
                <span class="text-base-content/40">•</span>
                <span class="text-base-content/70 text-sm">H:</span>
                <span class="badge badge-primary badge-sm">{{ getNodeInfo(id)?.ownSizing?.hPipeSize || '-' }}"</span>
                <span class="text-base-content/40">•</span>
                <span class="text-base-content/70 text-sm">V:</span>
                <span class="badge badge-secondary badge-sm">{{ getNodeInfo(id)?.ownSizing?.vPipeSize || '-' }}"</span>
              </div>
            </template>
          </div>
        </div>

        <!-- Only show children for Branch nodes -->
        <StormTree
          v-if="nodeMap.get(id)?.nodeType === NodeType.Branch"
          :node-list="nodeMap.get(id)?.children"
          :parent-id="id"
        />
      </div>
    </VueDraggable>
  </template>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useStormStore } from '../../stores/stormStore'
import { VueDraggable } from 'vue-draggable-plus'
import type { DraggableEvent, SortableEvent } from 'vue-draggable-plus'
import { NodeType } from '../../types/models'

const store = useStormStore()
const { nodeMap, getNodeInfo } = storeToRefs(store)

const props = defineProps<{
  nodeList: string[] | undefined
  parentId: string
}>()

const newBranch = (parentId: string) => {
  store.newBranch(parentId)
}

const getBranchNameBinding = (id: string) => {
  return computed({
    get() {
      return nodeMap.value.get(id)?.name ?? ''
    },
    set(newValue: string) {
      const node = nodeMap.value.get(id)
      if (!node) return
      node.name = newValue
      nodeMap.value.set(id, { ...node })
    }
  })
}

const getDrainName = (nodeId: string): string => {
  const node = nodeMap.value.get(nodeId)
  if (!node || node.nodeType !== NodeType.Leaf || !node.refId) return ''
  
  const { drains } = storeToRefs(store)
  return drains.value.get(node.refId)?.name ?? ''
}

const getDrainArea = (nodeId: string): number => {
  const node = nodeMap.value.get(nodeId)
  if (!node || node.nodeType !== NodeType.Leaf || !node.refId) return 0
  
  const { drains } = storeToRefs(store)
  return drains.value.get(node.refId)?.area ?? 0
}

function toDrag<T>(e: SortableEvent) {
  return e as unknown as DraggableEvent<T>
}

const onAdd = (e: SortableEvent): void => {
  const { data, pullMode } = toDrag<string>(e)
  
  // Check if this is a drain being dropped (clone operation)
  const { drains } = storeToRefs(store)
  if (drains.value.has(data)) {
    // This is a drain being dropped - create a Leaf node
    store.newLeaf(data, props.parentId, e.newIndex ?? null)
  } else {
    // This is an existing node being moved from another parent
    store.moveNode(data, props.parentId, e.newIndex ?? null)
  }
}

const onUpdate = (e: SortableEvent): void => {
  const { data, oldIndex, newIndex } = toDrag<string>(e)
  
  // If moving within the same parent, we need to handle the index correctly
  if (oldIndex !== newIndex) {
    store.moveNode(data, props.parentId, newIndex ?? null)
  }
}

// TODO: Tie this to a pinia store value
const isDragInGroup = ref<boolean>(false)

const onDragInGroupStart = () => {
  isDragInGroup.value = true
}

const onDragInGroupEnd = () => {
  isDragInGroup.value = false
}
</script>

<style>
/* No more pseudo-element styling needed */
</style>