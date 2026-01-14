/**
 * Funciones de utilidad para procesamiento de texto y depuración.
 */

import { DEBUG } from './config.js';

/**
 * Función de registro condicional de debug.
 * Solo imprime en consola cuando el modo DEBUG está habilitado.
 * Antepone el prefijo '[DEBUG]' a todos los mensajes de log.
 */
export function debug(...args: any[]): void {
  if (DEBUG) {
    console.log('[DEBUG]', ...args);
  }
}

/**
 * Normaliza texto eliminando diacríticos y caracteres especiales.
 * Utilizado para generar nombres de carpetas y archivos seguros para el sistema de archivos.
 *
 * Proceso:
 * 1. Normaliza a NFD (forma descompuesta) para separar caracteres base de diacríticos
 * 2. Elimina marcas diacríticas combinadas (rango Unicode \u0300-\u036f)
 * 3. Reemplaza caracteres no alfanuméricos con guiones bajos
 * 4. Colapsa múltiples guiones bajos consecutivos en uno
 * 5. Elimina guiones bajos iniciales y finales
 */
export function removeAccents(text: string): string {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Escapa un valor para formato CSV según RFC 4180.
 *
 * Reglas:
 * - Los valores que contienen comas, comillas o saltos de línea deben estar entre comillas
 * - Las comillas dentro de valores entre comillas deben escaparse duplicándolas
 * - Devuelve el valor tal cual si no se necesita escape
 */
export function escapeCSV(value: string): string {
  if (!value) return '';
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
