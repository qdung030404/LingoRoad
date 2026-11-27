# =============================================================
# Stage 1: Build NestJS Backend (Node.js 22, root workspace)
# Build context: repository root (docker build -f apps/backend/Dockerfile .)
# =============================================================
FROM node:22-slim AS builder

WORKDIR /workspace

# Install openssl for Prisma engine detection and client generation
RUN apt-get update -y \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

# Copy workspace manifests and Prisma schema first for layer caching
COPY package.json package-lock.json ./
COPY apps/backend/package.json ./apps/backend/
COPY apps/backend/prisma ./apps/backend/prisma/

# Install workspace dependencies deterministically from root lockfile
RUN npm ci --workspace=apps/backend --include-workspace-root

# Copy backend source, build configs, and bundled static media
COPY apps/backend ./apps/backend

# Generate Prisma Client and compile TypeScript
RUN npx --workspace=apps/backend prisma generate \
    && npm run build --workspace=apps/backend

# Install standalone Prisma migration CLI pinned to the resolved @prisma/client version,
# then reinstall production-only workspace dependencies cleanly and regenerate Prisma Client.
RUN PRISMA_VERSION=$(node -p "require(require.resolve('@prisma/client/package.json', { paths: ['/workspace/apps/backend', '/workspace'] })).version") \
    && npm install --prefix /opt/prisma-cli --no-package-lock --omit=dev "prisma@${PRISMA_VERSION}" \
    && rm -rf /workspace/node_modules /workspace/apps/backend/node_modules \
    && npm ci --omit=dev --prefer-offline --workspace=apps/backend --include-workspace-root \
    && mkdir -p /workspace/apps/backend/node_modules \
    && /opt/prisma-cli/node_modules/.bin/prisma generate --schema /workspace/apps/backend/prisma/schema.prisma \
    && node -e "const path=require('node:path'),fs=require('node:fs');const p=require.resolve('@prisma/client/package.json',{paths:['/workspace/apps/backend','/workspace']});const g=path.resolve(path.dirname(p),'../../.prisma/client/index.js');if(!fs.existsSync(g)){console.error('Missing generated Prisma client:',g);process.exit(1);}"

# =============================================================
# Stage 2: Minimal Production Runtime (Non-root user, Healthcheck)
# =============================================================
FROM node:22-slim AS runner

WORKDIR /app

ARG APP_VERSION=1.0.0

ENV NODE_ENV=production
ENV APP_VERSION=${APP_VERSION}

# Prisma verifies the managed PostgreSQL certificate using the system CA store.
RUN apt-get update -y \
    && apt-get upgrade -y \
    && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nestjs

# Preserve monorepo workspace module tree so both hoisted root node_modules
# and backend workspace node_modules (including generated @prisma/client) resolve cleanly.
COPY --from=builder --chown=nestjs:nodejs /workspace/package.json ./package.json
COPY --from=builder --chown=nestjs:nodejs /workspace/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /workspace/apps/backend/package.json ./apps/backend/package.json
COPY --from=builder --chown=nestjs:nodejs /workspace/apps/backend/node_modules ./apps/backend/node_modules
COPY --from=builder --chown=nestjs:nodejs /workspace/apps/backend/dist ./apps/backend/dist
COPY --from=builder --chown=nestjs:nodejs /workspace/apps/backend/prisma ./apps/backend/prisma
COPY --from=builder --chown=nestjs:nodejs /workspace/apps/backend/media ./apps/backend/media
COPY --from=builder --chown=nestjs:nodejs /opt/prisma-cli /opt/prisma-cli

WORKDIR /app/apps/backend

USER nestjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

# Deploy SQL migrations when explicitly enabled (default true for local docker-compose; set false on cloud when running under a least-privilege DB app role).
CMD ["sh", "-c", "if [ \"${RUN_STARTUP_MIGRATIONS:-true}\" = \"true\" ]; then /opt/prisma-cli/node_modules/.bin/prisma migrate deploy --schema /app/apps/backend/prisma/schema.prisma; fi && exec node dist/main"]
