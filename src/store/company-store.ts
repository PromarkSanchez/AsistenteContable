'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Company } from '@/types';

interface CompanyState {
  selectedCompany: Company | null;
  companies: Company[];

  // Acciones
  setSelectedCompany: (company: Company | null) => void;
  setCompanies: (companies: Company[]) => void;
  addCompany: (company: Company) => void;
  updateCompany: (id: string, updates: Partial<Company>) => void;
  removeCompany: (id: string) => void;
  clearCompany: () => void;
}

export const useCompanyStore = create<CompanyState>()(
  persist(
    (set, get) => ({
      selectedCompany: null,
      companies: [],

      setSelectedCompany: (company) => set({ selectedCompany: company }),

      setCompanies: (companies) => {
        const currentSelected = get().selectedCompany;

        // Si hay una empresa seleccionada, verificar que aún existe
        if (currentSelected) {
          const stillExists = companies.find((c) => c.id === currentSelected.id);
          if (!stillExists) {
            set({
              companies,
              selectedCompany: companies.length > 0 ? companies[0] : null
            });
            return;
          }
          // Actualizar la empresa seleccionada con los datos más recientes
          set({
            companies,
            selectedCompany: stillExists
          });
          return;
        }

        // Si no hay empresa seleccionada, seleccionar la primera
        set({
          companies,
          selectedCompany: companies.length > 0 ? companies[0] : null
        });
      },

      addCompany: (company) => {
        const companies = [...get().companies, company];
        const selectedCompany = get().selectedCompany || company;
        set({ companies, selectedCompany });
      },

      updateCompany: (id, updates) => {
        const companies = get().companies.map((c) =>
          c.id === id ? { ...c, ...updates } : c
        );
        const selectedCompany = get().selectedCompany;

        set({
          companies,
          selectedCompany:
            selectedCompany?.id === id
              ? { ...selectedCompany, ...updates }
              : selectedCompany,
        });
      },

      removeCompany: (id) => {
        const companies = get().companies.filter((c) => c.id !== id);
        const selectedCompany = get().selectedCompany;

        set({
          companies,
          selectedCompany:
            selectedCompany?.id === id
              ? companies.length > 0 ? companies[0] : null
              : selectedCompany,
        });
      },

      clearCompany: () => set({ selectedCompany: null, companies: [] }),
    }),
    {
      name: 'contador-company',
      // Usar sessionStorage para que los datos se eliminen al cerrar el navegador
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        selectedCompany: state.selectedCompany,
        companies: state.companies,
      }),
    }
  )
);

// Hook para obtener la empresa seleccionada
export function useSelectedCompany() {
  return useCompanyStore((state) => state.selectedCompany);
}

// Hook para obtener todas las empresas
export function useCompanies() {
  return useCompanyStore((state) => state.companies);
}

// Hook para verificar si hay empresa seleccionada
export function useHasCompany() {
  return useCompanyStore((state) => !!state.selectedCompany);
}
