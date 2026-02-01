import {SysUserBaseSchema} from './common'
import {z} from 'zod'
// import {createApiResponseSchema} from "#shared/types/common";

// ---------------------- 6. 用户返回结果 DTO（SysUserRespDTO）----------------------
// （接口返回给前端的用户数据，隐藏敏感字段（如password））
export const SysUserRespSchema = z.object({
    id: SysUserBaseSchema.shape.id,
    username: SysUserBaseSchema.shape.username,
    email: SysUserBaseSchema.shape.email,
    nickname: SysUserBaseSchema.shape.nickname,
    avatar: SysUserBaseSchema.shape.avatar,
    phone: SysUserBaseSchema.shape.phone,
    gender: SysUserBaseSchema.shape.gender,
    deptId: SysUserBaseSchema.shape.deptId,
    isAdmin: SysUserBaseSchema.shape.isAdmin,
    status: SysUserBaseSchema.shape.status,
    remark: SysUserBaseSchema.shape.remark,
});
// 导出对应的 TS 类型
export type SysUserRespDTO = z.infer<typeof SysUserRespSchema>;

// ---------------------- 7. 用户列表分页返回结果 DTO（SysUserPageRespDTO）----------------------
// （分页查询返回结果，包含分页信息+用户列表）
export const SysUserPageRespSchema = createApiResponseSchema(SysUserRespSchema);
export type SysUserPageRespDTO = z.infer<typeof SysUserPageRespSchema>;