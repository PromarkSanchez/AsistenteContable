import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET /api/user/plan-config - Obtener configuración del plan del usuario actual
export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Obtener usuario con su plan
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true, isSuperadmin: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    // Obtener configuración del plan
    const planConfig = await prisma.planConfig.findUnique({
      where: { plan: user.plan },
      include: {
        menuItems: {
          where: { isEnabled: true, isVisible: true },
          orderBy: { orden: 'asc' },
        },
      },
    });

    if (!planConfig) {
      // Plan por defecto si no existe configuración
      return NextResponse.json({
        plan: user.plan,
        isSuperadmin: user.isSuperadmin,
        config: {
          maxEmpresas: 1,
          maxComprobantes: 50,
          iaEnabled: false,
          facturacionEnabled: false,
          reportesAvanzados: false,
          librosElectronicos: false,
          alertasEnabled: false,
        },
        menus: [
          { key: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard', path: '/dashboard' },
          { key: 'comprobantes', label: 'Comprobantes', icon: 'FileText', path: '/comprobantes' },
          { key: 'configuracion', label: 'Configuración', icon: 'Settings', path: '/configuracion' },
        ],
      });
    }

    return NextResponse.json({
      plan: user.plan,
      isSuperadmin: user.isSuperadmin,
      config: {
        nombre: planConfig.nombre,
        maxEmpresas: planConfig.maxEmpresas,
        maxComprobantes: planConfig.maxComprobantes,
        maxStorage: planConfig.maxStorage.toString(),
        maxUsuarios: planConfig.maxUsuarios,
        iaEnabled: planConfig.iaEnabled,
        iaMaxConsultas: planConfig.iaMaxConsultas,
        iaModelo: planConfig.iaModelo,
        facturacionEnabled: planConfig.facturacionEnabled,
        reportesAvanzados: planConfig.reportesAvanzados,
        librosElectronicos: planConfig.librosElectronicos,
        alertasEnabled: planConfig.alertasEnabled,
        apiAccess: planConfig.apiAccess,
        soportePrioritario: planConfig.soportePrioritario,
      },
      menus: planConfig.menuItems.map(menu => ({
        key: menu.menuKey,
        label: menu.label,
        icon: menu.icon,
        path: menu.path,
        orden: menu.orden,
      })),
    });
  } catch (error) {
    console.error('Error obteniendo config de plan:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
