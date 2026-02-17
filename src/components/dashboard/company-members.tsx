'use client';

import { useState, useEffect } from 'react';
import { companiesApi } from '@/lib/api-client';
import { useCompanyStore } from '@/store/company-store';
import type { CompanyMember, CompanyRole } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Users, UserPlus, Trash2, Shield, Eye, PenLine, Crown } from 'lucide-react';

const ROLE_LABELS: Record<CompanyRole, string> = {
  OWNER: 'Propietario',
  ADMIN: 'Administrador',
  ACCOUNTANT: 'Contador',
  VIEWER: 'Solo lectura',
};

const ROLE_COLORS: Record<CompanyRole, string> = {
  OWNER: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  ADMIN: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  ACCOUNTANT: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  VIEWER: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
};

const ROLE_ICONS: Record<CompanyRole, typeof Crown> = {
  OWNER: Crown,
  ADMIN: Shield,
  ACCOUNTANT: PenLine,
  VIEWER: Eye,
};

interface CompanyMembersProps {
  companyId: string;
  myRole: CompanyRole | null;
}

export default function CompanyMembers({ companyId, myRole }: CompanyMembersProps) {
  const [members, setMembers] = useState<CompanyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<CompanyRole>('VIEWER');
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const canManage = myRole === 'OWNER' || myRole === 'ADMIN';

  useEffect(() => {
    loadMembers();
  }, [companyId]);

  const loadMembers = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await companiesApi.listMembers(companyId);
      setMembers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar miembros');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;

    try {
      setAddLoading(true);
      setAddError(null);
      await companiesApi.addMember(companyId, {
        email: newEmail.trim().toLowerCase(),
        role: newRole,
      });
      setNewEmail('');
      setNewRole('VIEWER');
      setShowAddForm(false);
      await loadMembers();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Error al agregar miembro');
    } finally {
      setAddLoading(false);
    }
  };

  const handleChangeRole = async (memberId: string, role: CompanyRole) => {
    try {
      await companiesApi.updateMemberRole(companyId, memberId, role);
      await loadMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cambiar rol');
    }
  };

  const handleRemoveMember = async (memberId: string, memberEmail: string) => {
    if (!confirm(`¿Estás seguro de eliminar el acceso de ${memberEmail}?`)) return;

    try {
      await companiesApi.removeMember(companyId, memberId);
      await loadMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar miembro');
    }
  };

  if (loading) {
    return (
      <div className="p-4 text-center text-gray-500 dark:text-gray-400">
        Cargando miembros...
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Miembros ({members.length})
          </h3>
        </div>
        {canManage && (
          <Button
            size="sm"
            onClick={() => setShowAddForm(!showAddForm)}
            variant={showAddForm ? 'outline' : 'primary'}
          >
            <UserPlus className="w-4 h-4 mr-1" />
            {showAddForm ? 'Cancelar' : 'Agregar'}
          </Button>
        )}
      </div>

      {error && (
        <div className="mx-4 mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Formulario para agregar miembro */}
      {showAddForm && canManage && (
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <form onSubmit={handleAddMember} className="space-y-3">
            {addError && (
              <div className="p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-300 text-sm">
                {addError}
              </div>
            )}
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  type="email"
                  placeholder="Email del usuario"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  required
                />
              </div>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as CompanyRole)}
                className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
              >
                {myRole === 'OWNER' && <option value="ADMIN">Administrador</option>}
                <option value="ACCOUNTANT">Contador</option>
                <option value="VIEWER">Solo lectura</option>
              </select>
              <Button type="submit" isLoading={addLoading}>
                Agregar
              </Button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              El usuario debe estar registrado en la plataforma.
            </p>
          </form>
        </div>
      )}

      {/* Lista de miembros */}
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {members.map((member) => {
          const RoleIcon = ROLE_ICONS[member.role];
          const isOwner = member.role === 'OWNER';
          const canModify = canManage && !isOwner && (myRole === 'OWNER' || member.role !== 'ADMIN');

          return (
            <div
              key={member.id}
              className="p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-200 dark:bg-gray-600 rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-200">
                    {member.user?.fullName?.[0] || member.user?.email?.[0]?.toUpperCase() || '?'}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {member.user?.fullName || member.user?.email}
                  </p>
                  {member.user?.fullName && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {member.user.email}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {canModify ? (
                  <select
                    value={member.role}
                    onChange={(e) => handleChangeRole(member.id, e.target.value as CompanyRole)}
                    className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    {myRole === 'OWNER' && <option value="ADMIN">Administrador</option>}
                    <option value="ACCOUNTANT">Contador</option>
                    <option value="VIEWER">Solo lectura</option>
                  </select>
                ) : (
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${ROLE_COLORS[member.role]}`}
                  >
                    <RoleIcon className="w-3 h-3" />
                    {ROLE_LABELS[member.role]}
                  </span>
                )}

                {canModify && (
                  <button
                    onClick={() => handleRemoveMember(member.id, member.user?.email || '')}
                    className="p-1 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                    title="Eliminar acceso"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {members.length === 0 && (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            No hay miembros registrados
          </div>
        )}
      </div>
    </div>
  );
}
