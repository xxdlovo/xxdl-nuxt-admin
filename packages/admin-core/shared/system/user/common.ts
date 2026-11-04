import z from 'zod'
/**
 * 用户基础 Schema -和数据库非空保持一致, 优先使用这个
 * 用于其他 Schema 继承和复用
 */
export const SysUserBaseSchema = z.object({
    id: z.string().nullish(),
    username: z.string().nullish().meta(
        {
            query: 'like'
        }
    ),
    email: z.string().nullish().meta(
        {
            query: 'like'
        }
    ),
    nickname: z.string().nullish().meta(
        {
            query: 'like'
        }
    ),
    password: z.string().min(3, '密码最小xxx个').max(10, '密码不能超过xxx位').nullish(),
    avatar: z.string().nullish(),
    phone: z.string().nullish(),
    gender: z.number().nullish(),
    deptId: z.string().nullish(),
    isAdmin: z.number().nullish(),
    status: z.number().nullish(),
    remark: z.string().nullish().meta(
        {
            query: 'like'
        }
    ),
    createdBy: z.string().nullish(),
    createdAt: z.string().nullish(),
    updatedBy: z.string().nullish(),
    updatedAt: z.string().nullish(),
    isDeleted: z.number().nullish(),
})
export type SysUserDto = z.infer<typeof SysUserBaseSchema>
