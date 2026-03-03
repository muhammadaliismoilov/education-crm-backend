# 1-bosqich: Builder
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# Nest build o'rniga to'g'ridan-to'g'ri tsc (TypeScript Compiler) ishlatamiz
# Bu xatolarni aniqroq ko'rsatadi va dist yaratishni majburlaydi
RUN npx tsc && ls -la dist/

# 2-bosqich: Runner
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist

EXPOSE 3000
CMD ["node", "dist/main.js"]