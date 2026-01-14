# Scraper de Jurisprudencia

Scraper web para extraer datos de jurisprudencia del sitio web del Poder Judicial del Perú (jurisprudencia.pj.gob.pe). El scraper descarga documentos PDF y extrae metadatos, organizando los archivos en una jerarquía de directorios estructurada.

Desafío https://magnar-ai.notion.site/Desaf-o-de-Scraping-2e6c4a01cc3c808caea0d981edb08ed0

## Características

- **Extracción Completa de Datos**: Extrae todos los campos de metadatos incluyendo números de expediente, fechas de resolución, sumillas, palabras clave y más
- **Descarga de PDFs**: Descarga automáticamente documentos PDF para cada registro
- **Organización Estructurada**: Organiza los PDFs en carpetas por tipo, año y mes
- **Gestión de Progreso**: Guarda y reanuda el progreso del scraping entre sesiones
- **Manejo de Errores**: 
  - Reintento automático con backoff exponencial para HTTP 429 (Too Many Requests)
  - Reintento automático con backoff exponencial para HTTP 500 (Internal Server Error)
  - Orientación específica para errores HTTP 403 (Forbidden)
- **Exportación de Datos**: Genera archivo CSV con todos los datos extraídos
- **Persistencia de Metadatos**: Crea archivos JSON junto a cada PDF con metadatos completos
- **Omitir Archivos Existentes**: Omite automáticamente PDFs y JSONs que ya existen
- **Modo Debug**: Registro detallado opcional controlado por variable de entorno

## Requisitos

- Node.js 22 o superior
- npm o yarn
- Conexión VPN a Perú (requerida para acceder al sitio web)

## Instalación

1. Clonar el repositorio:
```bash
git clone https://github.com/MagdaIG/scraper-challenge
cd scraper-challenge
```

2. Instalar dependencias:
```bash
npm install
```

3. Crear archivo `.env` (opcional):
```bash
cp .env.example .env
```

Editar `.env` para personalizar la configuración según sea necesario.

## Configuración

### Variables de Entorno

Toda la configuración puede establecerse mediante variables de entorno en un archivo `.env`:

- `DEBUG`: Establecer a `true` o `1` para habilitar registro detallado de debug. Por defecto: `false`
- `BASE_DIR`: Directorio raíz para PDFs descargados. Por defecto: `./pdfs`
- `LOG_DIR`: Directorio para logs de fallos. Por defecto: `./logs`
- `CSV_FILE`: Ruta del archivo CSV de salida. Por defecto: `./jurisprudencia.csv`
- `PROGRESS_FILE`: Ruta del archivo de estado de progreso. Por defecto: `./.scraper_progress.json`
- `INITIAL_BACKOFF`: Retraso inicial en milisegundos para backoff exponencial. Por defecto: `1000`
- `MAX_RETRIES`: Intentos máximos de reintento (actualmente no utilizado, los reintentos son infinitos). Por defecto: `5`
- `URL_START`: URL de página inicial (generalmente no es necesario cambiar). Por defecto: URL a inicio.xhtml
- `URL_RESULTS`: URL de página de resultados (generalmente no es necesario cambiar). Por defecto: URL a resultado.xhtml

Ejemplo de archivo `.env`:
```env
DEBUG=false
BASE_DIR=./pdfs
LOG_DIR=./logs
CSV_FILE=./jurisprudencia.csv
INITIAL_BACKOFF=1000
```

### Estructura de Directorios

El scraper crea los siguientes directorios:
- `pdfs/`: Directorio raíz para PDFs descargados
- `logs/`: Directorio para logs de descargas fallidas

## Uso

### Uso Básico

Iniciar el scraper:
```bash
npm start
```

### Resetear Progreso

Iniciar desde cero (elimina el archivo de progreso):
```bash
npm run reset
```

### Limpiar Archivos Generados

Eliminar todos los PDFs descargados, logs, CSV y archivo de progreso:
```bash
npm run clean
```

## Scripts

- `npm start`: Iniciar el scraper (reanuda desde el último progreso guardado)
- `npm run reset`: Resetear progreso e iniciar desde el principio
- `npm run clean`: Eliminar todos los archivos generados (PDFs, logs, CSV, archivo de progreso)

## Estructura del Proyecto

```
src/
├── index.ts          # Punto de entrada de la aplicación
├── config.ts         # Constantes de configuración y configuración del cliente HTTP
├── types.ts          # Definiciones de tipos TypeScript
├── utils.ts          # Funciones de utilidad (normalización de texto, escape CSV)
├── progress.ts       # Funcionalidad de guardar/cargar/resetear progreso
├── http.ts           # Manejadores de errores HTTP (403, 500)
├── scraper-api.ts    # Solicitudes HTTP al sitio web objetivo
├── extractor.ts      # Parsing HTML y extracción de datos
├── file-manager.ts   # Operaciones de archivos (creación de carpetas, JSON, CSV)
├── downloader.ts     # Descarga de PDFs con lógica de reintento
└── scraper.ts        # Orquestación principal del scraping
```

