/**
 * useTableOperate 表格操作 hook
 * 提供表格的增删改查操作管理
 */

import type { Ref } from 'vue'
import { useToastSuccess } from '~/utils/toast'
import type { OperateType, UseTableOperateOptions } from './types'

export interface UseTableOperateReturn<T> {
  /** 操作类型 */
  operateType: Ref<OperateType>
  /** 正在编辑的数据 */
  editingData: Ref<T | null>
  /** 弹窗/抽屉是否可见 */
  drawerVisible: Ref<boolean>
  /** 选中的行 keys */
  checkedRowKeys: Ref<string[]>
  /** 打开新增弹窗 */
  handleAdd: () => void
  /** 打开编辑弹窗 */
  handleEdit: (id: T[keyof T]) => void
  /** 关闭弹窗 */
  closeVisible: () => void
  /** 删除之后 */
  onDeleted: () => Promise<void>
  /** 批量删除之后 */
  onBatchDeleted: () => Promise<void>
}

export function useTableOperate<T>(
  options: UseTableOperateOptions<T>
): UseTableOperateReturn<T> {
  const { $ts } = useI18n()

  // 操作类型
  const operateType = ref<OperateType>('add') as Ref<OperateType>

  // 编辑中的数据
  const editingData = ref<T | null>(null) as Ref<T | null>

  // 弹窗可见性
  const drawerVisible = ref(false)

  // 选中的行 keys
  const checkedRowKeys = ref<string[]>([])

  /**
   * 处理新增
   */
  const handleAdd = () => {
    operateType.value = 'add'
    editingData.value = null
    drawerVisible.value = true
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

    drawerVisible.value = true
  }

  /**
   * 关闭弹窗
   */
  const closeVisible = () => {
    drawerVisible.value = false
    editingData.value = null
  }

  /**
   * 删除之后
   */
  const onDeleted = async (): Promise<void> => {
    useToastSuccess($ts('common.deleteSuccess'))
    await options.refresh()
  }

  /**
   * 批量删除之后
   */
  const onBatchDeleted = async (): Promise<void> => {
    useToastSuccess($ts('common.deleteSuccess'))
    checkedRowKeys.value = []
    await options.refresh()
  }

  return {
    operateType,
    editingData,
    drawerVisible,
    checkedRowKeys,
    handleAdd,
    handleEdit,
    closeVisible,
    onDeleted,
    onBatchDeleted
  }
}
