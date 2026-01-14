/**
 * Módulo de gestión de progreso.
 * Maneja el guardado, carga y reseteo del estado del progreso del scraping.
 * Permite reanudar sesiones de scraping interrumpidas.
 */

import * as fs from 'fs';
import { PROGRESS_FILE } from './config.js';
import type { ScraperProgress } from './types.js';

/**
 * Guarda el progreso actual del scraping en disco.
 * Escribe los datos de progreso como JSON formateado en PROGRESS_FILE.
 * Sobrescribe el archivo existente si está presente.
 */
export function saveProgress(progress: ScraperProgress): void {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2), 'utf-8');
}

/**
 * Carga el progreso guardado desde disco.
 * Devuelve null si el archivo no existe o si falla el parsing.
 * Maneja errores de parsing JSON de forma elegante.
 */
export function loadProgress(): ScraperProgress | null {
  if (fs.existsSync(PROGRESS_FILE)) {
    try {
      const content = fs.readFileSync(PROGRESS_FILE, 'utf-8');
      return JSON.parse(content) as ScraperProgress;
    } catch (error) {
      console.error('Error loading progress file:', error);
      return null;
    }
  }
  return null;
}

/**
 * Elimina el archivo de progreso para resetear el estado del scraping.
 * Utilizado al iniciar una sesión de scraping nueva.
 */
export function resetProgress(): void {
  if (fs.existsSync(PROGRESS_FILE)) {
    fs.unlinkSync(PROGRESS_FILE);
    console.log('Progress file reset');
  }
}
