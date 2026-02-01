import z from 'zod'
/**
 * 用户基础 Schema -
 * 用于其他 Schema 继承和复用
 */
export const SysUserBaseSchema = z.object({
    id: z.string().nonoptional(),
    username: z.string().min(3, '用户名至少3个字符').max(50, '用户名最多50个字符').meta(
        {
            query: 'like'
        }
    ),
    email: z.string().email('邮箱格式不正确').max(100, '邮箱最多100个字符').meta(
        {
            query: 'like'
        }
    ),
    nickname: z.string().max(50, '昵称最多50个字符').nullish().meta(
        {
            query: 'like'
        }
    ),
    password: z.string().min(6, '密码至少6个字符').max(255, '密码最多255个字符'),
    avatar: z.string().url('头像必须是有效的URL').or(z.literal('')).nullish(),
    phone: z.string().max(20, '手机号最多20个字符').nullish(),
    gender: z.number().nullish(),
    deptId: z.string().nullish(),
    isAdmin: z.number().nullish(),
    status: z.number().nullish(),
    remark: z.string().max(255, '备注最多255个字符').nullish().meta(
        {
            query: 'like'
        }
    ),
    createdAt: z.string().nullish(),
    updatedAt: z.string().nullish(),
})
export type SysUserDto = z.infer<typeof SysUserBaseSchema>
