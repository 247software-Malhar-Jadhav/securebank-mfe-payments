# ---------------------------------------------------------------------------
# Multi-stage build for the SecureBank payments micro-frontend (a MF remote).
#
# Stage 1 (build): install deps, type-check + Vite build. Emits dist/ which
#                  contains index.html and assets/ (INCLUDING remoteEntry.js).
# Stage 2 (serve): a tiny nginx image serving dist/ with permissive CORS so the
#                  shell can fetch remoteEntry.js cross-origin.
# ---------------------------------------------------------------------------

# ---- Stage 1: build --------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app

# Install dependencies first (cached layer when only source changes).
COPY package.json package-lock.json* ./
# Use `npm ci` when a lockfile exists for reproducible installs; fall back to
# `npm install` otherwise (the repo ships without a committed lockfile).
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Copy the rest and build.
COPY . .
RUN npm run build

# ---- Stage 2: serve --------------------------------------------------------
FROM nginx:1.27-alpine AS serve

# Replace the default site with our CORS-aware config.
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Ship only the built assets (incl. assets/remoteEntry.js).
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
# nginx runs in the foreground so the container stays alive.
CMD ["nginx", "-g", "daemon off;"]
