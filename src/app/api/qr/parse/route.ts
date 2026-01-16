import { NextRequest, NextResponse } from 'next/server';
import { parseQRSunat } from '@/services/qr-parser.service';

// POST /api/qr/parse - Parsear QR SUNAT
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
    const { qrData } = body;

    if (!qrData) {
      return NextResponse.json(
        { error: 'Datos del QR requeridos' },
        { status: 400 }
      );
    }

    const parsed = parseQRSunat(qrData);

    if (!parsed) {
      return NextResponse.json(
        { error: 'No se pudo interpretar el código QR. Asegúrese de que sea un QR válido de SUNAT.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: parsed,
    });
  } catch (error) {
    console.error('Error parseando QR:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
