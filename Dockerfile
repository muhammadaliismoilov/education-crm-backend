# 1-bosqich: Qurilish (Build)
FROM node:18-alpine AS builder

WORKDIR /app

# Kutubxonalarni o'rnatish
COPY package*.json ./
RUN npm install

# Kodni nusxalash va build qilish
COPY . .
RUN npm run build

# 2-bosqich: Ishga tushirish (Production)
FROM node:18-alpine

WORKDIR /app

# Faqat kerakli kutubxonalarni production uchun o'rnatish
COPY package*.json ./
RUN npm install --only=production

# Build bo'lgan kodni builder'dan nusxalab olish
COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/main"]