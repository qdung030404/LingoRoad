# =============================================================
# Stage 1: Build Next.js Standalone (Node.js 22, root workspace)
# Build context: repository root (docker build -f apps/web-frontend/Dockerfile .)
# =============================================================
FROM node:22-slim AS builder

WORKDIR /workspace

ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_APP_VERSION=1.0.0
ARG APP_VERSION=1.0.0

ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_APP_VERSION=${NEXT_PUBLIC_APP_VERSION}
ENV APP_VERSION=${APP_VERSION}
ENV LINGOROAD_REQUIRE_CLOUD_API_URL=true

COPY package.json package-lock.json ./
COPY apps/web-frontend/package.json ./apps/web-frontend/package.json

RUN npm ci --workspace=apps/web-frontend --include-workspace-root

COPY apps/web-frontend ./apps/web-frontend
RUN mkdir -p /workspace/apps/web-frontend/public

RUN npm run build --workspace=apps/web-frontend

# Kiểm chứng bundle đã nhúng không còn chuỗi localhost:3000
RUN if grep -R "localhost:3000" /workspace/apps/web-frontend/.next/static /workspace/apps/web-frontend/.next/standalone/apps/web-frontend/.next/server 2>/dev/null; then \
      echo "ERROR: Phát hiện URL localhost:3000 trong bundle Web Admin!" >&2; \
      exit 1; \
    fi

# =============================================================
# Stage 2: Minimal Production Runtime (Standalone + Static + Public)
# =============================================================
FROM node:22-slim AS runner

WORKDIR /app

ARG APP_VERSION=1.0.0

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=8080
ENV WEBSITES_PORT=8080
ENV APP_VERSION=${APP_VERSION}
ENV NEXT_PUBLIC_APP_VERSION=${APP_VERSION}

RUN apt-get update -y \
    && apt-get upgrade -y \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /workspace/apps/web-frontend/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /workspace/apps/web-frontend/.next/static ./apps/web-frontend/.next/static
COPY --from=builder --chown=nextjs:nodejs /workspace/apps/web-frontend/public ./apps/web-frontend/public

USER nextjs

EXPOSE 8080

CMD ["node", "apps/web-frontend/server.js"]
