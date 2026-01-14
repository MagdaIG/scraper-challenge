/**
 * Módulo principal de orquestación del scraper.
 * Coordina todo el proceso de scraping incluyendo inicialización, paginación,
 * extracción de datos, descargas de PDFs y gestión de progreso.
 */

import axios from 'axios';
import * as fs from 'fs';
import { PROGRESS_FILE } from './config.js';
import type { JurisprudenciaData } from './types.js';
import { getViewState, initializeSearch, getPageComplete } from './scraper-api.js';
import { extractData } from './extractor.js';
import { processPageData } from './downloader.js';
import { generateCSV } from './file-manager.js';
import { saveProgress, loadProgress, resetProgress } from './progress.js';

/**
 * Función principal de scraping.
 *
 * Flujo de trabajo:
 * 1. Cargar o resetear estado de progreso
 * 2. Inicializar búsqueda y obtener primera página (si se inicia desde página 1)
 * 3. Extraer datos de la primera página y descargar PDFs
 * 4. Iterar a través de las páginas restantes:
 *    - Obtener HTML de página vía AJAX
 *    - Extraer datos del HTML
 *    - Descargar PDFs para cada registro
 *    - Guardar progreso después de cada página
 * 5. Generar CSV con todos los datos extraídos
 * 6. Limpiar archivo de progreso al completar
 *
 * Soporta reanudar desde progreso guardado cargando lastProcessedPage.
 *
 * @param reset - Si es true, elimina el archivo de progreso e inicia desde cero
 * @returns Objeto con total de registros, descargas exitosas y descargas fallidas
 */
export async function scrape(reset: boolean = false) {
  try {
    if (reset) {
      resetProgress();
    }

    // Cargar progreso guardado o inicializar estado nuevo
    const savedProgress = loadProgress();
    let startPage = 1;
    let totalRecords = 0;
    let totalSuccessful = 0;
    let totalFailed = 0;
    let maxPages = 0;
    let currentViewState = '';
    const data: JurisprudenciaData[] = [];

    // Reanudar desde progreso guardado si está disponible
    if (savedProgress && !reset) {
      console.log(`\nResuming from page ${savedProgress.lastProcessedPage + 1}`);
      console.log(`Previous progress: ${savedProgress.totalRecords} records, ${savedProgress.totalSuccessful} successful, ${savedProgress.totalFailed} failed`);
      startPage = savedProgress.lastProcessedPage + 1;
      totalRecords = savedProgress.totalRecords;
      totalSuccessful = savedProgress.totalSuccessful;
      totalFailed = savedProgress.totalFailed;
      maxPages = savedProgress.maxPages;
    }

    // Manejar inicialización de primera página
    if (startPage === 1) {
      // Obtener ViewState e inicializar búsqueda
      const viewState = await getViewState();
      const { firstPageHtml, viewState: resultViewState, maxPages: maxPagesFromSearch } = await initializeSearch(viewState);
      maxPages = maxPagesFromSearch;
      currentViewState = resultViewState;

      console.log(`\n=== STARTING PROCESSING ===`);
      console.log(`Total pages to process: ${maxPages}\n`);

      // Extraer y procesar primera página
      const firstPageData = extractData(firstPageHtml);
      console.log(`[Page 1/${maxPages}] Extracted ${firstPageData.length} records`);
      data.push(...firstPageData);

      if (firstPageData.length > 0) {
        const { successful, failed } = await processPageData(firstPageData, 1, maxPages);
        totalRecords += firstPageData.length;
        totalSuccessful += successful;
        totalFailed += failed;
      }

      // Guardar progreso después de la primera página
      saveProgress({
        lastProcessedPage: 1,
        maxPages,
        totalRecords,
        totalSuccessful,
        totalFailed,
        timestamp: new Date().toISOString()
      });
    } else {
      // Reanudar desde progreso guardado: reinicializar y saltar directamente a la página objetivo
      console.log(`\n=== RESUMING PROCESSING ===`);
      console.log(`Total pages to process: ${maxPages}\n`);
      console.log(`Starting from page ${startPage}\n`);

      const viewState = await getViewState();
      const { viewState: resultViewState, maxPages: maxPagesFromSearch } = await initializeSearch(viewState);

      if (maxPagesFromSearch !== maxPages) {
        console.log(`Warning: Max pages changed from ${maxPages} to ${maxPagesFromSearch}`);
        maxPages = maxPagesFromSearch;
      }

      // Usar el ViewState de la búsqueda inicial para saltar directamente a la página objetivo
      currentViewState = resultViewState;
    }

    // Procesar páginas restantes
    for (let page = startPage === 1 ? 2 : startPage; page <= maxPages; page++) {
      try {
        // Obtener HTML de página y actualizar ViewState
        const { html, viewState: newViewState } = await getPageComplete(currentViewState, page, maxPages);
        currentViewState = newViewState;

        // Extraer datos del HTML
        const pageData = extractData(html);
        console.log(`[Page ${page}/${maxPages}] Extracted ${pageData.length} records`);
        data.push(...pageData);

        if (pageData.length === 0) {
          console.log(`[Page ${page}/${maxPages}] No records, skipping downloads...`);
          continue;
        }

        // Descargar PDFs para esta página
        const { successful, failed } = await processPageData(pageData, page, maxPages);

        totalRecords += pageData.length;
        totalSuccessful += successful;
        totalFailed += failed;

        // Guardar progreso después de cada página
        saveProgress({
          lastProcessedPage: page,
          maxPages,
          totalRecords,
          totalSuccessful,
          totalFailed,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        // Manejar errores de procesamiento de página y guardar progreso
        console.error(`\nError processing page ${page}:`, error);
        if (axios.isAxiosError(error)) {
          console.error('Status:', error.response?.status);
        }
        saveProgress({
          lastProcessedPage: page - 1,
          maxPages,
          totalRecords,
          totalSuccessful,
          totalFailed,
          timestamp: new Date().toISOString()
        });
        continue;
      }
    }

    // Resumen final y generación de CSV
    console.log(`\n=== FINAL SUMMARY ===`);
    console.log(`Total pages processed: ${maxPages}`);
    console.log(`Total records found: ${totalRecords}`);
    console.log(`PDFs downloaded successfully: ${totalSuccessful}`);
    console.log(`PDFs failed: ${totalFailed}`);

    // Generar CSV con todos los datos extraídos
    if (data.length > 0) {
      generateCSV(data);
    } else if (!savedProgress || reset) {
      console.log('No data to generate CSV');
    } else {
      console.log('CSV not regenerated (resumed session). Run from start to regenerate complete CSV.');
    }

    // Limpiar archivo de progreso al completar exitosamente
    if (fs.existsSync(PROGRESS_FILE)) {
      fs.unlinkSync(PROGRESS_FILE);
    }

    return { totalRecords, totalSuccessful, totalFailed };
  } catch (error) {
    console.error('Error during scraping:', error);
    if (axios.isAxiosError(error)) {
      console.error('Status:', error.response?.status);
      console.error('Data:', error.response?.data);
    }
    throw error;
  }
}
