# The LifeLink API as a container, for Google Cloud Run (or any container host).
# Cloud Run builds it from this folder: gcloud run deploy --source .
# Settings come from the environment and Secret Manager, never from a file.

FROM node:24.21.0-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
COPY api ./api
COPY scripts ./scripts
RUN npm run build

FROM node:24.21.0-slim
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
USER node
# Cloud Run sets PORT (8080); the server creates or updates the tables, then listens
CMD ["node", "dist/src/server.js"]
