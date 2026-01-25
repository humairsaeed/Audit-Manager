import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/stores/auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().accessToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

    // If 401 and not already retrying, try to refresh token
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshToken = useAuthStore.getState().refreshToken;
      if (refreshToken) {
        try {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refreshToken,
          });

          const { tokens } = response.data.data;
          useAuthStore.getState().setTokens(tokens.accessToken, tokens.refreshToken);

          // Retry original request with new token
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${tokens.accessToken}`;
          }
          return api(originalRequest);
        } catch (refreshError) {
          // Refresh failed, logout user
          useAuthStore.getState().logout();
          window.location.href = '/login';
          return Promise.reject(refreshError);
        }
      }
    }

    return Promise.reject(error);
  }
);

// API Types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: Array<{ code: string; message: string; field?: string }>;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Auth API
export const authApi = {
  login: async (email: string, password: string) => {
    const response = await api.post<ApiResponse<{ user: any; tokens: any }>>('/auth/login', {
      email,
      password,
    });
    return response.data;
  },

  logout: async () => {
    const response = await api.post<ApiResponse>('/auth/logout');
    return response.data;
  },

  getMe: async () => {
    const response = await api.get<ApiResponse<{ user: any }>>('/auth/me');
    return response.data;
  },

  changePassword: async (currentPassword: string, newPassword: string) => {
    const response = await api.post<ApiResponse>('/auth/change-password', {
      currentPassword,
      newPassword,
    });
    return response.data;
  },
};

// Audits API
export const auditsApi = {
  list: async (params?: Record<string, any>) => {
    const response = await api.get<ApiResponse<PaginatedResponse<any>>>('/audits', { params });
    return response.data;
  },

  get: async (id: string) => {
    const response = await api.get<ApiResponse<{ audit: any }>>(`/audits/${id}`);
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get<ApiResponse>(`/audits/${id}`);
    return response.data;
  },

  create: async (data: any) => {
    const response = await api.post<ApiResponse<{ audit: any }>>('/audits', data);
    return response.data;
  },

  update: async (id: string, data: any) => {
    const response = await api.put<ApiResponse<{ audit: any }>>(`/audits/${id}`, data);
    return response.data;
  },

  updateStatus: async (id: string, status: string) => {
    const response = await api.patch<ApiResponse<{ audit: any }>>(`/audits/${id}/status`, { status });
    return response.data;
  },

  getStats: async (id: string) => {
    const response = await api.get<ApiResponse<{ stats: any }>>(`/audits/${id}/stats`);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete<ApiResponse>(`/audits/${id}`);
    return response.data;
  },
};

// Observations API
export const observationsApi = {
  list: async (params?: Record<string, any>) => {
    const response = await api.get<ApiResponse<PaginatedResponse<any>>>('/observations', { params });
    return response.data;
  },

  my: async (params?: Record<string, any>) => {
    const response = await api.get<ApiResponse<PaginatedResponse<any>>>('/observations/my', { params });
    return response.data;
  },

  dueSoon: async (days?: number) => {
    const response = await api.get<ApiResponse<{ observations: any[] }>>('/observations/due-soon', {
      params: { days },
    });
    return response.data;
  },

  overdue: async () => {
    const response = await api.get<ApiResponse<{ observations: any[] }>>('/observations/overdue');
    return response.data;
  },

  get: async (id: string) => {
    const response = await api.get<ApiResponse<{ observation: any }>>(`/observations/${id}`);
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get<ApiResponse>(`/observations/${id}`);
    return response.data;
  },

  create: async (data: any) => {
    const response = await api.post<ApiResponse<{ observation: any }>>('/observations', data);
    return response.data;
  },

  update: async (id: string, data: any) => {
    const response = await api.put<ApiResponse<{ observation: any }>>(`/observations/${id}`, data);
    return response.data;
  },

  updateStatus: async (id: string, status: string, reason?: string) => {
    const response = await api.patch<ApiResponse<{ observation: any }>>(`/observations/${id}/status`, {
      status,
      reason,
    });
    return response.data;
  },

  assignOwner: async (id: string, ownerId: string) => {
    const response = await api.post<ApiResponse<{ observation: any }>>(`/observations/${id}/assign-owner`, {
      ownerId,
    });
    return response.data;
  },

  addComment: async (id: string, content: string, isInternal?: boolean) => {
    const response = await api.post<ApiResponse<{ comment: any }>>(`/observations/${id}/comments`, {
      content,
      isInternal,
    });
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete<ApiResponse>(`/observations/${id}`);
    return response.data;
  },
};

// Evidence API
export const evidenceApi = {
  list: async (observationId: string) => {
    const response = await api.get<ApiResponse<{ evidence: any[] }>>(
      `/evidence/observation/${observationId}`
    );
    return response.data;
  },

  upload: async (observationId: string, file: File, name: string, description?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('observationId', observationId);
    formData.append('name', name);
    if (description) formData.append('description', description);

    const response = await api.post<ApiResponse<{ evidence: any }>>('/evidence', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  uploadMultiple: async (observationId: string, files: File[]) => {
    const formData = new FormData();
    formData.append('observationId', observationId);
    files.forEach((file) => formData.append('files', file));

    const response = await api.post<ApiResponse>('/evidence/multiple', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  getDownloadUrl: async (id: string) => {
    const response = await api.get<ApiResponse<{ url: string; fileName: string }>>(
      `/evidence/${id}/download`
    );
    return response.data;
  },

  review: async (id: string, status: 'APPROVED' | 'REJECTED', remarks?: string, rejectionReason?: string) => {
    const response = await api.post<ApiResponse<{ evidence: any }>>(`/evidence/${id}/review`, {
      status,
      reviewRemarks: remarks,
      rejectionReason,
    });
    return response.data;
  },

  submitForReview: async (observationId: string) => {
    const response = await api.post<ApiResponse>(
      `/evidence/observation/${observationId}/submit-for-review`
    );
    return response.data;
  },

  approveAndClose: async (observationId: string, remarks?: string) => {
    const response = await api.post<ApiResponse>(
      `/evidence/observation/${observationId}/approve-and-close`,
      { remarks }
    );
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete<ApiResponse>(`/evidence/${id}`);
    return response.data;
  },
};

// Import API
export const importApi = {
  upload: async (auditId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('auditId', auditId);

    const response = await api.post<ApiResponse<{ importJob: any }>>('/import/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  analyze: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post<ApiResponse<{ headers: string[]; suggestedMappings: Record<string, string>; sampleData: any[] }>>(
      '/import/analyze',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return response.data;
  },

  preview: async (file: File, auditId: string, mappings: Record<string, string>) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('auditId', auditId);
    formData.append('mappings', JSON.stringify(mappings));

    const response = await api.post<ApiResponse<{ preview: any[] }>>(
      '/import/preview',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return response.data;
  },

  execute: async (file: File, auditId: string, mappings: Record<string, string>) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('auditId', auditId);
    formData.append('mappings', JSON.stringify(mappings));

    const response = await api.post<ApiResponse<{ imported: number; failed: number; errors: Array<{ row: number; error: string }> }>>(
      '/import/execute',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return response.data;
  },

  validate: async (jobId: string, mappingConfig?: any) => {
    const response = await api.post<ApiResponse<{ validation: any }>>(`/import/${jobId}/validate`, {
      mappingConfig,
    });
    return response.data;
  },

  getStatus: async (jobId: string) => {
    const response = await api.get<ApiResponse<{ status: any }>>(`/import/${jobId}/status`);
    return response.data;
  },

  rollback: async (jobId: string, reason: string) => {
    const response = await api.post<ApiResponse>(`/import/${jobId}/rollback`, { reason });
    return response.data;
  },

  detectColumns: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post<ApiResponse<{ headers: string[]; autoMapping: any[] }>>(
      '/import/detect-columns',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return response.data;
  },
};

// Dashboard API
export const dashboardApi = {
  getUserDashboard: async () => {
    const response = await api.get<ApiResponse<{ dashboard: any }>>('/dashboard/user');
    return response.data;
  },

  getManagementDashboard: async (filters?: Record<string, any>) => {
    const response = await api.get<ApiResponse<{ dashboard: any }>>('/dashboard/management', {
      params: filters,
    });
    return response.data;
  },

  getTrends: async (months?: number, filters?: Record<string, any>) => {
    const response = await api.get<ApiResponse<{ trends: any }>>('/dashboard/trends', {
      params: { months, ...filters },
    });
    return response.data;
  },

  getRiskExposure: async (filters?: Record<string, any>) => {
    const response = await api.get<ApiResponse<{ riskExposure: any }>>('/dashboard/risk-exposure', {
      params: filters,
    });
    return response.data;
  },

  getExecutiveSummary: async (filters?: Record<string, any>) => {
    const response = await api.get<ApiResponse<{ summary: any }>>('/dashboard/executive-summary', {
      params: filters,
    });
    return response.data;
  },
};

// Entities API
export const entitiesApi = {
  list: async (flat?: boolean) => {
    const response = await api.get<ApiResponse<{ entities: any[] }>>('/entities', {
      params: { flat },
    });
    return response.data;
  },

  get: async (id: string) => {
    const response = await api.get<ApiResponse<{ entity: any }>>(`/entities/${id}`);
    return response.data;
  },

  create: async (data: any) => {
    const response = await api.post<ApiResponse<{ entity: any }>>('/entities', data);
    return response.data;
  },

  update: async (id: string, data: any) => {
    const response = await api.put<ApiResponse<{ entity: any }>>(`/entities/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete<ApiResponse>(`/entities/${id}`);
    return response.data;
  },
};

