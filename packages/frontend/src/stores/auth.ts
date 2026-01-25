import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  department?: string;
  title?: string;
  roles: Array<{
    id: string;
    name: string;
    displayName: string;
    entityId?: string;
    entityName?: string;
  }>;
  permissions: string[];
  mustChangePassword: boolean;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  setUser: (user: User) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  login: (user: User, accessToken: string, refreshToken: string) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
  hasPermission: (permission: string) => boolean;
  hasRole: (role: string) => boolean;
  hasAnyRole: (...roles: string[]) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: true,

      setUser: (user) => set({ user }),

      setTokens: (accessToken, refreshToken) =>
        set({ accessToken, refreshToken, isAuthenticated: true }),

      login: (user, accessToken, refreshToken) =>
        set({
          user,
          accessToken,
          refreshToken,
          isAuthenticated: true,
          isLoading: false,
        }),

      logout: () =>
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          isLoading: false,
        }),

      setLoading: (loading) => set({ isLoading: loading }),

      hasPermission: (permission) => {
        const { user } = get();
        if (!user) return false;

        // System admins have all permissions
        if (user.roles.some((r) => r.name === 'system_admin')) return true;

        return user.permissions.includes(permission);
      },

      hasRole: (role) => {
        const { user } = get();
        if (!user) return false;
        return user.roles.some((r) => r.name === role);
      },

      hasAnyRole: (...roles) => {
        const { user } = get();
        if (!user) return false;
        return roles.some((role) => user.roles.some((r) => r.name === role));
      },
    }),
    {
      name: 'audit-auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// Role constants
export const ROLES = {
  SYSTEM_ADMIN: 'system_admin',
  AUDIT_ADMIN: 'audit_admin',
  COMPLIANCE_MANAGER: 'compliance_manager',
  AUDITOR: 'auditor',
  OBSERVATION_OWNER: 'observation_owner',
  REVIEWER: 'reviewer',
  EXECUTIVE: 'executive',
} as const;

// Permission helper
export const can = (resource: string, action: string, scope = 'all') => {
  return useAuthStore.getState().hasPermission(`${resource}:${action}:${scope}`);
};
