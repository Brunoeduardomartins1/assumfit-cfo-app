import type { SpreadsheetRow } from "@/types/spreadsheet"

export interface HierarchyNode {
  row: SpreadsheetRow
  children: HierarchyNode[]
  parent: HierarchyNode | null
}

/**
 * Build a tree from flat SpreadsheetRow[] using parentId relationships
 */
export function buildHierarchy(rows: SpreadsheetRow[]): HierarchyNode[] {
  const nodeMap = new Map<string, HierarchyNode>()
  const roots: HierarchyNode[] = []

  // Create nodes
  for (const row of rows) {
    nodeMap.set(row.id, { row, children: [], parent: null })
  }

  // Link parent-child
  for (const row of rows) {
    const node = nodeMap.get(row.id)!
    if (row.parentId && nodeMap.has(row.parentId)) {
      const parent = nodeMap.get(row.parentId)!
      node.parent = parent
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  }

  return roots
}

/**
 * Get all descendant IDs of a given row (for collapse/expand)
 */
export function getDescendantIds(rows: SpreadsheetRow[], parentId: string): string[] {
  const ids: string[] = []
  const children = rows.filter((r) => r.parentId === parentId)
  for (const child of children) {
    ids.push(child.id)
    if (child.isGroup) {
      ids.push(...getDescendantIds(rows, child.id))
    }
  }
  return ids
}

/**
 * Get direct children of a group row
 */
export function getDirectChildren(rows: SpreadsheetRow[], parentId: string): SpreadsheetRow[] {
  return rows.filter((r) => r.parentId === parentId)
}

/**
 * Get leaf nodes (non-group rows) under a parent
 */
export function getLeafDescendants(rows: SpreadsheetRow[], parentId: string): SpreadsheetRow[] {
  const leaves: SpreadsheetRow[] = []
  const children = rows.filter((r) => r.parentId === parentId)
  for (const child of children) {
    if (child.isGroup) {
      leaves.push(...getLeafDescendants(rows, child.id))
    } else {
      leaves.push(child)
    }
  }
  return leaves
}

/**
 * Get the path from root to a given row
 */
export function getAncestorPath(rows: SpreadsheetRow[], rowId: string): SpreadsheetRow[] {
  const path: SpreadsheetRow[] = []
  const rowMap = new Map(rows.map((r) => [r.id, r]))

  let current = rowMap.get(rowId)
  while (current) {
    path.unshift(current)
    current = current.parentId ? rowMap.get(current.parentId) : undefined
  }

  return path
}