// Users API
export const usersApi = {
  list: async (params?: Record<string, any>) => {
    const response = await api.get<ApiResponse<PaginatedResponse<any>>>('/users', { params });
    return response.data;
  },

  search: async (query: string) => {
    const response = await api.get<ApiResponse<{ users: any[] }>>('/users/search', {
      params: { q: query },
    });
    return response.data;
  },

  get: async (id: string) => {
    const response = await api.get<ApiResponse<{ user: any }>>(`/users/${id}`);
    return response.data;
  },

  create: async (data: any) => {
    const response = await api.post<ApiResponse<{ user: any }>>('/users', data);
    return response.data;
  },

  update: async (id: string, data: any) => {
    const response = await api.put<ApiResponse<{ user: any }>>(`/users/${id}`, data);
    return response.data;
  },

  activate: async (id: string) => {
    const response = await api.post<ApiResponse>(`/users/${id}/activate`);
    return response.data;
  },

  deactivate: async (id: string) => {
    const response = await api.post<ApiResponse>(`/users/${id}/deactivate`);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete<ApiResponse>(`/users/${id}`);
    return response.data;
  },

  resetPassword: async (userId: string) => {
    const response = await api.post<ApiResponse>(`/users/${userId}/reset-password`);
    return response.data;
  },
};

