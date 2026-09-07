
ARG NODE_VERSION=24-alpine


FROM node:${NODE_VERSION} AS build
WORKDIR /repo


ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable


COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY api/package.json ./api/

RUN --mount=type=cache,id=pnpm,target=/pnpm-store \
    pnpm install --frozen-lockfile --filter api... --store-dir /pnpm-store

COPY api ./api
RUN pnpm --filter api build


RUN node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('/repo/package.json','utf8'));delete p.scripts;fs.writeFileSync('/repo/package.json',JSON.stringify(p,null,2))"

RUN --mount=type=cache,id=pnpm,target=/pnpm-store \
    pnpm deploy --filter=api --prod --legacy /out --store-dir /pnpm-store


FROM node:${NODE_VERSION} AS runtime
ENV NODE_ENV=production

WORKDIR /app
COPY --from=build /out/package.json ./package.json
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /out/dist ./dist


COPY --from=build /repo/api/migrations ./migrations


COPY --from=build /repo/api/scripts ./scripts


RUN mkdir -p /app/data && chown -R node:node /app/data


USER node
EXPOSE 3000

# `--start-period` covers boot; the check hits the one route that needs no auth.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/main"]
