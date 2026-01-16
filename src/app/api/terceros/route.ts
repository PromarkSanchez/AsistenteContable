import { NextRequest, NextResponse } from 'next/server';
import { rucService } from '@/services/ruc.service';
import prisma from '@/lib/prisma';
import { terceroSchema } from '@/lib/validations';
import { ZodError } from 'zod';

// GET /api/terceros?tipo=6&numero=20123456789 - Consultar RUC/DNI
export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const tipo = searchParams.get('tipo') || '6';
    const numero = searchParams.get('numero');

    if (!numero) {
      return NextResponse.json(
        { error: 'Número de documento requerido' },
        { status: 400 }
      );
    }

    // Validar formato
    if (tipo === '6' && numero.length !== 11) {
      return NextResponse.json(
        { error: 'El RUC debe tener 11 dígitos' },
        { status: 400 }
      );
    }

    if (tipo === '1' && numero.length !== 8) {
      return NextResponse.json(
        { error: 'El DNI debe tener 8 dígitos' },
        { status: 400 }
      );
    }

    const data = await rucService.consultar(tipo, numero);

    if (!data) {
      return NextResponse.json(
        {
          success: false,
          error: 'No se encontró información para el documento ingresado',
          source: 'none',
          data: null,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      source: data.fuente,
      data: {
        tipoDocumento: data.tipoDocumento,
        numeroDocumento: data.numeroDocumento,
        razonSocial: data.razonSocial,
        nombreComercial: data.nombreComercial,
        direccion: data.direccion,
        ubigeo: data.ubigeo,
        departamento: data.departamento,
        provincia: data.provincia,
        distrito: data.distrito,
        estado: data.estado,
        condicion: data.condicion,
        esAgenteRetencion: data.esAgenteRetencion,
        esBuenContribuyente: data.esBuenContribuyente,
      },
    });
  } catch (error) {
    console.error('Error al consultar tercero:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// POST /api/terceros - Crear tercero manualmente
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
    const validatedData = terceroSchema.parse(body);

    // Verificar si ya existe
    const existing = await prisma.tercero.findUnique({
      where: { numeroDocumento: validatedData.numeroDocumento },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Ya existe un tercero con ese número de documento' },
        { status: 400 }
      );
    }

    const tercero = await prisma.tercero.create({
      data: {
        tipoDocumento: validatedData.tipoDocumento,
        numeroDocumento: validatedData.numeroDocumento,
        razonSocial: validatedData.razonSocial,
        direccion: validatedData.direccion || null,
        fuente: 'manual',
      },
    });

    return NextResponse.json(tercero, { status: 201 });
  } catch (error) {
    console.error('Error al crear tercero:', error);

    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
