<template>
  <div class="h-full flex">

    <!-- Left Column -->
    <div class="w-1/3 overflow-y-auto flex flex-col gap-2">

      <!-- System Parameters -->
      <fieldset class="fieldset bg-base-200 border-base-300 rounded-box w-full border p-4">
        <legend class="fieldset-legend">System Parameters</legend>
        <div class="w-full flex flex-row gap-3">
        <div class="w-2/5">
          <label class="label">Rainfall Rate</label>
            <div class="input input-bordered flex items-center w-full">
              <input 
                type="number"
                min="0"
                step="0.05"
                class="flex-1 bg-transparent outline-none"
                v-model="stormParameters.rainfallRate"
              />
              <span class="text-gray-500">in./hr</span>
            </div>
          </div>
          
          <div class="w-3/5">
            <label class="label">Horizontal Pipe Slope</label>
            <select class="select w-full"
              v-model="stormParameters.pipeSlope"
            >
              <option disabled selected>Pick a Slope</option>
              <option 
                v-for="value in Object.values(Slope).filter(v => v !== Slope.Vertical)" 
                :key="value" :value="value"
              >
                {{ value }}
              </option>
            </select>
          </div>
        </div>
      </fieldset>

      <!-- Notes -->
      <textarea 
        class="textarea textarea-bordered w-full" 
        placeholder="Design Notes..."
      ></textarea>

      <!-- Drain Definitions -->
      <div class="card bg-base-200 border-base-300 border">
        <div class="card-body p-2">
          <div class="flex flex-col gap-2">
            <VueDraggable
              :model-value="drainIds"
              :itemKey="(id: string) => id"
              :group="{ name: 'stormTree', pull: 'clone', put: false }"
              :sort="false"
              :clone="cloneDrain"
              class="space-y-2"
              handle=".handle"
            >
              <div 
                v-for="drainId in drainIds" 
                :key="drainId" 
                class="card card-compact bg-base-100 border"
              >
                <div class="card-body p-1">
                  <div class="flex items-center gap-2">
                    <button 
                      class="btn btn-ghost btn-xs btn-circle text-error" 
                      @click="store.removeDrain(drainId)"
                    >
                      <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 6L6 18M6 6l12 12"/>
                      </svg>
                    </button>
                    
                    <div class="flex items-center gap-1">
                      <label class="text-sm text-gray-500">Mark:</label>
                      <input 
                        v-model="getDrainNameBinding(drainId).value" 
                        class="input input-bordered input-sm w-20"
                      />
                    </div>
                    
                    <div class="flex items-center gap-1">
                      <label class="text-sm text-gray-500">Area:</label>
                      <div class="input input-bordered input-sm flex items-center flex-1">
                        <input
                          type="number"
                          class="flex-1 bg-transparent outline-none"
                          v-model="getDrainAreaBinding(drainId).value"
                        />
                        <span class="text-gray-500 text-sm">sqft</span>
                      </div>
                    </div>
                    
                    <div class="handle cursor-grab p-1 hover:bg-base-200 rounded ml-auto">
                      <svg class="w-4 h-4 opacity-60" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="9" cy="6" r="1.5"/>
                        <circle cx="9" cy="12" r="1.5"/>
                        <circle cx="9" cy="18" r="1.5"/>
                        <circle cx="15" cy="6" r="1.5"/>
                        <circle cx="15" cy="12" r="1.5"/>
                        <circle cx="15" cy="18" r="1.5"/>
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </VueDraggable>
            
            <button class="btn btn-outline btn-sm w-full" @click="store.newDrain">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 5v14M5 12h14"/>
              </svg>
              Add Drain
            </button>
          </div>

        </div>
      </div>

      <!-- System References -->
      <div class="card bg-base-200 border-base-300 border">
        <div class="card-body p-4">

        </div>
      </div>

      
      
    </div>

    <div class="divider divider-horizontal mx-1"></div>

    <!-- Right Column -->
    <div class="w-2/3 overflow-y-auto flex flex-col gap-2">
      <button class="btn btn-outline btn-sm" @click="store.newRoot">
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 5v14M5 12h14"/>
        </svg>
        New Riser
      </button>
      
      <!-- Roots -->
      <div v-for="root in getRootIds" :key="root" class="card bg-base-100 border shadow-sm">
        <div class="card-body p-3 gap-0">
          <div class="flex items-center gap-2 p-2 border rounded bg-base-200">
            <button class="btn btn-ghost btn-xs btn-circle text-error" @click="store.deleteNode(root)">
              <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
            <input 
              v-model="getRootNameBinding(root).value" 
              placeholder="Riser Name"
              class="input input-bordered input-sm flex-1"
            />
            <button class="btn btn-outline btn-sm" @click="newBranch(root)">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 5v14M5 12h14"/>
              </svg>
              New Branch
            </button>
          </div>
          
          <!-- Children -->
          <StormTree :node-list="nodeMap.get(root)?.children" :parent-id="root"/>
        </div>
      </div>      
    </div>
  </div>
</template>

<script setup lang="ts">
// --- Imports --- //
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'

import { useStormStore } from '../../stores/stormStore'
import { VueDraggable } from 'vue-draggable-plus'
import StormTree from './StormTree.vue'
import { Slope } from '../../types/models'

// --- Store --- //
const store = useStormStore()
const { stormParameters, drains, nodeMap, getRootIds, getNodeInfo } = storeToRefs(store)

// --- Computed --- //
const drainIds = computed(() => Array.from(drains.value.keys()))

// --- Functions --- //
const newBranch = (parentId: string) => {
  store.newBranch(parentId)
}

const cloneDrain = (drainId: string) => {
  return drainId // Return the drain ID to be used as refId in the tree
}

const getDrainNameBinding = (drainId: string) => {
  return computed({
    get() {
      return drains.value.get(drainId)?.name ?? ''
    },
    set(newValue: string) {
      const drain = drains.value.get(drainId)
      if (!drain) return
      drain.name = newValue
      drains.value.set(drainId, { ...drain })
    }
  })
}

const getDrainAreaBinding = (drainId: string) => {
  return computed({
    get() {
      return drains.value.get(drainId)?.area ?? 0
    },
    set(newValue: number) {
      const drain = drains.value.get(drainId)
      if (!drain) return
      drain.area = newValue
      drains.value.set(drainId, { ...drain })
    }
  })
}

const getRootNameBinding = (root: string) => {
  return computed({
    get() {
      return nodeMap.value.get(root)?.name ?? ''
    },
    set(newValue: string) {
      const node = nodeMap.value.get(root)
      if (!node) return
      node.name = newValue
      nodeMap.value.set(root, { ...node })
    }
  })
}

</script>