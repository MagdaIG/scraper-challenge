/**
 * Módulo de descarga de PDFs.
 * Maneja la descarga de PDFs con lógica de reintento, verificación de existencia de archivos y registro de fallos.
 */

import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { client, LOG_DIR, MAX_RETRIES, INITIAL_BACKOFF } from './config.js';
import type { JurisprudenciaData, FailedDownload } from './types.js';
import { handle403Error } from './http.js';
import { createFolderStructure, generateFileName, saveJSON } from './file-manager.js';
import { debug } from './utils.js';

/**
 * Descarga un archivo PDF desde el enlace de descarga proporcionado.
 *
 * Proceso:
 * 1. Verifica si el PDF o JSON ya existen (omite si se encuentran)
 * 2. Crea estructura de carpetas y guarda metadatos JSON
 * 3. Descarga PDF con reintento de backoff exponencial para errores 429, 500 y errores de red
 * 4. Valida PDF verificando el encabezado del archivo (%PDF)
 *
 * Estrategia de reintento:
 * - Reintentos infinitos para HTTP 429 (Too Many Requests)
 * - Reintentos infinitos para HTTP 500 (Internal Server Error)
 * - Reintentos infinitos para errores de red o timeout
 * - Backoff exponencial comenzando en INITIAL_BACKOFF
 * - Fallo inmediato para otros errores HTTP (403, 404, etc.)
 *
 * Devuelve estado de éxito, ruta del archivo si es exitoso, o mensaje de error.
 */
export async function downloadPDF(data: JurisprudenciaData): Promise<{ success: boolean; filePath?: string; error?: string; attempts?: number }> {
  if (!data.downloadLink) {
    return { success: false, error: 'No download link available' };
  }

  const folderPath = createFolderStructure(data);
  const fileName = generateFileName(data);
  const baseName = fileName.replace('.pdf', '');
  const fullPath = path.join(folderPath, fileName);
  const jsonPath = path.join(folderPath, `${baseName}.json`);

  // Verificar si el archivo ya existe para evitar descargas redundantes
  const pdfExists = fs.existsSync(fullPath);
  const jsonExists = fs.existsSync(jsonPath);

  if (pdfExists || jsonExists) {
    if (pdfExists && jsonExists) {
      console.log(`  Skipping: PDF and JSON already exist (${data.caseNumber})`);
    } else if (pdfExists) {
      console.log(`  Skipping: PDF already exists (${data.caseNumber})`);
    } else {
      console.log(`  Skipping: JSON already exists (${data.caseNumber})`);
    }
    return { success: true, filePath: pdfExists ? fullPath : undefined };
  }

  // Guardar metadatos JSON antes de descargar PDF
  saveJSON(data, folderPath, baseName);

  debug('Starting PDF download:', {
    caseNumber: data.caseNumber,
    downloadLink: data.downloadLink,
    destinationPath: fullPath
  });

  // Bucle de reintento con backoff exponencial para errores 429 y 500
  let backoff = INITIAL_BACKOFF;
  let attempt = 1;

  while (true) {
    try {
      let response;
      try {
        // Descargar PDF como arraybuffer para manejar contenido binario
        response = await client.get(data.downloadLink, {
          responseType: 'arraybuffer',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36',
            'Accept': 'application/pdf,application/octet-stream,*/*',
            'Referer': 'https://jurisprudencia.pj.gob.pe/jurisprudenciaweb/faces/page/resultado.xhtml'
          },
          validateStatus: (status) => status >= 200 && status < 400
        });
      } catch (error) {
        // Manejar errores 403 con orientación específica
        if (axios.isAxiosError(error) && error.response?.status === 403) {
          handle403Error(error, `downloading PDF: ${data.caseNumber}`);
        }
        throw error;
      }

      // Validar PDF verificando el encabezado del archivo
      const buffer = Buffer.from(response.data);
      if (buffer.toString('ascii', 0, 4) === '%PDF') {
        fs.writeFileSync(fullPath, buffer);
        console.log(`  PDF downloaded: ${fullPath}`);
        return { success: true, filePath: fullPath };
      } else {
        return { success: false, error: 'Downloaded file is not a valid PDF' };
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;

        // Reintentar en 429 y 500 con backoff exponencial
        if (status === 429 || status === 500) {
          const errorType = status === 429 ? '429' : '500';
          console.log(`  Error ${errorType} on attempt ${attempt}. Waiting ${backoff}ms before retrying...`);
          debug(`Error ${errorType} - Details:`, {
            attempt,
            backoff,
            downloadLink: data.downloadLink,
            headers: error.response?.headers
          });
          await new Promise(resolve => setTimeout(resolve, backoff));
          backoff *= 2;
          attempt++;
          continue;
        } else {
          // Fallar inmediatamente para otros errores HTTP
          return {
            success: false,
            error: `HTTP Error ${status}: ${error.message}`,
            attempts: attempt
          };
        }
      } else {
        // Para errores de red o timeout, también aplicar backoff exponencial
        console.log(`  Network/timeout error on attempt ${attempt}. Waiting ${backoff}ms before retrying...`);
        debug('Network/timeout error - Details:', {
          attempt,
          backoff,
          downloadLink: data.downloadLink,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        await new Promise(resolve => setTimeout(resolve, backoff));
        backoff *= 2;
        attempt++;
        continue;
      }
    }
  }
}

/**
 * Registra un intento de descarga fallido en un archivo de log JSON.
 * Crea un archivo de log diario (descargas_fallidas_YYYY-MM-DD.json) en LOG_DIR.
 * Agrega información del fallo incluyendo UUID, número de expediente, mensaje de error y timestamp.
 */
export function registerFailedDownload(data: JurisprudenciaData, error: string, attempts: number): void {
  const failure: FailedDownload = {
    uuid: data.uuid || 'sin-uuid',
    caseNumber: data.caseNumber,
    downloadLink: data.downloadLink || '',
    error,
    attempts,
    timestamp: new Date().toISOString()
  };

  const logFile = path.join(LOG_DIR, `descargas_fallidas_${new Date().toISOString().split('T')[0]}.json`);

  let failures: FailedDownload[] = [];
  if (fs.existsSync(logFile)) {
    const content = fs.readFileSync(logFile, 'utf-8');
    failures = JSON.parse(content);
  }

  failures.push(failure);
  fs.writeFileSync(logFile, JSON.stringify(failures, null, 2));
  console.log(`  Failed download registered in: ${logFile}`);
}

/**
 * Procesa todos los registros de una sola página.
 *
 * Itera a través de cada registro, intenta descargar PDF y rastrea conteos de éxito/fallo.
 * Omite registros sin enlaces de descarga.
 * Registra descargas fallidas para reintento posterior.
 *
 * Devuelve conteos de descargas exitosas y fallidas.
 */
export async function processPageData(data: JurisprudenciaData[], page: number, totalPages: number): Promise<{ successful: number; failed: number }> {
  console.log(`[Page ${page}/${totalPages}] Processing ${data.length} records...`);

  let successful = 0;
  let failed = 0;

  for (let i = 0; i < data.length; i++) {
    const record = data[i];
    console.log(`  [${i + 1}/${data.length}] ${record.caseNumber} (${record.type})`);

    if (!record.downloadLink) {
      console.log(`    No download link, skipping...`);
      failed++;
      continue;
    }

    const result = await downloadPDF(record);

    if (result.success) {
      successful++;
    } else {
      failed++;
      registerFailedDownload(record, result.error || 'Unknown error', result.attempts || 1);
    }
  }

  console.log(`[Page ${page}/${totalPages}] Completed: ${successful} successful, ${failed} failed`);
  return { successful, failed };
}
