/**
 * Módulo de extracción de datos.
 * Parsea contenido HTML usando Cheerio para extraer registros de jurisprudencia.
 */

import * as cheerio from 'cheerio';
import type { JurisprudenciaData } from './types.js';
import { debug } from './utils.js';

/**
 * Extrae datos de jurisprudencia del contenido HTML.
 *
 * Estrategia de parsing:
 * - Usa 'div.rf-p' como selector de contenedor principal para cada registro
 * - Filtra elementos que no son datos (ej., contenedores "sample" para botones de exportación)
 * - Extrae metadatos de estructuras div.row anidadas
 * - Extrae UUID de atributos onclick en etiquetas anchor
 * - Extrae enlaces de descarga de atributos href de ServletDescarga
 *
 * Devuelve un array de objetos JurisprudenciaData.
 */
export function extractData(html: string): JurisprudenciaData[] {
  const $ = cheerio.load(html);
  const results: JurisprudenciaData[] = [];

  const divsRF = $('div.rf-p').length;
  const tables = $('table[style*="text-align:left"]').length;
  debug('Found rf-p divs:', divsRF);
  debug('Found tables:', tables);

  // Iterar a través de cada contenedor rf-p (componente panel de RichFaces)
  $('div.rf-p').each((index, container) => {
    const $container = $(container);

    // Omitir contenedores que no son datos (ej., contenedores de botones de exportación)
    const containerId = $container.attr('id') || '';
    if (containerId.includes('sample')) {
      return;
    }

    // Encontrar el contenedor body (rf-p-b) o usar el contenedor directamente
    const $body = $container.find('div.rf-p-b');
    if ($body.length === 0) {
      if ($container.find('.row').length === 0) {
        return;
      }
    }

    // Encontrar tabla que contiene tipo y número de expediente en el encabezado
    let $table = $container.find('div.rf-p-hdr table[style*="text-align:left"]');
    if ($table.length === 0) {
      $table = $container.find('table[style*="text-align:left"]');
    }
    if ($table.length === 0) return;

    // Extraer tipo y número de expediente de spans en negrita en la tabla
    const $spans = $table.find('span[style*="font-weight:bold"]');
    if ($spans.length < 2) {
      return;
    }

    const type = $spans.first().text().trim();
    const caseNumber = $spans.last().text().trim();

    if (!type || !caseNumber) return;

    // Extraer metadatos de la estructura de filas de Bootstrap
    const $rows = $body.length > 0 ? $body.find('.row') : $container.find('.row');

    // Primera fila: pretensión/delito, tipo de resolución, fecha de resolución
    const claimCrime = $rows.eq(0).find('.col-sm-4').eq(0).find('.col-md-12').last().text().trim();
    const resolutionType = $rows.eq(0).find('.col-sm-4').eq(1).find('.col-md-12').last().text().trim();
    const resolutionDate = $rows.eq(0).find('.col-sm-4').eq(2).find('.col-md-12').last().text().trim();

    // Segunda fila: sala suprema, norma de derecho interno
    const supremeChamber = $rows.eq(1).find('.col-sm-4').eq(0).find('.col-md-12').last().text().trim();
    const internalLawNorm = $rows.eq(1).find('.col-sm-8').find('.col-md-12').last().text().trim();

    // Tercera fila: sumilla
    const summary = $rows.eq(2).find('.col-sm-12').find('.col-md-12').last().text().trim();

    // Cuarta fila: palabras clave
    const keywords = $rows.eq(3).find('.col-sm-12').find('.col-md-12').last().text().trim();

    // Extraer UUID del atributo onclick en el enlace "Ver"
    const $searchArea = $body.length > 0 ? $body : $container;
    const $linkVer = $searchArea.find('a[onclick*="uuid"]');
    let uuid: string | undefined;
    if ($linkVer.length > 0) {
      const onclickAttr = $linkVer.attr('onclick') || '';
      const uuidMatch = onclickAttr.match(/uuid["']:\s*["']([^"']+)/);
      uuid = uuidMatch ? uuidMatch[1] : undefined;
    }

    // Extraer enlace de descarga del href de ServletDescarga
    const $linkDescarga = $searchArea.find('a[href*="ServletDescarga"]');
    const downloadLink = $linkDescarga.length > 0 && $linkDescarga.attr('href')
      ? `https://jurisprudencia.pj.gob.pe${$linkDescarga.attr('href')}`
      : undefined;

    const record = {
      type,
      caseNumber,
      claimCrime,
      resolutionType,
      resolutionDate,
      supremeChamber,
      internalLawNorm,
      summary,
      keywords,
      uuid,
      downloadLink
    };

    debug('Extracted record:', {
      type,
      caseNumber,
      uuid,
      downloadLink: downloadLink ? 'present' : 'absent'
    });

    results.push(record);
  });

  return results;
}
