import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// Session timeout in milliseconds (15 minutes)
const SESSION_TIMEOUT = 15 * 60 * 1000;
const LAST_ACTIVITY_KEY = 'audit-last-activity';

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
  isHydrated: boolean;

  // Actions
  setUser: (user: User) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  login: (user: User, accessToken: string, refreshToken: string) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
  setHydrated: (hydrated: boolean) => void;
  updateActivity: () => void;
  checkSessionTimeout: () => boolean;
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
      isHydrated: false,

      setUser: (user) => set({ user }),

      setTokens: (accessToken, refreshToken) =>
        set({ accessToken, refreshToken, isAuthenticated: true }),

      login: (user, accessToken, refreshToken) => {
        // Update last activity on login
        if (typeof window !== 'undefined') {
          localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
        }
        set({
          user,
          accessToken,
          refreshToken,
          isAuthenticated: true,
          isLoading: false,
        });
      },

      logout: () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem(LAST_ACTIVITY_KEY);
        }
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          isLoading: false,
        });
      },

      setLoading: (loading) => set({ isLoading: loading }),

      setHydrated: (hydrated) => set({ isHydrated: hydrated }),

      updateActivity: () => {
        if (typeof window !== 'undefined') {
          localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
        }
      },

      checkSessionTimeout: () => {
        if (typeof window === 'undefined') return false;

        const lastActivity = localStorage.getItem(LAST_ACTIVITY_KEY);
        if (!lastActivity) return false;

        const elapsed = Date.now() - parseInt(lastActivity, 10);
        return elapsed > SESSION_TIMEOUT;
      },

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
      onRehydrateStorage: () => (state) => {
        // Mark as hydrated when rehydration is complete
        if (state) {
          state.setHydrated(true);
          state.setLoading(false);
        }
      },
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
