<template>
  <div class="w-full h-full flex flex-col">
    <div role="tablist" class="tabs tabs-box rounded-none">
      <template v-for="tab in Tab">
        <a role="tab" 
          class="tab" 
          :class="tab === currentTab ? 'tab-active' : ''"
          @click="currentTab = tab"        
        >{{ tab }}</a>
      </template>
    </div>
    <div class="w-full h-0 flex-1 p-2">
      <component :is="tabComponent[currentTab]"/>
    </div>
  </div>
</template>

<script setup lang="ts">
// --- Imports --- //
import { ref } from 'vue'
import type { Component } from 'vue'

// --- Tabs --- //
enum Tab {
  Water = "Water",
  Storm = "Storm",
}

const currentTab = ref<Tab>(Tab.Storm)

import Water from './components/Water.vue'
import Storm from './components/Storm/Storm.vue'

const tabComponent: Record<Tab, Component> = {
  [Tab.Water]: Water,
  [Tab.Storm]: Storm,
}

</script>
