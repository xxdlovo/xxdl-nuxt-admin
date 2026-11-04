# syntax=docker/dockerfile:1
#
# 生产镜像：只承载构建产物，不包含源码与 node_modules。
# 由仓库根的 pnpm build（= apps/demo 的 nuxt build）先生成 apps/demo/.output，
# 再以仓库根为 context 构建本镜像。
#
# 注意：pnpm workspace 后产物位于 apps/demo/.output，不再是仓库根。

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV TZ=Asia/Shanghai

RUN npm install -g pm2

COPY apps/demo/.output ./.output

EXPOSE 3000

CMD ["pm2-runtime", "start", ".output/server/index.mjs", "--name", "xxdl-nuxt-admin"]