// Notifications API
export const notificationsApi = {
  list: async (params?: { unreadOnly?: boolean; limit?: number; offset?: number }) => {
    const response = await api.get<ApiResponse<{ notifications: any[]; total: number; unreadCount: number }>>(
      '/notifications',
      { params }
    );
    return response.data;
  },

  getUnreadCount: async () => {
    const response = await api.get<ApiResponse<{ count: number }>>('/notifications/unread-count');
    return response.data;
  },

  markAsRead: async (id: string) => {
    const response = await api.post<ApiResponse>(`/notifications/${id}/read`);
    return response.data;
  },

  markAllAsRead: async () => {
    const response = await api.post<ApiResponse>('/notifications/read-all');
    return response.data;
  },
};

// Roles API
export const rolesApi = {
  list: async () => {
    const response = await api.get<ApiResponse<any[]>>('/roles');
    return response.data;
  },

  get: async (id: string) => {
    const response = await api.get<ApiResponse>(`/roles/${id}`);
    return response.data;
  },

  create: async (data: any) => {
    const response = await api.post<ApiResponse>('/roles', data);
    return response.data;
  },

  update: async (id: string, data: any) => {
    const response = await api.put<ApiResponse>(`/roles/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete<ApiResponse>(`/roles/${id}`);
    return response.data;
  },
};

// Settings API
export const settingsApi = {
  get: async () => {
    const response = await api.get<ApiResponse>('/settings');
    return response.data;
  },

  update: async (data: any) => {
    const response = await api.put<ApiResponse>('/settings', data);
    return response.data;
  },

  getByKey: async (key: string) => {
    const response = await api.get<ApiResponse>(`/settings/${key}`);
    return response.data;
  },

  updateByKey: async (key: string, value: any) => {
    const response = await api.put<ApiResponse>(`/settings/${key}`, { value });
    return response.data;
  },
};

// Reports API
export const reportsApi = {
  getAging: async (filters?: Record<string, any>) => {
    const response = await api.get<ApiResponse>('/reports/aging', { params: filters });
    return response.data;
  },

  getSummary: async (filters?: Record<string, any>) => {
    const response = await api.get<ApiResponse>('/reports/summary', { params: filters });
    return response.data;
  },

  getCompliance: async (filters?: Record<string, any>) => {
    const response = await api.get<ApiResponse>('/reports/compliance', { params: filters });
    return response.data;
  },

  export: async (options: { type: string; format: 'pdf' | 'excel'; dateRange?: any; filters?: any }) => {
    const response = await api.post('/reports/export', options, {
      responseType: 'blob',
    });
    return response;
  },

  schedule: async (config: any) => {
    const response = await api.post<ApiResponse>('/reports/schedule', config);
    return response.data;
  },

  getScheduled: async () => {
    const response = await api.get<ApiResponse>('/reports/scheduled');
    return response.data;
  },
};

export default api;
