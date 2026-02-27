# 1-bosqich: Build
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./

# ✅ Cache mount — har build da qayta yuklamaydi (tez!)
RUN --mount=type=cache,target=/root/.npm \
    npm install

COPY . .

RUN npm run build

# 2-bosqich: Production
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

# ✅ --omit=dev (--only=production eski usul)
RUN --mount=type=cache,target=/root/.npm \
    npm install --omit=dev

COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/main"]