import { assertOpenApiAccess } from '#server/openapi/guard'

/**
 * Swagger UI 页面：GET /api/docs
 *
 * 页面本身需要登录（见 server/openapi/guard.ts）。
 * 样式与脚本由 public/swagger-ui/ 提供（nuxt.config.ts 的 build:before 钩子
 * 在 dev / build 之前从本地 swagger-ui-dist 复制过去），因此不需要外网 CDN，
 * 也不依赖生产镜像里的 node_modules。
 *
 * 页面被后台 /system/openapi 以 iframe 内嵌，同源访问会自动携带
 * nuxt-session Cookie，所以 Swagger UI 的 Try it out 可以直接调用 tRPC 接口。
 */
const SWAGGER_UI_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>API 文档</title>
<link rel="icon" href="/favicon.ico">
<link rel="stylesheet" href="/swagger-ui/swagger-ui.css">
<style>
  html, body { margin: 0; padding: 0; height: 100%; background: #fafafa; }
  #swagger { height: 100%; }
  .swagger-ui .topbar { display: none; }
</style>
</head>
<body>
<div id="swagger"></div>
<script src="/swagger-ui/swagger-ui-bundle.js"></script>
<script>
  window.onload = function () {
    window.ui = SwaggerUIBundle({
      url: '/api/openapi.json',
      dom_id: '#swagger',
      deepLinking: true,
      withCredentials: true,
      displayRequestDuration: true,
      persistAuthorization: true,
      docExpansion: 'none',
      filter: true,
      tryItOutEnabled: true
    })
  }
</script>
</body>
</html>`

export default defineEventHandler(async (event) => {
    await assertOpenApiAccess(event)

    setHeader(event, 'content-type', 'text/html; charset=utf-8')
    setHeader(event, 'cache-control', 'no-store')

    return SWAGGER_UI_HTML
})
