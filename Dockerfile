# Usar imagen base de Node.js
FROM node:22-alpine

# Establecer directorio de trabajo
WORKDIR /app

# Copiar archivos de configuración de dependencias
COPY package.json package-lock.json* ./

# Instalar todas las dependencias (incluyendo devDependencies para ts-node)
RUN npm ci

# Copiar código fuente
COPY . .

# Crear directorios necesarios
RUN mkdir -p pdfs logs

# Variables de entorno por defecto
ENV DEBUG=false
ENV NODE_ENV=production

# Exponer volumen para los PDFs descargados
VOLUME ["/app/pdfs", "/app/logs"]

# Comando por defecto
CMD ["npm", "start"]
