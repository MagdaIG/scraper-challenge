/**
 * Módulo de configuración.
 * Define constantes, URLs, rutas de archivos e inicializa el cliente HTTP con soporte de cookies.
 */

import * as fs from 'fs';
import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';

/**
 * Bandera de modo debug. Se activa cuando la variable de entorno DEBUG está configurada como 'true' o '1'.
 * Controla el registro detallado en toda la aplicación.
 */
export const DEBUG = process.env.DEBUG === 'true' || process.env.DEBUG === '1';

/**
 * URLs base del sitio web objetivo.
 * URL_START: Página inicial donde se obtiene el ViewState.
 * URL_RESULTS: Página de resultados donde se muestran los resultados de búsqueda.
 * Puede ser sobrescrito mediante variables de entorno.
 */
export const URL_START = process.env.URL_START || 'https://jurisprudencia.pj.gob.pe/jurisprudenciaweb/faces/page/inicio.xhtml';
export const URL_RESULTS = process.env.URL_RESULTS || 'https://jurisprudencia.pj.gob.pe/jurisprudenciaweb/faces/page/resultado.xhtml';

/**
 * Rutas de directorios y archivos para la salida.
 * BASE_DIR: Directorio raíz para los PDFs descargados.
 * LOG_DIR: Directorio para los logs de fallos.
 * CSV_FILE: Archivo CSV de salida con todos los datos extraídos.
 * PROGRESS_FILE: Archivo JSON que almacena el estado del progreso del scraping.
 * Puede ser sobrescrito mediante variables de entorno.
 */
export const BASE_DIR = process.env.BASE_DIR || './pdfs';
export const LOG_DIR = process.env.LOG_DIR || './logs';
export const CSV_FILE = process.env.CSV_FILE || './jurisprudencia.csv';
export const PROGRESS_FILE = process.env.PROGRESS_FILE || './.scraper_progress.json';

/**
 * Constantes de configuración de reintentos.
 * MAX_RETRIES: Número máximo de intentos de reintento (actualmente no utilizado, los reintentos son infinitos).
 * INITIAL_BACKOFF: Retraso inicial en milisegundos para el backoff exponencial.
 * Puede ser sobrescrito mediante variables de entorno.
 */
export const MAX_RETRIES = parseInt(process.env.MAX_RETRIES || '5', 10);
export const INITIAL_BACKOFF = parseInt(process.env.INITIAL_BACKOFF || '1000', 10);

/**
 * Configuración del cliente HTTP.
 * Crea una instancia de CookieJar para la gestión de cookies de sesión.
 * Envuelve la instancia de axios para habilitar el manejo automático de cookies entre solicitudes.
 */
const jar = new CookieJar();
export const client = wrapper(axios.create({ jar }));

/**
 * Inicializa los directorios de salida si no existen.
 * Crea BASE_DIR y LOG_DIR con la bandera recursiva para crear directorios padre.
 */
if (!fs.existsSync(BASE_DIR)) {
  fs.mkdirSync(BASE_DIR, { recursive: true });
}
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}
