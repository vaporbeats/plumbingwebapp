import { computed, ref } from "vue"
import { NodeType } from "../types/models"
import type { RefNode } from "../types/models"
import { v4 as uuidv4 } from 'uuid'

export const treeFunctions = (nodeMap: Map<string, RefNode>) => {
  // Loading state for expensive operations
  const isTreeLoading = ref(false)

  const getRootIds = computed<string[]>(() => {
    const roots: string[] = []
    // Use entries() for better performance when we need both key and value
    for (const [nodeId, node] of nodeMap.entries()) {
      if (nodeId === node.rootId) {
        roots.push(nodeId)
      }
    }
    return roots
  })

  const newRoot = (): void => {
    const newId = uuidv4()
    const newRoot: RefNode = {
      ownId: newId,
      refId: '',
      parentId: '',
      rootId: newId,
      nodeType: NodeType.Branch,
      children: [],
      name: ''
    }

    nodeMap.set(newId, { ...newRoot })
  }

  const newNode = (
    nodeType: NodeType, 
    parentId: string, 
    refId: string | null = null, 
    insertIndex: number | null = null
  ): void => {
    const newId = uuidv4()
    const parent = nodeMap.get(parentId)
    if (!parent) return // Avoid creating orphaned node

    // Prevent SystemRef from referencing its own root
    if (nodeType === NodeType.SystemRef && refId === parent.rootId) {
      return
    }

    let newNode = {} as RefNode

    switch (nodeType) {
      case NodeType.Branch:
        newNode = {
          ownId: newId,
          refId: '',
          parentId,
          rootId: parent.rootId, // Inherit rootId from parent
          nodeType: NodeType.Branch,
          children: [],
          name: ''
        }
        break

      case NodeType.Leaf:
        if (!refId) return
        newNode = {
          ownId: newId,
          refId,
          parentId,
          rootId: parent.rootId, // Inherit rootId from parent
          nodeType: NodeType.Leaf,
          children: [],
          name: ''
        }
        break
      
      case NodeType.SystemRef:
        if (!refId) return
        newNode = {
          ownId: newId,
          refId,
          parentId,
          rootId: parent.rootId, // Inherit rootId from parent
          nodeType: NodeType.SystemRef,
          children: [],
          name: ''
        }
        break

      default:
        return
    }

    if (insertIndex) {
      parent.children.splice(insertIndex, 0, newId)
    } else {
      parent.children.push(newId)
    }

    nodeMap.set(newId, { ...newNode })
    nodeMap.set(parent.ownId, { ...parent }) // Update parent

  }

  const newBranch = (parentId: string, insertIndex: number | null = null): void => {
    newNode(NodeType.Branch, parentId, null, insertIndex)
  }

  const newLeaf = (refId: string, parentId: string, insertIndex: number | null = null): void => {
    newNode(NodeType.Leaf, parentId, refId, insertIndex)
  }

  const newSystemRef = (refId: string, parentId: string, insertIndex: number | null = null): void => {
    newNode(NodeType.SystemRef, parentId, refId, insertIndex)
  }

  const deleteNode = (nodeId: string): void => {
    const node = nodeMap.get(nodeId)
    if (!node) return

    // Store Children
    const nodeChildren = [...node.children] // Create a copy to avoid mutation during iteration

    // Remove from Parent
    const parent = nodeMap.get(node.parentId)
    if (parent) {
      const index = parent.children.findIndex(id => id === nodeId)
      if (index > -1) {
        parent.children.splice(index, 1)
        // Update parent in the map
        nodeMap.set(parent.ownId, { ...parent })
      }
    }

    // Delete self
    nodeMap.delete(nodeId)

    // Delete children (recursive)
    for (const child of nodeChildren) {
      deleteNode(child)
    }
  }

  const moveNode = (nodeId: string, newParentId: string, newIndex: number | null = null): void => {
    const node = nodeMap.get(nodeId)
    if (!node) return

    // Don't allow moving root nodes
    if (node.ownId === node.rootId) return

    const newParent = nodeMap.get(newParentId)
    const oldParent = nodeMap.get(node.parentId)
    if (!newParent || !oldParent) return

    // Prevent SystemRef from being moved to reference its own root
    if (node.nodeType === NodeType.SystemRef && node.refId === newParent.rootId) {
      return
    }

    // Prevent circular references - don't move parent into its own descendant
    const isDescendant = (parentId: string, childId: string): boolean => {
      const parent = nodeMap.get(parentId)
      if (!parent) return false
      if (parent.children.includes(childId)) return true
      return parent.children.some(child => isDescendant(child, childId))
    }
    
    if (isDescendant(nodeId, newParentId)) return

    const oldIndex = oldParent.children.findIndex(id => id === nodeId)
    if (oldIndex === -1) return

    // Validate newIndex bounds
    if (newIndex !== null) {
      if (newIndex < 0 || newIndex > newParent.children.length) return
    }

    if (newParent.ownId !== oldParent.ownId) {
      // Moving to different parent
      if (newIndex === null) {
        newParent.children.push(nodeId)
      } else {
        newParent.children.splice(newIndex, 0, nodeId)
      }
      
      // Update node's parent and inherit new rootId
      node.parentId = newParent.ownId
      node.rootId = newParent.rootId
      
      // Remove from old parent
      oldParent.children.splice(oldIndex, 1)
      
      // Update all descendants' rootId
      const updateDescendantsRootId = (nodeId: string, newRootId: string) => {
        const currentNode = nodeMap.get(nodeId)
        if (!currentNode) return
        
        currentNode.rootId = newRootId
        nodeMap.set(nodeId, { ...currentNode })
        
        for (const childId of currentNode.children) {
          updateDescendantsRootId(childId, newRootId)
        }
      }
      updateDescendantsRootId(nodeId, newParent.rootId)
      
    } else {
      // Moving within same parent
      if (newIndex === oldIndex) return
      
      if (newIndex === null) {
        // Move to end
        newParent.children.splice(oldIndex, 1)
        newParent.children.push(nodeId)
      } else if (newIndex > oldIndex) {
        // Move forward
        newParent.children.splice(newIndex, 0, nodeId)
        newParent.children.splice(oldIndex, 1)
      } else {
        // Move backward
        newParent.children.splice(oldIndex, 1)
        newParent.children.splice(newIndex, 0, nodeId)
      }
    }

    nodeMap.set(nodeId, { ...node })
    nodeMap.set(newParent.ownId, { ...newParent })
    nodeMap.set(oldParent.ownId, { ...oldParent })
  }

  const collapseBranches = (): void => {
    isTreeLoading.value = true
    let mutated = true
    let iterations = 0
    const maxIterations = 1000 // Prevent infinite loops

    while (mutated && iterations < maxIterations) {
      mutated = false
      iterations++

      // Use entries() for better performance and avoid creating intermediate arrays
      for (const [nodeId, node] of nodeMap.entries()) {
        // Early exit conditions
        if (node.nodeType !== NodeType.Branch || nodeId === node.rootId) continue

        const parent = nodeMap.get(node.parentId)
        if (!parent || parent.children.length !== 1) continue

        // Check if this branch is the only child of its parent
        if (parent.children[0] !== nodeId) continue

        // Move all children of this branch to the parent
        const branchChildren = [...node.children]
        for (const childId of branchChildren) {
          const child = nodeMap.get(childId)
          if (!child) continue
          
          // Update child's parent
          child.parentId = parent.ownId
          nodeMap.set(childId, { ...child })
        }

        // Update parent's children (replace the branch with all its children)
        parent.children = branchChildren
        nodeMap.set(parent.ownId, { ...parent })

        // Delete the branch node
        deleteNode(nodeId)
        mutated = true
        break // Exit the loop to restart with fresh iteration
      }
    }

    if (iterations >= maxIterations) {
      console.warn('collapseBranches: Maximum iterations reached, possible circular reference')
    }
    isTreeLoading.value = false
  }

  const pruneEmptyBranches = (): void => {
    isTreeLoading.value = true
    let mutated = true
    let iterations = 0
    const maxIterations = 1000 // Prevent infinite loops

    while (mutated && iterations < maxIterations) {
      mutated = false
      iterations++

      // Use entries() for better performance and avoid creating intermediate arrays
      for (const [nodeId, node] of nodeMap.entries()) {
        // Early exit conditions
        if (node.nodeType !== NodeType.Branch || nodeId === node.rootId) continue

        // Only delete if this branch has no children
        if (node.children.length === 0) {
          // Remove from parent
          const parent = nodeMap.get(node.parentId)
          if (parent) {
            const index = parent.children.indexOf(nodeId)
            if (index !== -1) {
              parent.children.splice(index, 1)
              nodeMap.set(parent.ownId, { ...parent })
            }
          }

          // Delete the empty branch
          nodeMap.delete(nodeId)
          mutated = true
          break // Exit the loop to restart with fresh iteration
        }
      }
    }

    if (iterations >= maxIterations) {
      console.warn('pruneEmptyBranches: Maximum iterations reached, possible circular reference')
    }
    isTreeLoading.value = false
  }

  // Get all descendants of a node (including the node itself)
  const getDescendants = (nodeId: string): string[] => {
    const descendants: string[] = [nodeId]
    const node = nodeMap.get(nodeId)
    if (!node) return descendants

    // Use iterative approach to avoid stack overflow for deep trees
    const stack: string[] = [...node.children]
    while (stack.length > 0) {
      const currentId = stack.pop()!
      descendants.push(currentId)
      
      const currentNode = nodeMap.get(currentId)
      if (currentNode) {
        stack.push(...currentNode.children)
      }
    }
    
    return descendants
  }

  // Get the depth/level of a node in the tree
  const getNodeDepth = (nodeId: string): number => {
    let depth = 0
    let currentId = nodeId
    
    while (true) {
      const node = nodeMap.get(currentId)
      if (!node || currentId === node.rootId) break
      
      depth++
      currentId = node.parentId
    }
    
    return depth
  }

  // Find all nodes of a specific type
  const getNodesByType = (nodeType: NodeType): string[] => {
    const nodes: string[] = []
    for (const [nodeId, node] of nodeMap.entries()) {
      if (node.nodeType === nodeType) {
        nodes.push(nodeId)
      }
    }
    return nodes
  }

  // Get the path from root to a node
  const getNodePath = (nodeId: string): string[] => {
    const path: string[] = []
    let currentId = nodeId
    
    while (true) {
      const node = nodeMap.get(currentId)
      if (!node) break
      
      path.unshift(currentId)
      if (currentId === node.rootId) break
      
      currentId = node.parentId
    }
    
    return path
  }

  // Check if a node is a descendant of another node
  const isDescendantOf = (nodeId: string, ancestorId: string): boolean => {
    let currentId = nodeId
    
    while (true) {
      const node = nodeMap.get(currentId)
      if (!node || currentId === node.rootId) return false
      
      if (node.parentId === ancestorId) return true
      currentId = node.parentId
    }
  }

  // Get the total count of nodes in a subtree
  const getSubtreeSize = (nodeId: string): number => {
    return getDescendants(nodeId).length
  }

  // Find all leaf and systemRef nodes in a subtree
  const getTerminalNodes = (nodeId: string): string[] => {
    const descendants = getDescendants(nodeId)
    return descendants.filter(id => {
      const node = nodeMap.get(id)
      return node && (node.nodeType === NodeType.Leaf || node.nodeType === NodeType.SystemRef)
    })
  }

  // Get terminal nodes for a branch plus all downstream siblings
  const getDownstreamNodes = (nodeId: string): string[] => {
    const node = nodeMap.get(nodeId)
    if (!node) return []

    const terminalNodes: string[] = []

    // Get terminal nodes from this branch
    terminalNodes.push(...getTerminalNodes(nodeId))

    // Get terminal nodes from all downstream siblings
    const parent = nodeMap.get(node.parentId)
    if (parent) {
      const thisIndex = parent.children.indexOf(nodeId)
      if (thisIndex !== -1) {
        // Get all siblings that come after this node
        const downstreamSiblings = parent.children.slice(thisIndex + 1)
        
        for (const siblingId of downstreamSiblings) {
          terminalNodes.push(...getTerminalNodes(siblingId))
        }
      }
    }

    return terminalNodes
  }

  // Get all leaf nodes (excluding SystemRef) for aggregation
  const getLeafNodes = (nodeId: string): string[] => {
    const descendants = getDescendants(nodeId)
    return descendants.filter(id => {
      const node = nodeMap.get(id)
      return node && node.nodeType === NodeType.Leaf
    })
  }

  // Get all SystemRef nodes for system aggregation
  const getSystemRefNodes = (nodeId: string): string[] => {
    const descendants = getDescendants(nodeId)
    return descendants.filter(id => {
      const node = nodeMap.get(id)
      return node && node.nodeType === NodeType.SystemRef
    })
  }

  // Computed getter for all downstream nodes across the entire tree
  const getAllDownstreamNodes = computed<Map<string, string[]>>(() => {
    isTreeLoading.value = true
    
    const downstreamMap = new Map<string, string[]>()
    
    // Process all nodes in the tree
    for (const [nodeId, node] of nodeMap.entries()) {
      const terminalNodes: string[] = []

      // Get terminal nodes from this branch
      terminalNodes.push(...getTerminalNodes(nodeId))

      // Get terminal nodes from all downstream siblings
      const parent = nodeMap.get(node.parentId)
      if (parent) {
        const thisIndex = parent.children.indexOf(nodeId)
        if (thisIndex !== -1) {
          // Get all siblings that come after this node
          const downstreamSiblings = parent.children.slice(thisIndex + 1)
          
          for (const siblingId of downstreamSiblings) {
            terminalNodes.push(...getTerminalNodes(siblingId))
          }
        }
      }

      downstreamMap.set(nodeId, terminalNodes)
    }
    
    isTreeLoading.value = false
    return downstreamMap
  })

  // Validate tree structure (check for circular references, orphaned nodes, etc.)
  const validateTree = (): { isValid: boolean; errors: string[] } => {
    isTreeLoading.value = true
    const errors: string[] = []
    const visited = new Set<string>()

    const checkNode = (nodeId: string, path: string[] = []): void => {
      if (visited.has(nodeId)) {
        errors.push(`Circular reference detected: ${path.join(' -> ')} -> ${nodeId}`)
        return
      }
      visited.add(nodeId)

      const node = nodeMap.get(nodeId)
      if (!node) {
        errors.push(`Orphaned node reference: ${nodeId}`)
        return
      }

      // Check if parent exists
      if (node.parentId && node.ownId !== node.rootId) {
        const parent = nodeMap.get(node.parentId)
        if (!parent) {
          errors.push(`Node ${nodeId} has invalid parent: ${node.parentId}`)
        } else if (!parent.children.includes(nodeId)) {
          errors.push(`Node ${nodeId} not found in parent's children`)
        }
      }

      // Check children
      for (const childId of node.children) {
        const child = nodeMap.get(childId)
        if (!child) {
          errors.push(`Node ${nodeId} has invalid child: ${childId}`)
        } else if (child.parentId !== nodeId) {
          errors.push(`Child ${childId} doesn't reference parent ${nodeId}`)
        } else {
          checkNode(childId, [...path, nodeId])
        }
      }
    }

    // Check all root nodes
    for (const node of nodeMap.values()) {
      if (node.ownId === node.rootId) {
        checkNode(node.ownId)
      }
    }

    // Check for unreachable nodes
    for (const [nodeId, node] of nodeMap.entries()) {
      if (!visited.has(nodeId)) {
        errors.push(`Unreachable node: ${nodeId}`)
      }
    }

    const result = {
      isValid: errors.length === 0,
      errors
    }
    isTreeLoading.value = false
    return result
  }

  return {
    getRootIds, newRoot, newBranch, newLeaf, newSystemRef, deleteNode, moveNode, collapseBranches, pruneEmptyBranches,
    getDescendants, getNodeDepth, getNodesByType, getNodePath, isDescendantOf, getSubtreeSize, getTerminalNodes, getDownstreamNodes, getAllDownstreamNodes,
    getLeafNodes, getSystemRefNodes, validateTree,
    isTreeLoading
  }
}