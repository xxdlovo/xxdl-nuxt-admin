import { z } from 'zod'
import {
  SysMemberFeatureQuerySchema,
  type SysMemberFeatureKind,
  type SysMemberFeatureRespDTO
} from '#trade/shared/system/memberFeature'

/**
 * 「功能目录」（memberFeature）页面用到的类型 / schema。
 *
 * 一律从 `#trade/shared/system/memberFeature` 转发，不在页面里另写一份：
 * 列表行、查询条件、新增 / 编辑校验都与服务端同一份 zod schema，
 * 避免前后端字段名或取值范围漂移。
 */

/** 列表行（`sysMemberFeature.page` 返回项） */
export type MemberFeatureRow = SysMemberFeatureRespDTO

/** 功能类型：switch 开关 / quota 配额（-1 不限、0 不可创建、N 上限） */
export type MemberFeatureKind = SysMemberFeatureKind

/** 列表查询条件（`sysMemberFeature.page` 入参，分页由 usePaginatedTable 合并） */
export type MemberFeatureQuery = z.infer<typeof SysMemberFeatureQuerySchema>

/** 搜索表单校验：直接用本模块 QuerySchema */
export const memberFeatureQuerySchema = SysMemberFeatureQuerySchema

/**
 * 新增 / 编辑弹窗的表单模型。
 *
 * 刻意用「全部非空」的前端形态（而不是 z.infer 的 DTO）：模板里可以直接
 * v-model 到输入组件，提交前再归一成 null / 数字后交给 DTO。
 */
export interface MemberFeatureForm {
  id: string
  featureKey: string
  name: string
  kind: SysMemberFeatureKind
  unit: string
  groupName: string
  sortOrder: number
  defaultValue: number
  resolverKey: string
  adminBypass: number
  userShow: number
  status: number
}

/**
 * 新增默认值：开关型 + 默认关 + 管理员绕过（与 `sys_member_feature.admin_bypass`
 * 默认值 1 一致）+ 用户可见 + 启用。
 */
export const createDefaultMemberFeatureForm = (): MemberFeatureForm => ({
  id: '',
  featureKey: '',
  name: '',
  kind: 'switch',
  unit: '',
  groupName: '',
  sortOrder: 0,
  defaultValue: 0,
  resolverKey: '',
  adminBypass: 1,
  userShow: 1,
  status: 1
})
