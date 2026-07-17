import { crudPermissionCodes } from '#shared/auth'

/**
 * Builds reactive frontend permission flags for a standard CRUD resource.
 * Admin users bypass frontend permission checks, matching the server-side RBAC rule.
 */
export function useCrudPermissions(resourceCode: string) {
  const { hasPermission, hasAnyPermission, isAdmin } = useRbacProfile()
  const codes = crudPermissionCodes(resourceCode)

  const canList = computed(() => isAdmin.value || hasPermission(codes.list))
  const canAdd = computed(() => isAdmin.value || hasPermission(codes.add))
  const canEdit = computed(() => isAdmin.value || hasPermission(codes.edit))
  const canDel = computed(() => isAdmin.value || hasPermission(codes.del))
  const canOperate = computed(() => isAdmin.value || hasAnyPermission([codes.edit, codes.del]))

  return {
    codes,
    canList,
    canAdd,
    canEdit,
    canDel,
    canOperate
  }
}
