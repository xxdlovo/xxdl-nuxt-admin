import { crudPermissionCodes } from '#shared/auth'

/**
 * Builds reactive frontend permission flags for a standard CRUD resource.
 */
export function useCrudPermissions(resourceCode: string) {
  const { hasPermission, hasAnyPermission } = useRbacProfile()
  const codes = crudPermissionCodes(resourceCode)

  const canList = computed(() => hasPermission(codes.list))
  const canAdd = computed(() => hasPermission(codes.add))
  const canEdit = computed(() => hasPermission(codes.edit))
  const canDel = computed(() => hasPermission(codes.del))
  const canOperate = computed(() => hasAnyPermission([codes.edit, codes.del]))

  return {
    codes,
    canList,
    canAdd,
    canEdit,
    canDel,
    canOperate
  }
}
