/**
 * Módulo de gestión de archivos.
 * Maneja la creación de estructura de carpetas, nombrado de archivos, persistencia JSON y generación CSV.
 */

import * as fs from 'fs';
import * as path from 'path';
import { BASE_DIR, CSV_FILE } from './config.js';
import type { JurisprudenciaData } from './types.js';
import { removeAccents, escapeCSV } from './utils.js';
import { debug } from './utils.js';

/**
 * Crea estructura de carpetas para almacenar PDFs: BASE_DIR/Tipo/Año/Mes
 * 
 * Proceso:
 * - Normaliza el nombre del tipo eliminando acentos
 * - Extrae el año de la fecha de resolución (formato DD/MM/YYYY)
 * - Extrae el mes de la fecha de resolución
 * - Crea la estructura de directorios recursivamente
 * 
 * Devuelve la ruta completa al directorio creado.
 */
export function createFolderStructure(data: JurisprudenciaData): string {
  const type = removeAccents(data.type) || 'SinTipo';

  let year = 'SinFecha';
  if (data.resolutionDate) {
    const dateMatch = data.resolutionDate.match(/\d{4}/);
    if (dateMatch) {
      year = dateMatch[0];
    }
  }

  let month = '';
  if (data.resolutionDate) {
    const dateParts = data.resolutionDate.split('/');
    if (dateParts.length >= 2) {
      month = dateParts[1].padStart(2, '0');
    }
  }

  const folderPath = path.join(BASE_DIR, type, year, month || 'SinMes');

  debug('Folder structure:', {
    originalType: data.type,
    normalizedType: type,
    year,
    month,
    folderPath
  });

  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
    debug('Folder created:', folderPath);
  }

  return folderPath;
}

/**
 * Genera un nombre de archivo descriptivo para PDFs.
 * Formato: Tipo_NumeroExpediente_Fecha.pdf
 * Todos los componentes están normalizados (acentos eliminados, caracteres especiales reemplazados).
 */
export function generateFileName(data: JurisprudenciaData): string {
  const type = removeAccents(data.type);
  const number = removeAccents(data.caseNumber);
  const date = data.resolutionDate ? data.resolutionDate.replace(/\//g, '-') : 'SinFecha';

  return `${type}_${number}_${date}.pdf`;
}

/**
 * Guarda los datos extraídos como archivo JSON junto al PDF.
 * Crea un archivo JSON con nombres de campos en español que coinciden con la estructura de datos original.
 * Incluye timestamp de extracción.
 */
export function saveJSON(data: JurisprudenciaData, folderPath: string, baseName: string): void {
  const jsonPath = path.join(folderPath, `${baseName.replace('.pdf', '')}.json`);

  const jsonData = {
    tipo: data.type,
    numeroExpediente: data.caseNumber,
    pretensionDelito: data.claimCrime,
    tipoResolucion: data.resolutionType,
    fechaResolucion: data.resolutionDate,
    salaSuprema: data.supremeChamber,
    normaDerechoInterno: data.internalLawNorm,
    sumilla: data.summary,
    palabrasClave: data.keywords,
    uuid: data.uuid,
    linkDescarga: data.downloadLink,
    fechaExtraccion: new Date().toISOString()
  };

  fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2), 'utf-8');
  console.log(`  JSON saved: ${jsonPath}`);
}

/**
 * Genera un archivo CSV que contiene todos los registros extraídos.
 * 
 * Proceso:
 * - Crea fila de encabezado con nombres de columnas en español
 * - Escapa todos los valores según las reglas de formato CSV
 * - Escribe CSV completo en disco
 * - Incluye timestamp de extracción para cada registro
 */
export function generateCSV(data: JurisprudenciaData[]): void {
  if (data.length === 0) {
    console.log('No data to generate CSV');
    return;
  }

  const headers = [
    'Tipo',
    'Numero Expediente',
    'Pretension Delito',
    'Tipo Resolucion',
    'Fecha Resolucion',
    'Sala Suprema',
    'Norma Derecho Interno',
    'Sumilla',
    'Palabras Clave',
    'UUID',
    'Link Descarga',
    'Fecha Extraccion'
  ];

  const lines: string[] = [];
  lines.push(headers.map(escapeCSV).join(','));

  data.forEach(record => {
    const row = [
      escapeCSV(record.type),
      escapeCSV(record.caseNumber),
      escapeCSV(record.claimCrime),
      escapeCSV(record.resolutionType),
      escapeCSV(record.resolutionDate),
      escapeCSV(record.supremeChamber),
      escapeCSV(record.internalLawNorm),
      escapeCSV(record.summary),
      escapeCSV(record.keywords),
      escapeCSV(record.uuid || ''),
      escapeCSV(record.downloadLink || ''),
      escapeCSV(new Date().toISOString())
    ];
    lines.push(row.join(','));
  });

  const csvContent = lines.join('\n');
  fs.writeFileSync(CSV_FILE, csvContent, 'utf-8');
  console.log(`\nCSV generated: ${CSV_FILE} (${data.length} records)`);
}
