FROM node:22-alpine AS deps
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/gavai/nest/package.json apps/gavai/nest/
COPY libs/platform/package.json libs/platform/
COPY libs/platform/prisma/schema.prisma libs/platform/prisma/
RUN node -e "const p=require('./package.json'); delete p.scripts.prepare; require('fs').writeFileSync('./package.json', JSON.stringify(p,null,2))" \
  && pnpm install --frozen-lockfile --prod \
  && npx prisma generate --schema=libs/platform/prisma/schema.prisma

FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app
COPY . .
RUN HUSKY=0 pnpm install --frozen-lockfile
RUN npx prisma generate --schema=libs/platform/prisma/schema.prisma
RUN pnpm nx build @gavai/nest

FROM node:22-alpine AS prod
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/apps/gavai/nest/dist ./apps/gavai/nest/dist
EXPOSE 3000
CMD ["node", "apps/gavai/nest/dist/main.js"]
