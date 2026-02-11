import {SysUserBaseSchema} from './common'
import {z} from 'zod'
import {ApiQueryRequestSchema, ApiRequestSchema} from "#shared/types/common";

// ---------------------- 1. 新增用户 DTO（SysUserAddDTO）----------------------
//创建用户时传入的参数
export const SysUserAddSchema = z.object({
        id: SysUserBaseSchema.shape.id.nonoptional(),
        username: z.string('form.userName.required').min(3, 'form.userName.required').max(50, 'form.userName.required'),
        password: SysUserBaseSchema.shape.password.nonoptional(),
        email: SysUserBaseSchema.shape.email.nonoptional(),
        nickname: SysUserBaseSchema.shape.nickname,
        avatar: SysUserBaseSchema.shape.avatar,
        phone: SysUserBaseSchema.shape.phone,
        gender: SysUserBaseSchema.shape.gender,
        deptId: SysUserBaseSchema.shape.deptId,
        status: SysUserBaseSchema.shape.status,
        remark: SysUserBaseSchema.shape.remark,
    })
// 导出对应的 TS 类型
export type SysUserAddDTO = z.infer<typeof SysUserAddSchema>;

// ---------------------- 2. 更新用户 DTO（SysUserUpdateDTO）----------------------
// （更新用户时传入的参数，ID必传，排除不可更新字段（如password可单独做修改接口））
export const SysUserUpdateSchema = z.object({
    id: SysUserBaseSchema.shape.id.nonoptional('id不能为空'), // 更新必传用户ID
    email: SysUserBaseSchema.shape.email,
    nickname: SysUserBaseSchema.shape.nickname,
    avatar: SysUserBaseSchema.shape.avatar,
    phone: SysUserBaseSchema.shape.phone,
    gender: SysUserBaseSchema.shape.gender,
    deptId: SysUserBaseSchema.shape.deptId,
    status: SysUserBaseSchema.shape.status,
    remark: SysUserBaseSchema.shape.remark,
});
// 导出对应的 TS 类型
export type SysUserUpdateDTO = z.infer<typeof SysUserUpdateSchema>;

// ---------------------- 3. 密码修改 DTO（SysUserUpdatePwdDTO）----------------------
// （单独拆分密码修改，符合安全规范，避免和普通更新混在一起）
export const SysUserUpdatePwdSchema = z.object({
    id: SysUserBaseSchema.shape.id, // 必传用户ID
    oldPassword: z.string().min(1, "原密码不能为空").max(255, "原密码长度不能超过255位"),
    newPassword: z.string().min(6, "新密码长度不能少于6位").max(255, "新密码长度不能超过255位"),
    confirmPassword: z.string().min(6, "确认密码长度不能少于6位").max(255, "确认密码长度不能超过255位"),
}).refine((data) => data.newPassword === data.confirmPassword, {
    message: "新密码和确认密码不一致",
    path: ["confirmPassword"], // 错误信息指向 confirmPassword 字段
});
// 导出对应的 TS 类型
export type SysUserUpdatePwdDTO = z.infer<typeof SysUserUpdatePwdSchema>;

const emptyToUndefined = (v: unknown) =>
    v === "" ? undefined : v;
// ---------------------- 4. 单个用户查询 DTO（SysUserQueryDTO）----------------------
// （根据ID/用户名等查询单个用户）
export const SysUserQuerySchema = z.object({
    // 多条件查询（二选一即可，可扩展更多查询条件）
    id: SysUserBaseSchema.shape.id.optional(),
    username: SysUserBaseSchema.shape.username.optional(),
    gender: z.number().optional(),
    nickname: SysUserBaseSchema.shape.nickname.optional(),
    phone: SysUserBaseSchema.shape.phone.optional(),
    status: z.number().optional(),
    email: SysUserBaseSchema.shape.email.optional(),
});
// 导出对应的 TS 类型
export type SysUserQueryDTO = z.infer<typeof SysUserQuerySchema>;

// ---------------------- 5. 用户列表分页查询 DTO（SysUserPageQueryDTO）----------------------
// （分页+多条件筛选，继承分页查询参数）
export const SysUserPageQuerySchema = ApiRequestSchema.extend({
    // 扩展具体的筛选字段
    id: SysUserBaseSchema.shape.id.optional(),
    username: SysUserBaseSchema.shape.username.optional(),
    gender: z.number().optional(),
    nickname: SysUserBaseSchema.shape.nickname.optional(),
    phone: SysUserBaseSchema.shape.phone.optional(),
    status: z.number().optional(),
    email: SysUserBaseSchema.shape.email.optional(),
});
// 导出对应的 TS 类型
export type SysUserPageQueryDTO = z.infer<typeof SysUserPageQuerySchema>;