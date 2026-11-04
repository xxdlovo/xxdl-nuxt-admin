import type { SysMenuDto } from './common'

/**
 * Operation mode used by menu maintenance dialogs.
 * It is shared so page-level orchestration and extracted form components use the same contract.
 */
export type MenuOperateType = 'add' | 'edit'

/**
 * Payload for opening the menu maintenance dialog from a tree row action.
 * `menuType` follows sys_menu.type: 0 directory, 1 menu, 2 button permission.
 */
export type MenuOpenPayload = {
  type: MenuOperateType
  row?: SysMenuDto
  parentId?: string | null
  menuType?: number
}

/**
 * Editable button permission row embedded in the menu form.
 * These rows are persisted as sys_menu records with type=2 and parentId set to the menu id.
 */
export type MenuButtonDraft = {
  id?: string | null
  name: string
  code: string
  sortOrder?: number | null
  status?: number | null
  remark?: string | null
}

/**
 * Tree node built from flat sys_menu records for menu management and role authorization.
 */
export type MenuTreeNode = SysMenuDto & {
  children: MenuTreeNode[]
  level: number
}

/**
 * Flattened visible row used by tree-table views after applying expand/collapse state.
 */
export type MenuTreeRow = MenuTreeNode & {
  hasChildren: boolean
}
