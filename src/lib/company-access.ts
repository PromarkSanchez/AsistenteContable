import prisma from '@/lib/prisma';
import { CompanyRole } from '@prisma/client';
import { NextResponse } from 'next/server';

export type { CompanyRole };

// Roles que pueden leer datos de la empresa
const READ_ROLES: CompanyRole[] = ['OWNER', 'ADMIN', 'ACCOUNTANT', 'VIEWER'];

// Roles que pueden crear/editar comprobantes y declaraciones
const WRITE_ROLES: CompanyRole[] = ['OWNER', 'ADMIN', 'ACCOUNTANT'];

// Roles que pueden editar configuración de empresa y credenciales
const MANAGE_ROLES: CompanyRole[] = ['OWNER', 'ADMIN'];

// Solo el owner puede eliminar la empresa
const OWNER_ROLES: CompanyRole[] = ['OWNER'];

export interface CompanyAccessResult {
  company: {
    id: string;
    userId: string;
    [key: string]: unknown;
  };
  role: CompanyRole;
}

/**
 * Verifica si un usuario tiene acceso a una empresa con los roles requeridos.
 * Retorna la empresa y el rol del usuario, o null si no tiene acceso.
 */
export async function verifyCompanyAccess(
  companyId: string,
  userId: string,
  requiredRoles: CompanyRole[] = READ_ROLES
): Promise<CompanyAccessResult | null> {
  const member = await prisma.companyMember.findUnique({
    where: {
      companyId_userId: {
        companyId,
        userId,
      },
    },
    include: {
      company: true,
    },
  });

  if (!member) return null;
  if (!requiredRoles.includes(member.role)) return null;

  return {
    company: member.company,
    role: member.role,
  };
}

/**
 * Verifica acceso de lectura (todos los roles)
 */
export async function verifyReadAccess(companyId: string, userId: string) {
  return verifyCompanyAccess(companyId, userId, READ_ROLES);
}

/**
 * Verifica acceso de escritura (OWNER, ADMIN, ACCOUNTANT)
 */
export async function verifyWriteAccess(companyId: string, userId: string) {
  return verifyCompanyAccess(companyId, userId, WRITE_ROLES);
}

/**
 * Verifica acceso de administración (OWNER, ADMIN)
 */
export async function verifyManageAccess(companyId: string, userId: string) {
  return verifyCompanyAccess(companyId, userId, MANAGE_ROLES);
}

/**
 * Verifica acceso de propietario (solo OWNER)
 */
export async function verifyOwnerAccess(companyId: string, userId: string) {
  return verifyCompanyAccess(companyId, userId, OWNER_ROLES);
}

/**
 * Helper que extrae userId del request y verifica acceso.
 * Retorna el resultado o un NextResponse de error.
 */
export async function requireCompanyAccess(
  request: Request,
  companyId: string,
  requiredRoles: CompanyRole[] = READ_ROLES
): Promise<CompanyAccessResult | NextResponse> {
  const userId = (request as any).headers.get('x-user-id');

  if (!userId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const access = await verifyCompanyAccess(companyId, userId, requiredRoles);

  if (!access) {
    return NextResponse.json({ error: 'Empresa no encontrada o sin acceso' }, { status: 404 });
  }

  return access;
}

/**
 * Type guard para verificar si el resultado es un error NextResponse
 */
export function isAccessError(result: CompanyAccessResult | NextResponse): result is NextResponse {
  return result instanceof NextResponse;
}

// Exportar constantes de roles para uso en las rutas
export { READ_ROLES, WRITE_ROLES, MANAGE_ROLES, OWNER_ROLES };
