/**
 * Módulo de API del scraper.
 * Maneja las solicitudes HTTP al sitio web objetivo, incluyendo gestión de ViewState,
 * inicialización de búsqueda y paginación mediante solicitudes AJAX.
 */

import * as cheerio from 'cheerio';
import { client, URL_START, URL_RESULTS } from './config.js';
import { handle403Error, handle500Error } from './http.js';
import { debug } from './utils.js';

/**
 * Obtiene la página inicial y extrae el token javax.faces.ViewState.
 * ViewState es requerido para todas las solicitudes POST posteriores en aplicaciones JSF.
 * Devuelve el valor de ViewState como string.
 */
export async function getViewState(): Promise<string> {
  console.log('Fetching ViewState from initial page...');

  try {
    const response = await client.get(URL_START, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'es-CL,es-419;q=0.9,es;q=0.8',
        'Referer': 'https://jurisprudencia.pj.gob.pe/jurisprudenciaweb/faces/page/inicio.xhtml'
      },
      maxRedirects: 5
    });

    const $ = cheerio.load(response.data);
    const viewState = $('#javax\\.faces\\.ViewState').val() as string;

    if (!viewState) {
      throw new Error('Could not find ViewState on page');
    }

    console.log('ViewState obtained:', viewState);
    debug('Full ViewState:', viewState);
    debug('Response headers:', response.headers);
    return viewState;
  } catch (error) {
    handle403Error(error, 'fetching ViewState from initial page');
    throw error;
  }
}

/**
 * Inicializa el proceso de búsqueda y obtiene la primera página de resultados.
 *
 * Proceso:
 * 1. Envía solicitud POST a inicio.xhtml con parámetros de búsqueda
 * 2. Sigue la redirección a resultado.xhtml
 * 3. Extrae nuevo ViewState de la página de resultados
 * 4. Extrae maxPages de la configuración JavaScript de spinner2
 * 5. Envía segundo POST a resultado.xhtml para obtener HTML de la primera página
 *
 * Devuelve el HTML de la primera página, ViewState actualizado y el total de páginas.
 */
