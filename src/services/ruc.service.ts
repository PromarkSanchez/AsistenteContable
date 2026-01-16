// Servicio de consulta de RUC y DNI
// Usa APIs gratuitas y almacena en cache local (base de datos)

import prisma from '@/lib/prisma';

interface TerceroData {
  tipoDocumento: string;
  numeroDocumento: string;
  razonSocial: string;
  nombreComercial?: string | null;
  direccion?: string | null;
  ubigeo?: string | null;
  departamento?: string | null;
  provincia?: string | null;
  distrito?: string | null;
  estado?: string | null;
  condicion?: string | null;
  esAgenteRetencion?: boolean;
  esBuenContribuyente?: boolean;
  fuente: string;
}

// Consulta la API gratuita de apis.net.pe (v1 - sin autenticación)
async function consultarApisNetPe(tipoDoc: string, numero: string): Promise<TerceroData | null> {
  try {
    // IMPORTANTE: Usar v1, no v2 (v2 requiere token)
    const url = tipoDoc === '6'
      ? `https://api.apis.net.pe/v1/ruc?numero=${numero}`
      : `https://api.apis.net.pe/v1/dni?numero=${numero}`;

    console.log(`[RUC Service] Consultando apis.net.pe v1: ${url}`);

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(5000), // 5 segundos timeout
    });

    console.log(`[RUC Service] apis.net.pe response status: ${response.status}`);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    console.log(`[RUC Service] apis.net.pe data:`, data);

    // Validar que la respuesta tenga datos (v1 devuelve numeroDocumento)
    if (!data.numeroDocumento) {
      console.log('[RUC Service] apis.net.pe: respuesta sin numeroDocumento');
      return null;
    }

    if (tipoDoc === '6') {
      // RUC - v1 usa "nombre" en lugar de "razonSocial"
      return {
        tipoDocumento: '6',
        numeroDocumento: numero,
        razonSocial: data.nombre || data.razonSocial || '',
        nombreComercial: data.nombreComercial || null,
        direccion: data.direccion || null,
        ubigeo: data.ubigeo || null,
        departamento: data.departamento || null,
        provincia: data.provincia || null,
        distrito: data.distrito || null,
        estado: data.estado || null,
        condicion: data.condicion || null,
        esAgenteRetencion: data.esAgenteRetencion || false,
        esBuenContribuyente: data.esBuenContribuyente || false,
        fuente: 'apis.net.pe',
      };
    } else {
      // DNI
      const nombreCompleto = `${data.nombres || ''} ${data.apellidoPaterno || ''} ${data.apellidoMaterno || ''}`.trim();
      return {
        tipoDocumento: '1',
        numeroDocumento: numero,
        razonSocial: nombreCompleto,
        nombreComercial: null,
        direccion: null,
        fuente: 'apis.net.pe',
      };
    }
  } catch (error) {
    console.error('[RUC Service] Error consultando apis.net.pe:', error);
    return null;
  }
}

// Consulta la API gratuita de dniruc.apisperu.com
async function consultarApisPeru(tipoDoc: string, numero: string): Promise<TerceroData | null> {
  try {
    if (tipoDoc !== '6') {
      return null; // Solo soporta RUC
    }

    const url = `https://dniruc.apisperu.com/api/v1/ruc/${numero}?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6ImRlbW9AZ21haWwuY29tIn0.Zh57o-GZkWJHJ9g8J8oE-0YeRx7f0Hqx_7LQ0f8T0qw`;

    console.log(`[RUC Service] Consultando apisperu.com: ${numero}`);

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(5000),
    });

    console.log(`[RUC Service] apisperu.com response status: ${response.status}`);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    console.log(`[RUC Service] apisperu.com data:`, data);

    if (!data.ruc) {
      return null;
    }

    return {
      tipoDocumento: '6',
      numeroDocumento: numero,
      razonSocial: data.razonSocial || '',
      nombreComercial: data.nombreComercial || null,
      direccion: data.direccion || null,
      ubigeo: data.ubigeo || null,
      departamento: data.departamento || null,
      provincia: data.provincia || null,
      distrito: data.distrito || null,
      estado: data.estado || null,
      condicion: data.condicion || null,
      esAgenteRetencion: false,
      esBuenContribuyente: false,
      fuente: 'apisperu.com',
    };
  } catch (error) {
    console.error('[RUC Service] Error consultando apisperu.com:', error);
    return null;
  }
}

// Consulta la API gratuita de migo.pe (backup)
async function consultarMigoPe(tipoDoc: string, numero: string): Promise<TerceroData | null> {
  try {
    if (tipoDoc !== '6') {
      // migo.pe solo soporta RUC
      return null;
    }

    // Formato correcto: /ruc/{numero} (sin query params)
    const url = `https://api.migo.pe/api/v1/ruc/${numero}`;
    console.log(`[RUC Service] Consultando migo.pe: ${url}`);

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(5000),
    });

    console.log(`[RUC Service] migo.pe response status: ${response.status}`);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    console.log(`[RUC Service] migo.pe data:`, data);

    // migo.pe devuelve { success: true, data: {...} }
    if (!data.success || !data.data) {
      return null;
    }

    const d = data.data;
    return {
      tipoDocumento: '6',
      numeroDocumento: numero,
      razonSocial: d.nombre_o_razon_social || '',
      nombreComercial: d.nombre_comercial || null,
      direccion: d.direccion_completa || d.direccion || null,
      ubigeo: d.ubigeo || null,
      departamento: d.departamento || null,
      provincia: d.provincia || null,
      distrito: d.distrito || null,
      estado: d.estado || null,
      condicion: d.condicion || null,
      esAgenteRetencion: false,
      esBuenContribuyente: false,
      fuente: 'migo.pe',
    };
  } catch (error) {
    console.error('[RUC Service] Error consultando migo.pe:', error);
    return null;
  }
}

