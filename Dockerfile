# 1-bosqich: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build && echo "=== DIST CONTENTS ===" && ls -la dist/

# 2-bosqich: Production
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist
RUN echo "=== CHECKING DIST ===" && ls -la /app/dist/
EXPOSE 3000

# ✅ dist/src/main — chunki rootDir yo'q tsconfig da
CMD ["node", "dist/src/main"]