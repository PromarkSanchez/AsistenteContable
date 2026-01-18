import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface MenuItem {
  key: string;
  label: string;
  icon: string | null;
  path: string;
  orden: number;
}

interface PlanConfigData {
  nombre: string;
  maxEmpresas: number;
  maxComprobantes: number;
  maxStorage: string;
  maxUsuarios: number;
  iaEnabled: boolean;
  iaMaxConsultas: number;
  iaModelo: string | null;
  facturacionEnabled: boolean;
  reportesAvanzados: boolean;
  librosElectronicos: boolean;
  alertasEnabled: boolean;
  apiAccess: boolean;
  soportePrioritario: boolean;
}

interface PlanConfigStore {
  plan: string | null;
  isSuperadmin: boolean;
  config: PlanConfigData | null;
  menus: MenuItem[];
  loading: boolean;
  error: string | null;
  lastFetch: number | null;

  // Actions
  fetchPlanConfig: (accessToken: string) => Promise<void>;
  clearConfig: () => void;

  // Helpers
  hasFeature: (feature: keyof PlanConfigData) => boolean;
  canAccessMenu: (menuKey: string) => boolean;
  isMenuVisible: (menuKey: string) => boolean;
}

export const usePlanConfigStore = create<PlanConfigStore>()(
  persist(
    (set, get) => ({
      plan: null,
      isSuperadmin: false,
      config: null,
      menus: [],
      loading: false,
      error: null,
      lastFetch: null,

      fetchPlanConfig: async (accessToken: string) => {
        // No refetch si fue hace menos de 5 minutos
        const lastFetch = get().lastFetch;
        if (lastFetch && Date.now() - lastFetch < 5 * 60 * 1000) {
          return;
        }

        set({ loading: true, error: null });

        try {
          const response = await fetch('/api/user/plan-config', {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          });

          if (!response.ok) {
            throw new Error('Error obteniendo configuración del plan');
          }

          const data = await response.json();

          set({
            plan: data.plan,
            isSuperadmin: data.isSuperadmin,
            config: data.config,
            menus: data.menus,
            loading: false,
            lastFetch: Date.now(),
          });
        } catch (error) {
          set({
            loading: false,
            error: error instanceof Error ? error.message : 'Error desconocido',
          });
        }
      },

      clearConfig: () => {
        set({
          plan: null,
          isSuperadmin: false,
          config: null,
          menus: [],
          lastFetch: null,
        });
      },

      hasFeature: (feature: keyof PlanConfigData) => {
        const { config, isSuperadmin } = get();

        // Superadmin tiene acceso a todo
        if (isSuperadmin) return true;

        if (!config) return false;

        const value = config[feature];
        if (typeof value === 'boolean') return value;
        if (typeof value === 'number') return value > 0 || value === 0; // 0 puede significar ilimitado
        return !!value;
      },

      canAccessMenu: (menuKey: string) => {
        const { menus, isSuperadmin } = get();

        // Superadmin tiene acceso a todo
        if (isSuperadmin) return true;

        return menus.some(m => m.key === menuKey);
      },

      isMenuVisible: (menuKey: string) => {
        const { menus, isSuperadmin } = get();

        if (isSuperadmin) return true;

        return menus.some(m => m.key === menuKey);
      },
    }),
    {
      name: 'plan-config-storage',
      partialize: (state) => ({
        plan: state.plan,
        isSuperadmin: state.isSuperadmin,
        config: state.config,
        menus: state.menus,
        lastFetch: state.lastFetch,
      }),
    }
  )
);

// Hook simplificado para uso común
export function usePlanConfig() {
  const store = usePlanConfigStore();

  return {
    plan: store.plan,
    config: store.config,
    menus: store.menus,
    isSuperadmin: store.isSuperadmin,
    loading: store.loading,

    // Verificar features
    canUseIA: () => store.hasFeature('iaEnabled'),
    canUseFacturacion: () => store.hasFeature('facturacionEnabled'),
    canUseReportes: () => store.hasFeature('reportesAvanzados'),
    canUseLibros: () => store.hasFeature('librosElectronicos'),
    canUseAlertas: () => store.hasFeature('alertasEnabled'),
    canUseAPI: () => store.hasFeature('apiAccess'),

    // Verificar menús
    canAccessMenu: store.canAccessMenu,
    isMenuVisible: store.isMenuVisible,

    // Límites
    getMaxEmpresas: () => store.config?.maxEmpresas || 1,
    getMaxComprobantes: () => store.config?.maxComprobantes || 50,

    // Acciones
    refresh: store.fetchPlanConfig,
    clear: store.clearConfig,
  };
}