// Servicio principal de consulta RUC/DNI
export const rucService = {
  // Consulta RUC con cache
  async consultarRUC(ruc: string): Promise<TerceroData | null> {
    if (!ruc || ruc.length !== 11) {
      return null;
    }

    // Buscar en cache primero
    const cached = await prisma.tercero.findUnique({
      where: { numeroDocumento: ruc },
    });

    if (cached) {
      // Verificar si el cache tiene menos de 30 días
      const cacheAge = Date.now() - cached.updatedAt.getTime();
      const maxCacheAge = 30 * 24 * 60 * 60 * 1000; // 30 días

      if (cacheAge < maxCacheAge) {
        return {
          tipoDocumento: cached.tipoDocumento,
          numeroDocumento: cached.numeroDocumento,
          razonSocial: cached.razonSocial,
          nombreComercial: cached.nombreComercial,
          direccion: cached.direccion,
          ubigeo: cached.ubigeo,
          departamento: cached.departamento,
          provincia: cached.provincia,
          distrito: cached.distrito,
          estado: cached.estado,
          condicion: cached.condicion,
          esAgenteRetencion: cached.esAgenteRetencion,
          esBuenContribuyente: cached.esBuenContribuyente,
          fuente: 'cache',
        };
      }
    }

    // Consultar APIs externas (intentar múltiples fuentes)
    console.log(`[RUC Service] Consultando RUC: ${ruc}`);
    let data = await consultarApisNetPe('6', ruc);
    if (!data) {
      console.log('[RUC Service] apis.net.pe falló, intentando apisperu.com...');
      data = await consultarApisPeru('6', ruc);
    }
    if (!data) {
      console.log('[RUC Service] apisperu.com falló, intentando migo.pe...');
      data = await consultarMigoPe('6', ruc);
    }
    console.log(`[RUC Service] Resultado final:`, data ? 'encontrado' : 'no encontrado');

    if (data) {
      // Guardar en cache
      await prisma.tercero.upsert({
        where: { numeroDocumento: ruc },
        create: {
          tipoDocumento: data.tipoDocumento,
          numeroDocumento: data.numeroDocumento,
          razonSocial: data.razonSocial,
          nombreComercial: data.nombreComercial || null,
          direccion: data.direccion || null,
          ubigeo: data.ubigeo || null,
          departamento: data.departamento || null,
          provincia: data.provincia || null,
          distrito: data.distrito || null,
          estado: data.estado || null,
          condicion: data.condicion || null,
          esAgenteRetencion: data.esAgenteRetencion || false,
          esBuenContribuyente: data.esBuenContribuyente || false,
          fuente: data.fuente,
        },
        update: {
          razonSocial: data.razonSocial,
          nombreComercial: data.nombreComercial || null,
          direccion: data.direccion || null,
          ubigeo: data.ubigeo || null,
          departamento: data.departamento || null,
          provincia: data.provincia || null,
          distrito: data.distrito || null,
          estado: data.estado || null,
          condicion: data.condicion || null,
          esAgenteRetencion: data.esAgenteRetencion || false,
          esBuenContribuyente: data.esBuenContribuyente || false,
          fuente: data.fuente,
        },
      });
    }

    return data;
  },

  // Consulta DNI con cache
  async consultarDNI(dni: string): Promise<TerceroData | null> {
    if (!dni || dni.length !== 8) {
      return null;
    }

    // Buscar en cache primero
    const cached = await prisma.tercero.findUnique({
      where: { numeroDocumento: dni },
    });

    if (cached) {
      const cacheAge = Date.now() - cached.updatedAt.getTime();
      const maxCacheAge = 30 * 24 * 60 * 60 * 1000; // 30 días

      if (cacheAge < maxCacheAge) {
        return {
          tipoDocumento: cached.tipoDocumento,
          numeroDocumento: cached.numeroDocumento,
          razonSocial: cached.razonSocial,
          nombreComercial: cached.nombreComercial,
          direccion: cached.direccion,
          ubigeo: cached.ubigeo,
          fuente: 'cache',
        };
      }
    }

    // Consultar API externa
    const data = await consultarApisNetPe('1', dni);

    if (data) {
      // Guardar en cache
      await prisma.tercero.upsert({
        where: { numeroDocumento: dni },
        create: {
          tipoDocumento: '1',
          numeroDocumento: dni,
          razonSocial: data.razonSocial,
          fuente: data.fuente,
        },
        update: {
          razonSocial: data.razonSocial,
          fuente: data.fuente,
        },
      });
    }

    return data;
  },

  // Consulta genérica por tipo de documento
  async consultar(tipoDoc: string, numero: string): Promise<TerceroData | null> {
    if (tipoDoc === '6') {
      return this.consultarRUC(numero);
    } else if (tipoDoc === '1') {
      return this.consultarDNI(numero);
    }
    return null;
  },
};

export default rucService;
