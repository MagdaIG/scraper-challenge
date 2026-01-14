/**
 * Módulo de manejo de errores HTTP.
 * Proporciona manejadores especializados para códigos de estado HTTP 403 y 500.
 */

import axios from 'axios';
import { debug } from './utils.js';

/**
 * Maneja errores HTTP 403 Forbidden.
 * Detecta cuando el servidor rechaza solicitudes debido a restricciones de geolocalización de IP.
 * Proporciona un mensaje de error amigable con orientación sobre el uso de VPN.
 * Siempre lanza un error (nunca retorna).
 */
export function handle403Error(error: unknown, context: string): never {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    if (status === 403) {
      console.error('\nERROR 403: Forbidden');
      console.error('═══════════════════════════════════════════════════════════');
      console.error(`Server rejected the request at: ${context}`);
      console.error('');
      console.error('POSSIBLE CAUSE:');
      console.error('   Your IP is not located in Peru or you are not using a VPN');
      console.error('   with a server in Peru.');
      console.error('');
      console.error('SOLUTION:');
      console.error('   1. Connect a VPN with a server in Peru');
      console.error('   2. Verify that your IP is from Peru');
      console.error('   3. Try again after changing your location');
      console.error('═══════════════════════════════════════════════════════════\n');
      throw new Error('Error 403: Access denied - IP is not in Peru or VPN required');
    }
  }
  throw error;
}

/**
 * Maneja errores HTTP 500 Internal Server Error con reintento de backoff exponencial.
 *
 * Implementa estrategia de reintento infinito con backoff exponencial:
 * - Comienza con retraso initialBackoff (por defecto 2000ms)
 * - Duplica el retraso después de cada intento fallido
 * - Solo reintenta en estado HTTP 500, relanza otros errores
 *
 * @param operation - Función asíncrona a ejecutar y reintentar
 * @param context - Descripción de la operación para logging
 * @param initialBackoff - Retraso inicial en milisegundos
 * @returns Resultado de la operación cuando es exitosa
 */
export async function handle500Error<T>(
  operation: () => Promise<T>,
  context: string,
  initialBackoff: number = 2000
): Promise<T> {
  let backoff = initialBackoff;
  let attempt = 1;

  while (true) {
    try {
      return await operation();
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;

        if (status === 500) {
          console.error(`\nERROR 500: Internal Server Error at ${context}`);
          console.error(`   Attempt ${attempt}. Waiting ${backoff}ms before retrying...`);
          debug('Error 500 - Details:', {
            context,
            attempt,
            backoff,
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data ? String(error.response.data).substring(0, 200) : undefined
          });
          await new Promise(resolve => setTimeout(resolve, backoff));
          backoff *= 2;
          attempt++;
          continue;
        }
      }

      throw error;
    }
  }
}