## Docker

### Construir Imagen

```bash
docker build -t jurisprudencia-scraper .
```

### Ejecutar Contenedor

```bash
docker run -v $(pwd)/pdfs:/app/pdfs -v $(pwd)/logs:/app/logs jurisprudencia-scraper
```

### Con Variables de Entorno Personalizadas, por ejemplo DEBUG activado

```bash
docker run -v $(pwd)/pdfs:/app/pdfs -v $(pwd)/logs:/app/logs -e DEBUG=true jurisprudencia-scraper
```

## Estructura de Salida

### Organización de PDFs

Los PDFs se organizan en la siguiente estructura:
```
pdfs/
└── {Tipo}/
    └── {Año}/
        └── {Mes}/
            ├── {Tipo}_{NumeroExpediente}_{Fecha}.pdf
            └── {Tipo}_{NumeroExpediente}_{Fecha}.json
```

Ejemplo:
```
pdfs/
└── Casacion/
    └── 2022/
        └── 01/
            ├── Casacion_003365-2022_10-01-2026.pdf
            └── Casacion_003365-2022_10-01-2026.json
```

### Archivos Generados

- **PDFs**: Documentos de resolución descargados
- **Archivos JSON**: Metadatos para cada PDF (nombres de campos en español)
- **Archivo CSV**: `jurisprudencia.csv` con todos los datos extraídos
- **Archivo de progreso**: `.scraper_progress.json` (temporal, se elimina al completar)
- **Archivos de log**: `logs/descargas_fallidas_YYYY-MM-DD.json` (descargas fallidas)

## Manejo de Errores

### HTTP 403 Forbidden

El scraper detecta cuando el servidor rechaza solicitudes debido a restricciones de geolocalización de IP. Proporciona orientación específica:
- Mensaje de error explicando el problema
- Instrucciones para usar una VPN con un servidor en Perú
- Pasos para verificar la ubicación de la IP

### HTTP 429 Too Many Requests

Reintento automático con backoff exponencial:
- Comienza con retraso de 1 segundo
- Duplica el retraso después de cada intento
- Reintenta indefinidamente hasta tener éxito

### HTTP 500 Internal Server Error

Reintento automático con backoff exponencial:
- Comienza con retraso de 2 segundos
- Duplica el retraso después de cada intento
- Reintenta indefinidamente hasta tener éxito

### Descargas Fallidas

Las descargas fallidas se registran en `logs/descargas_fallidas_YYYY-MM-DD.json` solo para errores definitivos que no se pueden resolver con reintentos:
- Errores HTTP definitivos (403, 404, etc.) - no tienen reintentos
- Archivos descargados que no son PDFs válidos
- Registros sin enlace de descarga

Cada entrada incluye:
- UUID
- Número de expediente
- Enlace de descarga
- Mensaje de error
- Número de intentos realizados
- Timestamp

Nota: Los errores 429, 500 y errores de red tienen reintentos infinitos con backoff exponencial, por lo que no deberían aparecer en este archivo a menos que el proceso se interrumpa.

## Modo Debug

Habilitar modo debug estableciendo la variable de entorno `DEBUG`:

```bash
DEBUG=true npm start
```

O en `.env`:
```
DEBUG=true
```

El modo debug proporciona:
- Registro detallado de solicitudes HTTP
- Actualizaciones de ViewState
- Detalles de parsing HTML
- Detalles de errores
- Creación de estructura de carpetas
- Operaciones de archivos

## Campos de Datos Extraídos

Cada registro incluye:
- **Tipo**: Tipo de recurso legal (ej., "Casación")
- **Número de Expediente**: Número de expediente
- **Pretensión/Delito**: Descripción de pretensión legal o delito
- **Tipo de Resolución**: Tipo de resolución (ej., "Ejecutoria Suprema")
- **Fecha de Resolución**: Fecha de resolución (DD/MM/YYYY)
- **Sala Suprema**: Sala que emitió la resolución
- **Norma de Derecho Interno**: Norma de derecho interno aplicable
- **Sumilla**: Sumilla de la resolución
- **Palabras Clave**: Palabras clave asociadas
- **UUID**: Identificador único
- **Enlace de Descarga**: URL para descargar el PDF

## Detalles Técnicos

### Gestión de ViewState

El scraper maneja tokens ViewState de JavaServer Faces (JSF):
- Extrae ViewState de la página inicial
- Actualiza ViewState después de cada solicitud
- Mantiene ViewState a través de la paginación

### Paginación AJAX

Para páginas después de la primera:
- Usa solicitudes parciales AJAX de RichFaces
- Envía parámetros específicos para paginación de datascroller
- Parsea respuesta XML para extraer fragmentos HTML

### Gestión de Cookies

- Usa `axios-cookiejar-support` y `tough-cookie` para manejo automático de cookies
- Mantiene cookies de sesión a través de todas las solicitudes
- Maneja actualizaciones de cookies automáticamente

