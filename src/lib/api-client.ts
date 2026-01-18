'use client';

import { useAuthStore } from '@/store/auth-store';

const API_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || '';

interface FetchOptions extends RequestInit {
  skipAuth?: boolean;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl;
  }

  private async getHeaders(skipAuth: boolean = false): Promise<Headers> {
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
  private forceLogout(): void {
    // Limpiar store
    useAuthStore.getState().logout();
    // Limpiar cookie
    document.cookie = 'contador-auth=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT';
    // Limpiar localStorage/sessionStorage
    localStorage.removeItem('contador-auth');
    sessionStorage.removeItem('contador-auth');
    sessionStorage.removeItem('contador-company');
    localStorage.removeItem('plan-config-storage');
    // Redirigir al login
    if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
      window.location.href = '/login';
    }
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (response.status === 401) {
      // Token expirado, intentar refresh
      const refreshed = await this.refreshToken();
      if (!refreshed) {
        // Logout si no se puede refrescar
        this.forceLogout();
        throw new Error('Sesión expirada');
      }
      throw new Error('Token refrescado, reintentar');
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

  private async refreshToken(): Promise<boolean> {
    const refreshToken = useAuthStore.getState().refreshToken;
    if (!refreshToken) return false;

    try {
      const response = await fetch(`${this.baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) return false;

      const tokens = await response.json();
      useAuthStore.getState().setTokens(tokens.accessToken, tokens.refreshToken);
      return true;
    } catch {
      return false;
    }
  }

  async get<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
    const { skipAuth, ...fetchOptions } = options;
    const headers = await this.getHeaders(skipAuth);

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'GET',
      headers,
      ...fetchOptions,
    });

    return this.handleResponse<T>(response);
  }

  async post<T>(endpoint: string, data?: unknown, options: FetchOptions = {}): Promise<T> {
    const { skipAuth, ...fetchOptions } = options;
    const headers = await this.getHeaders(skipAuth);

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers,
      body: data ? JSON.stringify(data) : undefined,
      ...fetchOptions,
    });

    return this.handleResponse<T>(response);
  }

  async put<T>(endpoint: string, data?: unknown, options: FetchOptions = {}): Promise<T> {
    const { skipAuth, ...fetchOptions } = options;
    const headers = await this.getHeaders(skipAuth);

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'PUT',
      headers,
      body: data ? JSON.stringify(data) : undefined,
      ...fetchOptions,
    });

    return this.handleResponse<T>(response);
  }

  async patch<T>(endpoint: string, data?: unknown, options: FetchOptions = {}): Promise<T> {
    const { skipAuth, ...fetchOptions } = options;
    const headers = await this.getHeaders(skipAuth);

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'PATCH',
      headers,
      body: data ? JSON.stringify(data) : undefined,
      ...fetchOptions,
    });

    return this.handleResponse<T>(response);
  }

  async delete<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
    const { skipAuth, ...fetchOptions } = options;
    const headers = await this.getHeaders(skipAuth);

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'DELETE',
      headers,
      ...fetchOptions,
    });

    return this.handleResponse<T>(response);
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
    // No establecer Content-Type para FormData, el navegador lo hace automáticamente

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers,
      body: formData,
      ...fetchOptions,
    });

    return this.handleResponse<T>(response);
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

  // tipoOperacion ahora es opcional - se detecta automáticamente del XML
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
