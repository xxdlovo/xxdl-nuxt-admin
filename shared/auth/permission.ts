export const PERMISSION_ACTIONS = {
  list: 'list',
  add: 'add',
  edit: 'edit',
  del: 'del'
} as const

export type PermissionAction = typeof PERMISSION_ACTIONS[keyof typeof PERMISSION_ACTIONS]

export type CrudPermissionProcedures<TProcedure> = Record<PermissionAction, TProcedure>

/**
 * Build a permission code from a resource prefix and action.
 * Example: buildPermissionCode('system:user', 'list') -> 'system:user:list'.
 */
export function buildPermissionCode(resourceCode: string, action: PermissionAction) {
  return `${resourceCode}:${action}`
}

/**
 * Build a non-CRUD permission code.
 * Example: customPermissionCode('system:user', 'resetPwd') -> 'system:user:resetPwd'.
 */
export function customPermissionCode(resourceCode: string, action: string) {
  return `${resourceCode}:${action}`
}

/**
 * Build the standard CRUD permission code set for one resource.
 */
export function crudPermissionCodes(resourceCode: string) {
  return {
    list: buildPermissionCode(resourceCode, PERMISSION_ACTIONS.list),
    add: buildPermissionCode(resourceCode, PERMISSION_ACTIONS.add),
    edit: buildPermissionCode(resourceCode, PERMISSION_ACTIONS.edit),
    del: buildPermissionCode(resourceCode, PERMISSION_ACTIONS.del)
  } satisfies Record<PermissionAction, string>
}