export async function initializeSearch(viewState: string): Promise<{ firstPageHtml: string; viewState: string; maxPages: number }> {
  console.log('Initializing search...');

  // Primer POST: Inicializar búsqueda y redirigir a página de resultados
  const formData1 = new URLSearchParams({
    'formBuscador': 'formBuscador',
    'javax.faces.ViewState': viewState,
    'formBuscador:tabpanel-value': 'general',
    'formBuscador:txtBusqueda': 'Ingrese el texto a buscar',
    'formBuscador:buCorte': '1',
    'formBuscador:buDistrito': '0',
    'formBuscador:buEspecialidad': '0',
    'formBuscador:buSala': '0',
    'formBuscador:buPretensionDelitoSupValue': '',
    'formBuscador:buPretensionDelitoSupInput': '',
    'formBuscador:buPretensionValue': '',
    'formBuscador:buPretensionInput': '',
    'formBuscador:buPalabraClaveValue': '',
    'formBuscador:buPalabraClaveInput': '',
    'formBuscador:buNroExpediente': 'Ingrese Nro de Expediente XXXXXX',
    'formBuscador:buAnio': '',
    'formBuscador:j_idt31': 'formBuscador:j_idt31',
    'forward': 'buscar',
    'busqueda': 'especializada',
    'formBuscador:j_idt34': '21',
    'formBuscador:j_idt35': 'DESC',
    'formBuscador:j_idt36': 'Principal',
    'formBuscador:j_idt37': '1'
  });

  const response1 = await handle500Error(
    async () => {
      try {
        return await client.post(URL_START, formData1.toString(), {
          headers: {
            'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'accept-language': 'es-CL,es-419;q=0.9,es;q=0.8',
            'cache-control': 'no-cache',
            'content-type': 'application/x-www-form-urlencoded',
            'origin': 'https://jurisprudencia.pj.gob.pe',
            'pragma': 'no-cache',
            'referer': 'https://jurisprudencia.pj.gob.pe/jurisprudenciaweb/faces/page/inicio.xhtml',
            'sec-fetch-dest': 'document',
            'sec-fetch-mode': 'navigate',
            'sec-fetch-site': 'same-origin',
            'sec-fetch-user': '?1',
            'upgrade-insecure-requests': '1',
            'user-agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36'
          },
          maxRedirects: 10,
          validateStatus: (status) => status >= 200 && status < 400
        });
      } catch (error) {
        handle403Error(error, 'initial POST to inicio.xhtml');
        throw error;
      }
    },
    'initial POST to inicio.xhtml'
  );

  // Extraer ViewState de la página de resultados
  const $result = cheerio.load(response1.data);
  const resultViewState = $result('#javax\\.faces\\.ViewState').val() as string;

  if (!resultViewState) {
    throw new Error('Could not find ViewState on results page');
  }

  // Extraer maxPages de la configuración JavaScript del spinner de RichFaces
  // El elemento spinner2 contiene una etiqueta script con la propiedad maxValue
  const $spinner2 = $result('#formBuscador\\:spinner2');
  const scriptText = $spinner2.find('script').text() || $spinner2.next('script').text();
  const maxValueMatch = scriptText.match(/maxValue:\s*(\d+)/);
  const maxPages = maxValueMatch ? parseInt(maxValueMatch[1], 10) : 1;

  console.log('Results page ViewState obtained:', resultViewState);
  console.log('Maximum number of pages:', maxPages);
  debug('Full results ViewState:', resultViewState);
  debug('Spinner2 script found:', scriptText.substring(0, 200));

  // Segundo POST: Obtener primera página de resultados
  console.log('Fetching first page with results...');
  const formData2 = new URLSearchParams({
    'formBuscador': 'formBuscador',
    'javax.faces.ViewState': resultViewState,
    'formBuscador:txtBusqueda': '',
    'formBuscador:buCorte': '1',
    'formBuscador:buDistrito': '0',
    'formBuscador:buEspecialidad': '0',
    'formBuscador:buPretensionValue': '',
    'formBuscador:buPretensionInput': '',
    'formBuscador:buPalabraClaveValue': '',
    'formBuscador:buPalabraClaveInput': '',
    'formBuscador:buNroExpediente': '',
    'formBuscador:buSala': '0',
    'formBuscador:buPretensionDelitoSupValue': '',
    'formBuscador:buPretensionDelitoSupInput': '',
    'formBuscador:buTipoRecurso': '0',
    'formBuscador:buTipoResolucion': '0',
    'formBuscador:buTipoResolucionInput': '-- Todos --',
    'formBuscador:buAnio': '',
    'formBuscador:buOrden': '21',
    'formBuscador:buOrdenForma': 'DESC',
    'formBuscador:j_idt434': 'on',
    'formBuscador:spinner': '1',
    'formBuscador:j_idt540': 'on',
    'formBuscador:spinner2': '1',
    'formBuscador:j_idt49': 'formBuscador:j_idt49',
    'formBuscador:j_idt50': '21',
    'formBuscador:j_idt51': 'DESC',
    'formBuscador:j_idt52': 'Principal'
  });

  const response2 = await handle500Error(
    async () => {
      try {
        return await client.post(URL_RESULTS, formData2.toString(), {
          headers: {
            'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'accept-language': 'es-CL,es;q=0.9',
            'cache-control': 'no-cache',
            'content-type': 'application/x-www-form-urlencoded',
            'origin': 'https://jurisprudencia.pj.gob.pe',
            'pragma': 'no-cache',
            'referer': 'https://jurisprudencia.pj.gob.pe/jurisprudenciaweb/faces/page/resultado.xhtml',
            'sec-fetch-dest': 'document',
            'sec-fetch-mode': 'navigate',
            'sec-fetch-site': 'same-origin',
            'sec-fetch-user': '?1',
            'upgrade-insecure-requests': '1',
            'user-agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36'
          },
          maxRedirects: 10,
          validateStatus: (status) => status >= 200 && status < 400
        });
      } catch (error) {
        handle403Error(error, 'POST to resultado.xhtml (first page)');
        throw error;
      }
    },
    'POST to resultado.xhtml (first page)'
  );

  const $firstPage = cheerio.load(response2.data);
  const newViewState = $firstPage('#javax\\.faces\\.ViewState').val() as string || resultViewState;

  return {
    firstPageHtml: response2.data,
    viewState: newViewState,
    maxPages
  };
}

