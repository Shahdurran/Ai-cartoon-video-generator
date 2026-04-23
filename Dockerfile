# Backend (Node.js / Express + Bull workers) Dockerfile for Railway.
# Ships with ffmpeg because the cartoon assembly pipeline depends on it.

FROM node:20-bullseye-slim AS deps

WORKDIR /app

# Install production dependencies only; ffmpeg is added in the runtime stage.
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

# ---------------- Runtime ----------------
FROM node:20-bullseye-slim AS runtime

# ffmpeg + fonts for subtitle burning, plus common root CAs (R2/HTTPS).
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      ffmpeg \
      fonts-dejavu-core \
      ca-certificates \
      tini \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000

# Copy dependencies first for caching, then source.
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json* ./
COPY server-new.js ./
COPY src ./src
COPY public ./public
COPY scripts ./scripts
COPY storage ./storage

# effects/ holds gitignored binary overlays that aren't used by the cartoon
# pipeline; mkdir so legacy code that assumes the dir exists doesn't crash.
RUN mkdir -p ./effects

EXPOSE 3000

# tini handles PID 1 signals cleanly (graceful Bull shutdowns).
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "server-new.js"]
