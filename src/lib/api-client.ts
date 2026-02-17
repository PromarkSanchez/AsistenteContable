'use client';

import { useAuthStore } from '@/store/auth-store';

const API_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || '';

interface FetchOptions extends RequestInit {
  skipAuth?: boolean;
}

class ApiClient {
  private baseUrl: string;
  private isRefreshing = false;
  private refreshPromise: Promise<boolean> | null = null;

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl;
  }

  private getHeaders(skipAuth: boolean = false): Headers {
    const headers = new Headers({
      'Content-Type': 'application/json',
    });

    if (!skipAuth) {
      const token = useAuthStore.getState().accessToken;
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
    }

    return headers;
  }

  // Forzar logout y redirección al login
  private async forceLogout(): Promise<void> {
    // Limpiar store
    useAuthStore.getState().logout();
    // Limpiar sessionStorage
    sessionStorage.removeItem('contador-auth');
    sessionStorage.removeItem('contador-company');
    localStorage.removeItem('plan-config-storage');
    // Llamar al endpoint de logout para limpiar cookies httpOnly
    try {
      await fetch(`${this.baseUrl}/api/auth/logout`, { method: 'POST' });
    } catch {
      // Ignorar errores al cerrar sesión
    }
    // Redirigir al login
    if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
      window.location.href = '/login';
    }
  }

  private async handleResponse<T>(response: Response, retryFn?: () => Promise<Response>): Promise<T> {
    if (response.status === 401 && retryFn) {
      // Token expirado, intentar refresh
      const refreshed = await this.refreshToken();
      if (!refreshed) {
        // Logout si no se puede refrescar
        await this.forceLogout();
        throw new Error('Sesión expirada');
      }
      // Reintentar la solicitud original con el nuevo token
      const retryResponse = await retryFn();
      if (!retryResponse.ok) {
        if (retryResponse.status === 401) {
          await this.forceLogout();
          throw new Error('Sesión expirada');
        }
        const error = await retryResponse.json().catch(() => ({ error: 'Error desconocido' }));
        throw new Error(error.error || error.message || 'Error en la solicitud');
      }
      if (retryResponse.status === 204) {
        return {} as T;
      }
      return retryResponse.json();
    }

    if (response.status === 401) {
      await this.forceLogout();
      throw new Error('Sesión expirada');
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Error desconocido' }));
      throw new Error(error.error || error.message || 'Error en la solicitud');
    }

    // Manejar respuestas vacías (204 No Content)
    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  // Refresh con lock para evitar llamadas concurrentes
  private async refreshToken(): Promise<boolean> {
    // Si ya hay un refresh en curso, esperar su resultado
    if (this.isRefreshing && this.refreshPromise) {
      return this.refreshPromise;
    }

    this.isRefreshing = true;
    this.refreshPromise = this._doRefresh();

    try {
      return await this.refreshPromise;
    } finally {
      this.isRefreshing = false;
      this.refreshPromise = null;
    }
  }

  private async _doRefresh(): Promise<boolean> {
    const refreshToken = useAuthStore.getState().refreshToken;

    try {
      // Intentar refresh con el token del store, o dejar que el server use la cookie
      const response = await fetch(`${this.baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: refreshToken ? JSON.stringify({ refreshToken }) : '{}',
      });

      if (!response.ok) return false;

      const tokens = await response.json();
      useAuthStore.getState().setTokens(tokens.accessToken, tokens.refreshToken);
      return true;
    } catch {
      return false;
    }
  }

  // Helper para crear la función de retry con headers actualizados
  private createRetryFn(method: string, url: string, options: RequestInit): () => Promise<Response> {
    return () => {
      const newHeaders = new Headers(options.headers);
      const token = useAuthStore.getState().accessToken;
      if (token) {
        newHeaders.set('Authorization', `Bearer ${token}`);
      }
      return fetch(url, { ...options, method, headers: newHeaders });
    };
  }

  async get<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
    const { skipAuth, ...fetchOptions } = options;
    const headers = this.getHeaders(skipAuth);
    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      method: 'GET',
      headers,
      ...fetchOptions,
    });

    return this.handleResponse<T>(
      response,
      skipAuth ? undefined : this.createRetryFn('GET', url, { headers, ...fetchOptions })
    );
  }

  async post<T>(endpoint: string, data?: unknown, options: FetchOptions = {}): Promise<T> {
    const { skipAuth, ...fetchOptions } = options;
    const headers = this.getHeaders(skipAuth);
    const url = `${this.baseUrl}${endpoint}`;
    const body = data ? JSON.stringify(data) : undefined;

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
      ...fetchOptions,
    });

    return this.handleResponse<T>(
      response,
      skipAuth ? undefined : this.createRetryFn('POST', url, { headers, body, ...fetchOptions })
    );
  }

  async put<T>(endpoint: string, data?: unknown, options: FetchOptions = {}): Promise<T> {
    const { skipAuth, ...fetchOptions } = options;
    const headers = this.getHeaders(skipAuth);
    const url = `${this.baseUrl}${endpoint}`;
    const body = data ? JSON.stringify(data) : undefined;

    const response = await fetch(url, {
      method: 'PUT',
      headers,
      body,
      ...fetchOptions,
    });

    return this.handleResponse<T>(
      response,
      skipAuth ? undefined : this.createRetryFn('PUT', url, { headers, body, ...fetchOptions })
    );
  }

  async patch<T>(endpoint: string, data?: unknown, options: FetchOptions = {}): Promise<T> {
    const { skipAuth, ...fetchOptions } = options;
    const headers = this.getHeaders(skipAuth);
    const url = `${this.baseUrl}${endpoint}`;
    const body = data ? JSON.stringify(data) : undefined;

    const response = await fetch(url, {
      method: 'PATCH',
      headers,
      body,
      ...fetchOptions,
    });

    return this.handleResponse<T>(
      response,
      skipAuth ? undefined : this.createRetryFn('PATCH', url, { headers, body, ...fetchOptions })
    );
  }

  async delete<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
    const { skipAuth, ...fetchOptions } = options;
    const headers = this.getHeaders(skipAuth);
    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      method: 'DELETE',
      headers,
      ...fetchOptions,
    });

    return this.handleResponse<T>(
      response,
      skipAuth ? undefined : this.createRetryFn('DELETE', url, { headers, ...fetchOptions })
    );
  }

  // Método especial para subir archivos
  async upload<T>(
    endpoint: string,
    formData: FormData,
    options: FetchOptions = {}
  ): Promise<T> {
    const { skipAuth, ...fetchOptions } = options;
    const token = useAuthStore.getState().accessToken;

    const headers = new Headers();
    if (!skipAuth && token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
      ...fetchOptions,
    });

    const retryFn = skipAuth ? undefined : () => {
      const retryHeaders = new Headers();
      const newToken = useAuthStore.getState().accessToken;
      if (newToken) {
        retryHeaders.set('Authorization', `Bearer ${newToken}`);
      }
      return fetch(url, { method: 'POST', headers: retryHeaders, body: formData, ...fetchOptions });
    };

    return this.handleResponse<T>(response, retryFn);
  }
}

export const apiClient = new ApiClient(API_BASE_URL);

// ==================== APIs DE AUTENTICACIÓN ====================

export const authApi = {
  login: (email: string, password: string) =>
    apiClient.post<{
      user: import('@/types').User;
      accessToken: string;
      refreshToken: string;
      tokenType: string;
    }>('/api/auth/login', { email, password }, { skipAuth: true }),

  register: (email: string, password: string, fullName?: string) =>
    apiClient.post<{
      user: import('@/types').User;
      accessToken: string;
      refreshToken: string;
      tokenType: string;
    }>('/api/auth/register', { email, password, fullName }, { skipAuth: true }),

  refresh: (refreshToken: string) =>
    apiClient.post<{
      accessToken: string;
      refreshToken: string;
      tokenType: string;
    }>('/api/auth/refresh', { refreshToken }, { skipAuth: true }),

  logout: () =>
    apiClient.post<{ success: boolean }>('/api/auth/logout', {}, { skipAuth: true }),

  getMe: () =>
    apiClient.get<import('@/types').UserWithCompanies>('/api/auth/me'),

  updateMe: (data: { fullName?: string; email?: string }) =>
    apiClient.put<import('@/types').User>('/api/auth/me', data),
};

// ==================== APIs DE EMPRESAS ====================

export const companiesApi = {
  list: () =>
    apiClient.get<import('@/types').Company[]>('/api/companies'),

  get: (id: string) =>
    apiClient.get<import('@/types').Company>(`/api/companies/${id}`),

  create: (data: import('@/lib/validations').CompanyInput) =>
    apiClient.post<import('@/types').Company>('/api/companies', data),

  update: (id: string, data: import('@/lib/validations').CompanyUpdateInput) =>
    apiClient.put<import('@/types').Company>(`/api/companies/${id}`, data),

  delete: (id: string) =>
    apiClient.delete(`/api/companies/${id}`),

  uploadLogo: (id: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.upload<{ message: string; logoUrl: string }>(
      `/api/companies/${id}/logo`,
      formData
    );
  },

  deleteLogo: (id: string) =>
    apiClient.delete(`/api/companies/${id}/logo`),

  updateCredentials: (id: string, data: { usuarioSol: string; claveSol: string }) =>
    apiClient.put<{ success: boolean; message: string }>(`/api/companies/${id}/credentials`, data),

  deleteCredentials: (id: string) =>
    apiClient.delete<{ success: boolean; message: string }>(`/api/companies/${id}/credentials`),

  uploadCertificate: (id: string, file: File, password: string) => {
    const formData = new FormData();
    formData.append('certificate', file);
    formData.append('password', password);
    return apiClient.upload<{ success: boolean; message: string; fileName: string; size: number }>(
      `/api/companies/${id}/certificate`,
      formData
    );
  },

  deleteCertificate: (id: string) =>
    apiClient.delete<{ success: boolean; message: string }>(`/api/companies/${id}/certificate`),

  uploadFirma: (id: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.upload<{ message: string; firmaUrl: string }>(
      `/api/companies/${id}/firma`,
      formData
    );
  },

  deleteFirma: (id: string) =>
    apiClient.delete(`/api/companies/${id}/firma`),

  uploadHuella: (id: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.upload<{ message: string; huellaUrl: string }>(
      `/api/companies/${id}/huella`,
      formData
    );
  },

  deleteHuella: (id: string) =>
    apiClient.delete(`/api/companies/${id}/huella`),

  // SEACE Credentials
  getSeaceConfig: (id: string) =>
    apiClient.get<{
      config: {
        usuarioSeace: string;
        hasClaveSeace: boolean;
        entidadSeace: string;
        siglaEntidadSeace: string;
        anioSeace: string;
        seaceEnabled: boolean;
      };
    }>(`/api/companies/${id}/seace-credentials`),

  updateSeaceCredentials: (id: string, data: {
    usuarioSeace?: string;
    claveSeace?: string;
    entidadSeace?: string;
    siglaEntidadSeace?: string;
    anioSeace?: string;
    seaceEnabled?: boolean;
  }) =>
    apiClient.put<{ success: boolean; message: string }>(`/api/companies/${id}/seace-credentials`, data),

  deleteSeaceCredentials: (id: string) =>
    apiClient.delete<{ success: boolean; message: string }>(`/api/companies/${id}/seace-credentials`),

  runSeaceScraper: (id: string) =>
    apiClient.post<{
      success: boolean;
      sessionId?: string;
      backgroundMode?: boolean;
      message: string;
    }>(`/api/companies/${id}/seace-run`, {}),

  // Miembros de empresa
  listMembers: (id: string) =>
    apiClient.get<import('@/types').CompanyMember[]>(`/api/companies/${id}/members`),

  addMember: (id: string, data: { email: string; role: import('@/types').CompanyRole }) =>
    apiClient.post<import('@/types').CompanyMember>(`/api/companies/${id}/members`, data),

  updateMemberRole: (id: string, memberId: string, role: import('@/types').CompanyRole) =>
    apiClient.patch<import('@/types').CompanyMember>(`/api/companies/${id}/members/${memberId}`, { role }),

  removeMember: (id: string, memberId: string) =>
    apiClient.delete(`/api/companies/${id}/members/${memberId}`),
};

// ==================== APIs DE COMPROBANTES ====================

export const comprobantesApi = {
  list: (companyId: string, params?: { tipo?: string; periodo?: string; skip?: number; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.tipo) searchParams.set('tipo', params.tipo);
    if (params?.periodo) searchParams.set('periodo', params.periodo);
    if (params?.skip !== undefined) searchParams.set('skip', String(params.skip));
    if (params?.limit !== undefined) searchParams.set('limit', String(params.limit));
    const query = searchParams.toString();
    return apiClient.get<{
      data: import('@/types').Comprobante[];
      total: number;
      skip: number;
      limit: number;
    }>(
      `/api/companies/${companyId}/comprobantes${query ? `?${query}` : ''}`
    );
  },

  get: (companyId: string, comprobanteId: string) =>
    apiClient.get<import('@/types').Comprobante>(
      `/api/companies/${companyId}/comprobantes/${comprobanteId}`
    ),

  create: (companyId: string, data: import('@/lib/validations').ComprobanteInput) =>
    apiClient.post<import('@/types').Comprobante>(
      `/api/companies/${companyId}/comprobantes`,
      data
    ),

  update: (companyId: string, comprobanteId: string, data: import('@/lib/validations').ComprobanteUpdateInput) =>
    apiClient.put<import('@/types').Comprobante>(
      `/api/companies/${companyId}/comprobantes/${comprobanteId}`,
      data
    ),

  delete: (companyId: string, comprobanteId: string) =>
    apiClient.delete(`/api/companies/${companyId}/comprobantes/${comprobanteId}`),

  getPeriodos: (companyId: string) =>
    apiClient.get<import('@/types').PeriodoResumen[]>(
      `/api/companies/${companyId}/comprobantes/periodos`
    ),

  getResumen: (companyId: string, periodo: string) =>
    apiClient.get<import('@/types').ResumenComprobantes>(
      `/api/companies/${companyId}/comprobantes/resumen?periodo=${periodo}`
    ),

  getHistorico: (companyId: string, meses: number = 6) =>
    apiClient.get<{
      historico: Array<{
        periodo: string;
        mes: string;
        ventas: number;
        compras: number;
        igvVentas: number;
        igvCompras: number;
        igvNeto: number;
        cantidadVentas: number;
        cantidadCompras: number;
      }>;
      totales: {
        ventas: number;
        compras: number;
        igvVentas: number;
        igvCompras: number;
        comprobantes: number;
      };
      promedios: {
        ventasMensual: number;
        comprasMensual: number;
        igvMensual: number;
        margenBruto: number;
      };
      tendencia: {
        ventas: number;
        compras: number;
      };
      periodos: number;
    }>(`/api/companies/${companyId}/stats/historico?meses=${meses}`),
};

// ==================== APIs DE IMPORTACIÓN ====================

export const importApi = {
  parseQR: (qrData: string) =>
    apiClient.post<{
      success: boolean;
      data: {
        ruc: string;
        tipoDocumento: string;
        serie: string;
        numero: string;
        igv: number;
        total: number;
        fecha: string;
        tipoDocTercero?: string;
        numeroDocTercero?: string;
      };
    }>('/api/qr/parse', { qrData }),

  importQR: (companyId: string, qrData: string, tipoOperacion: 'VENTA' | 'COMPRA') =>
    apiClient.post<{
      success: boolean;
      message: string;
      comprobante?: import('@/types').Comprobante;
    }>('/api/qr/import', { companyId, qrData, tipoOperacion }),

  importSIRE: (companyId: string, file: File, periodo?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('companyId', companyId);
    if (periodo) formData.append('periodo', periodo);
    return apiClient.upload<{
      success: boolean;
      message: string;
      summary: {
        total: number;
        imported: number;
        duplicated: number;
        errors: number;
        fileType: string;
      };
    }>('/api/sire/import', formData);
  },

  importXML: (companyId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('companyId', companyId);
    return apiClient.upload<{
      success: boolean;
      message: string;
      summary: {
        total: number;
        imported: number;
        duplicated: number;
        errors: number;
        fileType: string;
        ventasDetectadas: number;
        comprasDetectadas: number;
      };
      comprobantes: Array<{
        id: string;
        tipo: string;
        serie: string;
        numero: string;
        total: number;
        tercero: string;
      }>;
    }>('/api/import/xml', formData);
  },
};

// ==================== APIs DE TERCEROS (RUC/DNI) ====================

export const tercerosApi = {
  consultarRUC: (ruc: string) =>
    apiClient.get<{
      success: boolean;
      source: string;
      data: {
        tipoDocumento: string;
        numeroDocumento: string;
        razonSocial: string;
        nombreComercial?: string;
        direccion?: string;
        ubigeo?: string;
        departamento?: string;
        provincia?: string;
        distrito?: string;
        estado?: string;
        condicion?: string;
        esAgenteRetencion?: boolean;
        esBuenContribuyente?: boolean;
      };
    }>(`/api/terceros?tipo=6&numero=${ruc}`),

  consultarDNI: (dni: string) =>
    apiClient.get<{
      success: boolean;
      source: string;
      data: {
        tipoDocumento: string;
        numeroDocumento: string;
        razonSocial: string;
        direccion?: string;
      };
    }>(`/api/terceros?tipo=1&numero=${dni}`),
};

export default apiClient;
