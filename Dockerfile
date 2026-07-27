# syntax=docker/dockerfile:1

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV TZ=Asia/Shanghai

RUN npm install -g pm2

COPY .output ./.output

EXPOSE 3000

CMD ["pm2-runtime", "start", ".output/server/index.mjs", "--name", "xxdl-nuxt-admin"]
