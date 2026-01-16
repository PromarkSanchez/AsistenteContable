import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { parseQRSunat } from '@/services/qr-parser.service';
import { getCurrentPeriodo } from '@/lib/utils';
import { rucService } from '@/services/ruc.service';

// POST /api/qr/import - Importar comprobante desde QR
export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { qrData, companyId, tipoOperacion } = body;

    if (!qrData || !companyId) {
      return NextResponse.json(
        { error: 'Datos del QR y companyId requeridos' },
        { status: 400 }
      );
    }

    if (!['VENTA', 'COMPRA'].includes(tipoOperacion)) {
      return NextResponse.json(
        { error: 'tipoOperacion debe ser VENTA o COMPRA' },
        { status: 400 }
      );
    }

    // Verificar empresa
    const company = await prisma.company.findFirst({
      where: { id: companyId, userId },
    });

    if (!company) {
      return NextResponse.json(
        { error: 'Empresa no encontrada' },
        { status: 404 }
      );
    }

    // Parsear QR
    const parsed = parseQRSunat(qrData);

    if (!parsed) {
      return NextResponse.json(
        { error: 'No se pudo interpretar el código QR' },
        { status: 400 }
      );
    }

    // Calcular período desde la fecha
    const fechaEmision = new Date(parsed.fechaISO);
    const periodo = `${fechaEmision.getFullYear()}${String(fechaEmision.getMonth() + 1).padStart(2, '0')}`;

    // Verificar duplicado
    const existing = await prisma.comprobante.findUnique({
      where: {
        companyId_tipoDocumento_serie_numero: {
          companyId,
          tipoDocumento: parsed.tipoDocumento,
          serie: parsed.serie,
          numero: parsed.numero,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Este comprobante ya existe', existing },
        { status: 400 }
      );
    }

    // Determinar RUC del tercero según tipo de operación
    const rucTercero = tipoOperacion === 'VENTA' ? parsed.numDocCliente : parsed.ruc;

    // Buscar razón social del tercero
    let razonSocialTercero: string | null = null;
    if (rucTercero && rucTercero.length === 11) {
      try {
        const terceroData = await rucService.consultarRUC(rucTercero);
        if (terceroData) {
          razonSocialTercero = terceroData.razonSocial;
        }
      } catch (e) {
        console.error('Error consultando RUC del tercero:', e);
        // Continuar sin razón social
      }
    }

    // Crear comprobante
    const comprobante = await prisma.comprobante.create({
      data: {
        companyId,
        tipo: tipoOperacion,
        tipoDocumento: parsed.tipoDocumento,
        serie: parsed.serie,
        numero: parsed.numero,
        fechaEmision: fechaEmision,
        tipoDocTercero: parsed.tipoDocCliente || '6',
        rucTercero,
        razonSocialTercero,
        baseImponible: parsed.baseImponible,
        igv: parsed.igv,
        total: parsed.total,
        esGravada: parsed.igv > 0,
        afectaIgv: parsed.igv > 0,
        periodo,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Comprobante importado correctamente',
      comprobante: {
        ...comprobante,
        baseImponible: Number(comprobante.baseImponible),
        igv: Number(comprobante.igv),
        total: Number(comprobante.total),
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Error importando QR:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