/**
 * Obtiene una página completa de resultados mediante solicitud POST AJAX.
 *
 * Para página 1: Usa POST de formulario estándar con navegación de página completa.
 * Para página > 1: Usa solicitud parcial AJAX con parámetros específicos de RichFaces.
 *
 * Actualiza y devuelve el ViewState para solicitudes posteriores.
 * Devuelve el contenido HTML y el ViewState actualizado.
 */
export async function getPageComplete(viewState: string, page: number, maxPages: number): Promise<{ html: string; viewState: string }> {
  console.log(`\n[Page ${page}/${maxPages}] Fetching HTML...`);

  // Página 1 usa POST de formulario estándar
  if (page === 1) {
    const formData = new URLSearchParams({
      'formBuscador': 'formBuscador',
      'javax.faces.ViewState': viewState,
      'formBuscador:txtBusqueda': '',
      'formBuscador:buCorte': '1',
      'formBuscador:buDistrito': '0',
      'formBuscador:buEspecialidad': '0',
      'formBuscador:buPretensionValue': '',
      'formBuscador:buPretensionInput': '',
      'formBuscador:buPalabraClaveValue': '',
      'formBuscador:buPalabraClaveInput': '',
      'formBuscador:buNroExpediente': '',
      'formBuscador:buSala': '0',
      'formBuscador:buPretensionDelitoSupValue': '',
      'formBuscador:buPretensionDelitoSupInput': '',
      'formBuscador:buTipoRecurso': '0',
      'formBuscador:buTipoResolucion': '0',
      'formBuscador:buTipoResolucionInput': '-- Todos --',
      'formBuscador:buAnio': '',
      'formBuscador:buOrden': '21',
      'formBuscador:buOrdenForma': 'DESC',
      'formBuscador:j_idt434': 'on',
      'formBuscador:spinner': '1',
      'formBuscador:j_idt540': 'on',
      'formBuscador:spinner2': '1',
      'formBuscador:j_idt49': 'formBuscador:j_idt49',
      'formBuscador:j_idt50': '21',
      'formBuscador:j_idt51': 'DESC',
      'formBuscador:j_idt52': 'Principal'
    });

    const response = await handle500Error(
      async () => {
        try {
          return await client.post(URL_RESULTS, formData.toString(), {
            headers: {
              'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
              'accept-language': 'es-CL,es;q=0.9',
              'cache-control': 'no-cache',
              'content-type': 'application/x-www-form-urlencoded',
              'origin': 'https://jurisprudencia.pj.gob.pe',
              'pragma': 'no-cache',
              'referer': 'https://jurisprudencia.pj.gob.pe/jurisprudenciaweb/faces/page/resultado.xhtml',
              'sec-fetch-dest': 'document',
              'sec-fetch-mode': 'navigate',
              'sec-fetch-site': 'same-origin',
              'sec-fetch-user': '?1',
              'upgrade-insecure-requests': '1',
              'user-agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36'
            },
            maxRedirects: 10,
            validateStatus: (status) => status >= 200 && status < 400
          });
        } catch (error) {
          handle403Error(error, `fetching page ${page}`);
          throw error;
        }
      },
      `fetching page ${page}`
    );

    const $html = cheerio.load(response.data);
    const newViewState = $html('#javax\\.faces\\.ViewState').val() as string || viewState;

    return {
      html: response.data,
      viewState: newViewState
    };
  } else {
    // Páginas > 1 usan solicitudes parciales AJAX con parámetros de RichFaces
    // Estas solicitudes devuelven XML con fragmentos HTML incrustados
    const formDataParams = new URLSearchParams();
    formDataParams.append('formBuscador', 'formBuscador');
    formDataParams.append('javax.faces.ViewState', viewState);
    formDataParams.append('formBuscador:txtBusqueda', '');
    formDataParams.append('formBuscador:buCorte', '1');
    formDataParams.append('formBuscador:buDistrito', '0');
    formDataParams.append('formBuscador:buEspecialidad', '0');
    formDataParams.append('formBuscador:buPretensionValue', '');
    formDataParams.append('formBuscador:buPretensionInput', '');
    formDataParams.append('formBuscador:buPalabraClaveValue', '');
    formDataParams.append('formBuscador:buPalabraClaveInput', '');
    formDataParams.append('formBuscador:buNroExpediente', '');
    formDataParams.append('formBuscador:buSala', '0');
    formDataParams.append('formBuscador:buPretensionDelitoSupValue', '');
    formDataParams.append('formBuscador:buPretensionDelitoSupInput', '');
    formDataParams.append('formBuscador:buTipoRecurso', '0');
    formDataParams.append('formBuscador:buTipoResolucion', '0');
    formDataParams.append('formBuscador:buTipoResolucionInput', '-- Todos --');
    formDataParams.append('formBuscador:buAnio', '');
    formDataParams.append('formBuscador:buOrden', '21');
    formDataParams.append('formBuscador:buOrdenForma', 'DESC');
    formDataParams.append('formBuscador:j_idt434', 'on');
    // Set page number in spinner controls
    formDataParams.append('formBuscador:spinner', page.toString());
    formDataParams.append('formBuscador:j_idt540', 'on');
    formDataParams.append('formBuscador:spinner2', page.toString());
    // Parámetros AJAX de RichFaces para actualización parcial de página
    formDataParams.append('javax.faces.source', 'formBuscador:data2');
    formDataParams.append('javax.faces.partial.event', 'rich:datascroller:onscroll');
    formDataParams.append('javax.faces.partial.execute', 'formBuscador:data2 @component');
    formDataParams.append('javax.faces.partial.render', '@component');
    formDataParams.append(`formBuscador:data2:page`, page.toString());
    formDataParams.append('org.richfaces.ajax.component', 'formBuscador:data2');
    formDataParams.append('formBuscador:data2', 'formBuscador:data2');
    formDataParams.append('AJAX:EVENTS_COUNT', '1');
    formDataParams.append('javax.faces.partial.ajax', 'true');

    const response = await handle500Error(
      async () => {
        try {
          return await client.post(URL_RESULTS, formDataParams.toString(), {
            headers: {
              'accept': '*/*',
              'accept-language': 'es-CL,es;q=0.9',
              'cache-control': 'no-cache',
              'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
              'faces-request': 'partial/ajax',
              'origin': 'https://jurisprudencia.pj.gob.pe',
              'pragma': 'no-cache',
              'referer': 'https://jurisprudencia.pj.gob.pe/jurisprudenciaweb/faces/page/resultado.xhtml',
              'sec-fetch-dest': 'empty',
              'sec-fetch-mode': 'cors',
              'sec-fetch-site': 'same-origin',
              'user-agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36'
            },
            maxRedirects: 10,
            validateStatus: (status) => status >= 200 && status < 400
          });
        } catch (error) {
          handle403Error(error, `fetching page ${page}`);
          throw error;
        }
      },
      `fetching page ${page}`
    );

    let htmlContent = response.data;

    const $html = cheerio.load(htmlContent);
    const newViewState = $html('#javax\\.faces\\.ViewState').val() as string || viewState;

    debug(`[Page ${page}] ViewState updated:`, newViewState);
    debug(`[Page ${page}] HTML size received:`, htmlContent.length, 'characters');
    debug(`[Page ${page}] First 500 characters of HTML:`, htmlContent.substring(0, 500));

    return {
      html: htmlContent,
      viewState: newViewState
    };
  }
}
