/**
 * Definiciones de tipos para la aplicación scraper.
 * Define las estructuras de datos utilizadas en toda la aplicación.
 */

/**
 * Representa un registro de jurisprudencia extraído del sitio web.
 * Contiene todos los campos de metadatos extraídos de la estructura HTML.
 */
export interface JurisprudenciaData {
  type: string;
  caseNumber: string;
  claimCrime: string;
  resolutionType: string;
  resolutionDate: string;
  supremeChamber: string;
  internalLawNorm: string;
  summary: string;
  keywords: string;
  uuid?: string;
  downloadLink?: string;
}

/**
 * Representa un intento fallido de descarga de PDF.
 * Utilizado para registrar y rastrear fallos de descarga para reintentos posteriores.
 */
export interface FailedDownload {
  uuid: string;
  caseNumber: string;
  downloadLink: string;
  error: string;
  attempts: number;
  timestamp: string;
}

/**
 * Representa el estado actual del proceso de scraping.
 * Utilizado para guardar y reanudar el progreso entre sesiones.
 */
export interface ScraperProgress {
  lastProcessedPage: number;
  maxPages: number;
  totalRecords: number;
  totalSuccessful: number;
  totalFailed: number;
  timestamp: string;
}
