'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ShieldCheckIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';
import { rolesApi } from '@/lib/api';
import clsx from 'clsx';

interface Permission {
  id: string;
  resource: string;
  action: string;
  scope: string;
  description?: string;
}

interface Role {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  isSystemRole: boolean;
  level: number;
  userCount: number;
  permissions: Permission[];
}

export default function RolesPage() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    displayName: '',
    description: '',
    level: 50,
    permissionIds: [] as string[],
  });

  // Fetch roles
  const { data: roles, isLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const response = await rolesApi.list();
      return response.data || [];
    },
  });

  // Fetch permissions
  const { data: permissions } = useQuery({
    queryKey: ['permissions'],
    queryFn: async () => {
      const response = await rolesApi.getPermissions();
      return response.data || [];
    },
  });

  // Create role mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return rolesApi.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      setShowModal(false);
      resetForm();
      toast.success('Role created successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create role');
    },
  });

  // Update role mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof formData> }) => {
      return rolesApi.update(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      setShowModal(false);
      setEditingRole(null);
      resetForm();
      toast.success('Role updated successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update role');
    },
  });

  // Delete role mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return rolesApi.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      toast.success('Role deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to delete role');
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      displayName: '',
      description: '',
      level: 50,
      permissionIds: [],
    });
  };

  const handleEdit = (role: Role) => {
    setEditingRole(role);
    setFormData({
      name: role.name,
      displayName: role.displayName,
      description: role.description || '',
      level: role.level,
      permissionIds: role.permissions.map((p) => p.id),
    });
    setShowModal(true);
  };

  const handleDelete = async (role: Role) => {
    if (role.isSystemRole) {
      toast.error('Cannot delete system roles');
      return;
    }
    if (role.userCount > 0) {
      toast.error('Cannot delete role assigned to users');
      return;
    }
    if (window.confirm(`Are you sure you want to delete "${role.displayName}"?`)) {
      deleteMutation.mutate(role.id);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingRole) {
      updateMutation.mutate({
        id: editingRole.id,
        data: {
          displayName: formData.displayName,
          description: formData.description,
          level: formData.level,
          permissionIds: formData.permissionIds,
        },
      });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handlePermissionToggle = (permissionId: string) => {
    setFormData((prev) => ({
      ...prev,
      permissionIds: prev.permissionIds.includes(permissionId)
        ? prev.permissionIds.filter((id) => id !== permissionId)
        : [...prev.permissionIds, permissionId],
    }));
  };

  // Group permissions by resource
  const groupedPermissions = permissions?.reduce((acc: Record<string, Permission[]>, perm: Permission) => {
    if (!acc[perm.resource]) {
      acc[perm.resource] = [];
    }
    acc[perm.resource].push(perm);
    return acc;
  }, {}) || {};

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Role Management</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Manage roles and their permissions
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setEditingRole(null);
            setShowModal(true);
          }}
          className="btn btn-primary"
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          Add Role
        </button>
      </div>

      {/* Roles Grid */}
      {isLoading ? (
        <div className="card p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {roles?.map((role: Role) => (
            <div key={role.id} className="card p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={clsx(
                    'w-10 h-10 rounded-lg flex items-center justify-center',
                    role.isSystemRole ? 'bg-purple-100 dark:bg-purple-900/30' : 'bg-blue-100 dark:bg-blue-900/30'
                  )}>
                    <ShieldCheckIcon className={clsx(
                      'h-5 w-5',
                      role.isSystemRole ? 'text-purple-600 dark:text-purple-400' : 'text-blue-600 dark:text-blue-400'
                    )} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100">{role.displayName}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{role.name}</p>
                  </div>
                </div>
                {!role.isSystemRole && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleEdit(role)}
                      className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                      title="Edit"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(role)}
                      className="p-1 text-slate-400 hover:text-red-600 dark:hover:text-red-400"
                      title="Delete"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>

              {role.description && (
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">{role.description}</p>
              )}

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                  <UsersIcon className="h-4 w-4" />
                  <span>{role.userCount} users</span>
                </div>
                <span className={clsx(
                  'badge',
                  role.isSystemRole ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300'
                )}>
                  {role.isSystemRole ? 'System' : 'Custom'}
                </span>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                  {role.permissions.length} permissions
                </p>
                <div className="flex flex-wrap gap-1">
                  {role.permissions.slice(0, 5).map((perm) => (
                    <span key={perm.id} className="badge bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 text-xs">
                      {perm.resource}:{perm.action}
                    </span>
                  ))}
                  {role.permissions.length > 5 && (
                    <span className="badge bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 text-xs">
                      +{role.permissions.length - 5} more
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Role Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setShowModal(false)} />
            <div className="relative bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
                {editingRole ? 'Edit Role' : 'Create Role'}
              </h3>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Role Name *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      disabled={!!editingRole}
                      className="input"
                      placeholder="e.g., custom_auditor"
                      required
                    />
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Lowercase, no spaces</p>
                  </div>
                  <div>
                    <label className="label">Display Name *</label>
                    <input
                      type="text"
                      value={formData.displayName}
                      onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                      className="input"
                      placeholder="e.g., Custom Auditor"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="label">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="input"
                    rows={2}
                    placeholder="Role description..."
                  />
                </div>

                <div>
                  <label className="label">Level (0-100)</label>
                  <input
                    type="number"
                    value={formData.level}
                    onChange={(e) => setFormData({ ...formData, level: parseInt(e.target.value) || 0 })}
                    className="input w-32"
                    min={0}
                    max={100}
                  />
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Higher level = more authority</p>
                </div>

                <div>
                  <label className="label">Permissions</label>
                  <div className="border border-slate-200 dark:border-slate-700 rounded-lg max-h-60 overflow-y-auto">
                    {Object.entries(groupedPermissions).map(([resource, perms]) => (
                      <div key={resource} className="border-b border-slate-200 dark:border-slate-700 last:border-b-0">
                        <div className="bg-slate-50 dark:bg-slate-700 px-3 py-2 font-medium text-sm text-slate-700 dark:text-slate-300 capitalize">
                          {resource.replace(/_/g, ' ')}
                        </div>
                        <div className="p-3 space-y-2">
                          {(perms as Permission[]).map((perm) => (
                            <label key={perm.id} className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={formData.permissionIds.includes(perm.id)}
                                onChange={() => handlePermissionToggle(perm.id)}
                                className="h-4 w-4 text-primary-600 rounded"
                              />
                              <span className="text-sm text-slate-700 dark:text-slate-300">
                                {perm.action} ({perm.scope})
                              </span>
                              {perm.description && (
                                <span className="text-xs text-slate-400">- {perm.description}</span>
                              )}
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setEditingRole(null);
                      resetForm();
                    }}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    className="btn btn-primary"
                  >
                    {createMutation.isPending || updateMutation.isPending
                      ? 'Saving...'
                      : editingRole
                      ? 'Update Role'
                      : 'Create Role'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

