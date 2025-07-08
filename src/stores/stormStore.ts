import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import { NodeType, Slope } from '../types/models'
import type { RefNode, RoofDrain, StormSystem } from '../types/models'
import stormSizingTables from '../code-data/ipc2018/storm-sizing.json'

import { treeFunctions } from '../composables/system-stores'

export const useStormStore = defineStore('storm', () => {

  // --- State --- //
  const drains = ref<Map<string, RoofDrain>>(new Map())
  const nodeMap = ref<Map<string, RefNode>>(new Map())

  interface StormParameters {
    rainfallRate: number
    pipeSlope: Slope
  }

  const stormParameters = ref<StormParameters>({
    rainfallRate: 0,
    pipeSlope: Slope.Eighth
  })

  // --- Composables --- //
  const treeFunc = treeFunctions(nodeMap.value)

  // --- Save/Load --- //
  const serialize = (): string => {
    const drainObject = Object.fromEntries(drains.value)
    const nodesObject = Object.fromEntries(nodeMap.value)
    const data = {
      drains: drainObject,
      stormNodes: nodesObject
    }
    return JSON.stringify(data)
  }

  const deserialize = (data: string): void => {
    const dataObject = JSON.parse(data)
    if (   dataObject?.drains 
        && typeof dataObject.drains === 'object' 
        && !Array.isArray(dataObject.drains)) {

      for (const [key, value] of Object.entries(dataObject.drains)) {
        drains.value.set(key as string, value as RoofDrain)
      }

    }

    if (   dataObject?.stormNodes 
        && typeof dataObject.stormNodes === 'object' 
        && !Array.isArray(dataObject.stormNodes)) {

      for (const [key, value] of Object.entries(dataObject.stormNodes)) {
        nodeMap.value.set(key as string, value as RefNode)
      }

    }
  }

  // --- Getters --- //


  const getNodeTotalArea = computed(() => {
    return (nodeId: string): number => {
      const downstreamNodes = treeFunc.getAllDownstreamNodes.value.get(nodeId) || []
      
      let totalArea = 0
      for (const terminalNodeId of downstreamNodes) {
        const terminalNode = nodeMap.value.get(terminalNodeId)
        if (terminalNode && terminalNode.refId) {
          const drain = drains.value.get(terminalNode.refId)
          if (drain) {
            totalArea += drain.area
          }
        }
      }
      
      return totalArea
    }
  })

  const systemRefs = computed(() => {
    const refMap = new Map<string, StormSystem>()
    const stormRoots = treeFunc.getRootIds.value

    for (const rootId of stormRoots) {
      const root = nodeMap.value.get(rootId)
      if (!root) continue
      // Use rootId as the system ID to maintain consistency
      const newSystemRef: StormSystem = {
        id: rootId,
        area: getNodeTotalArea.value(rootId),
        name: root.name
      }

      refMap.set(rootId, { ...newSystemRef })
    }

    return refMap
  })


  const getRefData = computed(() => {
    return (nodeId: string) => {
      const node = nodeMap.value.get(nodeId)
      if (!node) return null

      if (node.nodeType === NodeType.Leaf) {
        const drain = drains.value.get(node.refId)
        if (drain) {
          return drain
        } else {
          return null
        }
      } else if (node.nodeType === NodeType.SystemRef) {
        const system = systemRefs.value.get(node.refId)
        if (system) {
          return system
        } else {
          return null
        }
      }

      return null
    }
  })

  const getPipeSizeForFlow = (slope: string, flow: number): string => {
    const slopeData = stormSizingTables[slope as keyof typeof stormSizingTables]
    if (!slopeData) return ''

    // Find the smallest pipe size that can handle the flow
    let selectedSize = ''
    let minFlow = Infinity

    for (const [size, capacity] of Object.entries(slopeData)) {
      if (capacity >= flow && capacity < minFlow) {
        minFlow = capacity
        selectedSize = size
      }
    }

    return selectedSize
  }

  const calcStormSizing = (area: number) => {
    const gpm = area * stormParameters.value.rainfallRate * 0.0104
    const slopeKey = Object.keys(stormSizingTables).find(key => 
      key === stormParameters.value.pipeSlope.toString()
    ) || 'Vertical'
    const hPipeSize = getPipeSizeForFlow(slopeKey, gpm)
    const vPipeSize = getPipeSizeForFlow('Vertical', gpm)
    
    // Get the flow capacity at the selected pipe sizes
    const hTotalCapacity = hPipeSize ? (stormSizingTables as any)[slopeKey]?.[hPipeSize] : 0
    const vTotalCapacity = vPipeSize ? (stormSizingTables as any)['Vertical']?.[vPipeSize] : 0
    const hCapacity = hTotalCapacity - gpm
    const vCapacity = vTotalCapacity - gpm
    
    return {
      gpm,
      hPipeSize,
      vPipeSize,
      hCapacity,
      vCapacity
    }
  }

  const getNodeInfo = computed(() => {
    return (nodeId: string) => {
      const node = nodeMap.value.get(nodeId)
      if (!node) return null
      
      const downstreamNodes = treeFunc.getAllDownstreamNodes.value.get(nodeId) || []
      const totalArea = getNodeTotalArea.value(nodeId)

      const refData = getRefData.value(nodeId)
      let ownArea = 0
      if (refData) {
        ownArea = refData.area
      }

      const ownSizing = calcStormSizing(ownArea)
      const totalSizing = calcStormSizing(totalArea)
      
      return {
        node,
        downstreamNodes,
        ownArea,
        ownSizing,
        totalArea,
        totalSizing
      }
    }
  })

  // --- Actions --- //
  const newDrain = (): void => {
    const newId = uuidv4()
    const newDrain: RoofDrain = {
      id: newId,
      name: 'RD-',
      area: 0
    }
    drains.value.set(newId, { ...newDrain })
  }

  const removeDrain = (drainId: string): void => {
    drains.value.delete(drainId)
    for (const [nodeId, node] of nodeMap.value.entries()) {
      if (node.refId === drainId) treeFunc.deleteNode(nodeId)
    }
  }

  return {
    stormParameters, drains, newDrain, removeDrain,
    nodeMap, getNodeInfo, systemRefs, getRefData,
    serialize, deserialize, 
    ...treeFunc
  }
})