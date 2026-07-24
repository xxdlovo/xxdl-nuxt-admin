# syntax=docker/dockerfile:1

FROM node:25-alpine AS builder
WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts

COPY . .
RUN pnpm build

FROM node:25-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

RUN npm install -g pm2

COPY --from=builder /app/.output ./.output

EXPOSE 3000

CMD ["pm2-runtime", "start", ".output/server/index.mjs", "--name", "nuxt-admin"]
