/**
 * useTableOperate 表格操作 hook
 * 提供表格的增删改查操作管理
 */

import type { Ref } from 'vue'
import { useToastSuccess } from '~/utils/toast'
import type { OperateType, TableOperateReturn, UseTableOperateOptions } from './types'

export function useTableOperate<T>(
  options: UseTableOperateOptions<T>
): TableOperateReturn<T> {
  const { $ts } = useI18n()

  // 操作类型
  const operateType = ref<OperateType>('add') as Ref<OperateType>

  // 编辑中的数据
  const editingData = ref<T | null>(null) as Ref<T | null>

  /**
   * 处理新增
   */
  const handleAdd = () => {
    operateType.value = 'add'
    editingData.value = null

    return {
      operateType: operateType.value,
      editingData: null
    }
  }

  /**
   * 处理编辑
   */
  const handleEdit = (id: T[keyof T]) => {
    operateType.value = 'edit'

    // 查找要编辑的数据
    const item = options.data.value.find(item => item[options.idKey] === id)

    // 深拷贝数据，避免直接修改原数据
    editingData.value = item ? JSON.parse(JSON.stringify(item)) : null

    return {
      operateType: operateType.value,
      editingData: editingData.value
    }
  }

  /**
   * 处理删除
   */
  const handleDelete = async (
    id: T[keyof T],
    deleteApi: (id: string) => Promise<void>
  ): Promise<void> => {
    await deleteApi(id as string)
    useToastSuccess($ts('common.deleteSuccess'))
    await options.refresh()
  }

  /**
   * 处理批量删除
   */
  const handleBatchDelete = async (
    ids: T[keyof T][],
    deleteApi: (ids: string[]) => Promise<void>
  ): Promise<void> => {
    await deleteApi(ids as string[])
    useToastSuccess($ts('common.deleteSuccess'))
    await options.refresh()
  }

  return {
    operateType,
    editingData,
    handleAdd,
    handleEdit,
    handleDelete,
    handleBatchDelete
  }
}
