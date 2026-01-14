/**
 * Punto de entrada de la aplicación.
 * Inicializa variables de entorno, parsea argumentos de línea de comandos y ejecuta el scraper.
 */

import 'dotenv/config';
import { DEBUG } from './config.js';
import { scrape } from './scraper.js';

/**
 * Mostrar estado del modo debug si está habilitado.
 */
if (DEBUG) {
  console.log('\nDEBUG mode enabled');
  console.log('   DEBUG environment variable:', process.env.DEBUG);
  console.log('');
}

/**
 * Parsear argumentos de línea de comandos para la bandera de reset.
 * Soporta tanto --reset como -r.
 */
const shouldReset = process.argv.includes('--reset') || process.argv.includes('-r');

/**
 * Ejecutar scraper con bandera de reset si se especifica.
 * Maneja la resolución de promesas y el reporte de errores.
 */
scrape(shouldReset)
  .then((result) => {
    console.log(`\nProcess completed`);
    console.log(`   Records: ${result.totalRecords}`);
    console.log(`   Successful PDFs: ${result.totalSuccessful}`);
    console.log(`   Failed PDFs: ${result.totalFailed}`);
  })
  .catch((error) => {
    console.error('Scraping error:', error);
    process.exit(1);
  });
