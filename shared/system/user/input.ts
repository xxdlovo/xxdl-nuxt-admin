import {SysUserBaseSchema} from './common'
import {z} from 'zod'
import {ApiQueryRequestSchema, ApiRequestSchema} from "#shared/types/common";

// 新增
export const SysUserAddSchema =
SysUserBaseSchema.pick({
    nickname: true,
        avatar: true,
        phone: true,
        gender: true,
        deptId: true,
        status: true,
        remark: true,
}).extend({
        id: SysUserBaseSchema.shape.id.nonoptional(),
        username: z.string().min(3, 'form.userName.required').max(50, 'form.userName.invalid'),
        password: z.string().min(6,'form.userName.invalid').max(18,'form.userName.invalid'),
        email: z.string().min(6,'form.email.invalid'),
        
    })
export type SysUserAddDTO = z.infer<typeof SysUserAddSchema>;

// 修改
export const SysUserUpdateSchema = SysUserAddSchema.extend({
    id: z.string().nonempty('主键不能为空'),
})
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
export type SysUserUpdatePwdDTO = z.infer<typeof SysUserUpdatePwdSchema>;


// 普通查询
export const SysUserQuerySchema = SysUserBaseSchema.pick({
    id: true,
    username: true,
    email: true,
    nickname: true,
    phone: true,
    gender: true,
    status: true,
    remark: true,
})
export type SysUserQueryDTO = z.infer<typeof SysUserQuerySchema>;

// 分页查询
export const SysUserPageQuerySchema =
SysUserBaseSchema.pick({
    id: true,
    username: true,
    email: true,
    nickname: true,
    phone: true,
    gender: true,
    status: true,
    remark: true,
}).extend(ApiRequestSchema.shape)
// ApiRequestSchema.extend({
//     // 扩展具体的筛选字段
//     id: SysUserBaseSchema.shape.id.optional(),
//     username: SysUserBaseSchema.shape.username.optional(),
//     gender: z.number().optional(),
//     nickname: SysUserBaseSchema.shape.nickname.optional(),
//     phone: SysUserBaseSchema.shape.phone.optional(),
//     status: z.number().optional(),
//     email: SysUserBaseSchema.shape.email.optional(),
// });



export type SysUserPageQueryDTO = z.infer<typeof SysUserPageQuerySchema>;