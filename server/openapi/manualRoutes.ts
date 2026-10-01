import { toOpenApiSchema } from './schema'
import { SysOssRespSchema } from '#shared/system/oss'

/**
 * 非 tRPC 的原生 Nitro 路由（server/api/**、server/routes/**）手工登记片段。
 *
 * tRPC 覆盖不了上传、OAuth 回调这类场景（见 doc/main/3.backend-handbook/7.api-routes.md），
 * 这些接口没有 procedure 可供遍历，只能手工描述。
 *
 * ⚠️ 维护约定：新增或修改 server/api/**、server/routes/** 下的原生路由时，
 * 需要在这里同步登记，否则文档会缺漏。
 */

const uploadPath = '/api/system/oss/upload'
const avatarPath = '/api/system/user/avatar'
const oauthCallbackPath = '/auth/{platform}'

/** 原生路由统一返回体：`{ success: true, data }`（OAuth 回调除外，它是 302 重定向）。 */
const ossUploadConversion = toOpenApiSchema(SysOssRespSchema, { io: 'output' })

const ossUploadDataSchema = ossUploadConversion.schema

/** 响应 schema 可能抽取出的 $defs，需要合并进 components.schemas。 */
export const manualDefs = ossUploadConversion.defs

function successEnvelope(dataSchema: Record<string, unknown>) {
    return {
        type: 'object',
        properties: {
            success: { type: 'boolean' },
            data: dataSchema
        },
        required: ['success', 'data']
    }
}

/** 原生路由的错误体由 createError 生成（H3 错误结构），与 tRPC 的 TRPCFormattedError 不同。 */
const nativeErrorResponses = {
    400: {
        description: 'AppError（业务/校验错误）。message 已按请求语言翻译。'
    },
    401: {
        description: 'auth.unauthorized：未登录'
    },
    403: {
        description: 'auth.forbidden：已登录但缺少权限码'
    },
    500: {
        description: '未预期的服务端错误'
    }
}

export const manualTagName = 'native-routes'

export const manualTag = {
    name: manualTagName,
    description: '原生 Nitro 路由：文件上传与 OAuth 回调（非 tRPC，需手工维护文档）'
}

export const manualPaths: Record<string, Record<string, unknown>> = {
    [uploadPath]: {
        post: {
            tags: [manualTagName],
            operationId: 'native_ossUpload',
            summary: '上传文件到对象存储',
            description: [
                '原生 Nitro 路由（server/api/system/oss/upload.post.ts）。',
                '',
                '- 入参：`multipart/form-data`，字段 `configId` 指定存储配置，字段 `file` 为文件本体。',
                '- 权限：登录 + 权限码 `system:oss:add`（管理员直通）。',
                '- 校验：缺少文件名或内容为空时抛 `AppError(\'module.system.oss.uploadFileRequired\')`。',
                '- 缺失 `configId` 时抛 `AppError(\'module.system.oss.uploadConfigRequired\')`。',
                '- 成功后写入 `sys_oss` 记录并返回落库行。',
                '',
                '```bash',
                `curl -X POST -b "nuxt-session=<cookie>" -F "configId=<id>" -F "file=@avatar.png" ${uploadPath}`,
                '```'
            ].join('\n'),
            security: [{ cookieAuth: [] }],
            requestBody: {
                required: true,
                content: {
                    'multipart/form-data': {
                        schema: {
                            type: 'object',
                            properties: {
                                configId: { type: 'string', description: 'sys_oss_config.id' },
                                file: { type: 'string', format: 'binary', description: '文件本体' }
                            },
                            required: ['configId', 'file']
                        }
                    }
                }
            },
            responses: {
                200: {
                    description: '上传成功',
                    content: {
                        'application/json': {
                            schema: successEnvelope(ossUploadDataSchema)
                        }
                    }
                },
                ...nativeErrorResponses
            },
            'x-permission': 'system:oss:add'
        }
    },
    [avatarPath]: {
        post: {
            tags: [manualTagName],
            operationId: 'native_userAvatarUpload',
            summary: '上传当前用户头像',
            description: [
                '原生 Nitro 路由（server/api/system/user/avatar.post.ts）。',
                '',
                '- 入参：`multipart/form-data`，字段 `file`，`content-type` 必须以 `image/` 开头。',
                '- 权限：仅要求登录，无权限码校验。',
                '- 存储配置取默认可用配置（`getDefaultUploadConfig()`），不可用时抛',
                '  `AppError(\'module.system.oss.uploadConfigUnavailable\')`。',
                '- 本接口只负责上传文件，返回的是存储记录；把 avatar 字段写回用户资料需另调 `auth.updateProfile`。'
            ].join('\n'),
            security: [{ cookieAuth: [] }],
            requestBody: {
                required: true,
                content: {
                    'multipart/form-data': {
                        schema: {
                            type: 'object',
                            properties: {
                                file: { type: 'string', format: 'binary', description: '图片文件（image/*）' }
                            },
                            required: ['file']
                        }
                    }
                }
            },
            responses: {
                200: {
                    description: '上传成功',
                    content: {
                        'application/json': {
                            schema: successEnvelope(ossUploadDataSchema)
                        }
                    }
                },
                ...nativeErrorResponses
            }
        }
    },
    [oauthCallbackPath]: {
        get: {
            tags: [manualTagName],
            operationId: 'native_oauthCallback',
            summary: 'OAuth 平台回调',
            description: [
                '原生 Nitro 路由（server/routes/auth/[platform].get.ts）。',
                '',
                '- 不返回 JSON：全程使用 302 重定向（成功 → `/system/home`，失败 → `/login?oauthError=<key>`）。',
                '- `platform` 归一化后与支持的平台列表比对，不支持时同样重定向到登录页。',
                '- 平台配置缺失 clientId/clientSecret 时记录登录失败日志并重定向。',
                '- 该接口是浏览器授权码流程的回调地址，不需要在 Swagger UI 里手工调用。'
            ].join('\n'),
            security: [],
            parameters: [
                {
                    name: 'platform',
                    in: 'path',
                    required: true,
                    schema: { type: 'string' },
                    description: '平台标识，例如 github / gitee'
                },
                {
                    name: 'code',
                    in: 'query',
                    required: false,
                    schema: { type: 'string' },
                    description: '平台返回的授权码（由第三方平台附加）'
                },
                {
                    name: 'state',
                    in: 'query',
                    required: false,
                    schema: { type: 'string' },
                    description: '平台回传的 state'
                }
            ],
            responses: {
                302: {
                    description: '重定向：成功 → `/system/home`；失败 → `/login?oauthError=<i18nKey>`',
                    headers: {
                        Location: { schema: { type: 'string' }, description: '重定向目标' }
                    }
                }
            }
        }
    }
}
