// --- Base Nodes --- //

export interface RefNode {
  ownId: string
  refId: string
  parentId: string
  rootId: string
  nodeType: NodeType
  children: string[]
  name: string
}

export enum NodeType {
  Branch,
  Leaf,
  SystemRef
}

// --- Enums --- //

export enum Slope {
  Half = '1/2" per ft',
  Quarter = '1/4" per ft',
  Eighth = '1/8" per ft',
  Sixteenth = '1/16" per ft',
  Vertical = 'Vertical'
}

// --- Storm --- //

export interface RoofDrain {
  id: string
  name: string
  area: number
}

export interface StormSystem extends RoofDrain {}