# Stage 1: Build Frontend SPA
FROM node:20-alpine AS builder

WORKDIR /app

# Build arguments untuk Base URL backend dan AI
ARG VITE_API_URL
ARG VITE_API_BASE_URL
ARG VITE_AI_API_URL
ARG VITE_BACKEND_URL

# Meneruskan ARG ke ENV agar dapat dibaca oleh Vite saat proses build
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_AI_API_URL=${VITE_AI_API_URL}
ENV VITE_BACKEND_URL=${VITE_BACKEND_URL}

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code dan jalankan build
COPY . .
RUN npm run build

# Stage 2: Production Server menggunakan Nginx
FROM nginx:alpine

# Konfigurasi Nginx untuk SPA dan reverse proxy fallback
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Salin output build dari stage builder
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
