FROM node:22-slim

# openssl es requerido por Prisma
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npx prisma generate && npm run build

EXPOSE 3000
# Sincroniza el esquema de la BD en cada arranque (crea tablas/columnas nuevas) y luego inicia.
CMD npx prisma db push --skip-generate && npm start
