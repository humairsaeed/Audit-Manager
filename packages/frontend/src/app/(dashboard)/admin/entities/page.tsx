'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  TrashIcon,
  BuildingOfficeIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { entitiesApi } from '@/lib/api';
import clsx from 'clsx';

interface Entity {
  id: string;
  name: string;
  code: string;
  description?: string;
  parentId?: string;
  parent?: Entity;
  children?: Entity[];
  isActive: boolean;
  createdAt: string;
  _count?: {
    audits: number;
    observations: number;
  };
}

export default function EntitiesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingEntity, setEditingEntity] = useState<Entity | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    parentId: '',
    isActive: true,
  });

  // Fetch entities as tree
  const { data: entities, isLoading } = useQuery({
    queryKey: ['entities', search],
    queryFn: async () => {
      const response = await entitiesApi.list(true); // tree format
      return response.data?.entities || [];
    },
  });

  // Fetch flat list for parent selection
  const { data: flatEntities } = useQuery({
    queryKey: ['entities-flat'],
    queryFn: async () => {
      const response = await entitiesApi.list(false);
      return response.data?.entities || [];
    },
  });

  // Create entity mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return entitiesApi.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entities'] });
      setShowModal(false);
      resetForm();
      toast.success('Entity created successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create entity');
    },
  });

  // Update entity mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof formData> }) => {
      return entitiesApi.update(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entities'] });
      setShowModal(false);
      setEditingEntity(null);
      resetForm();
      toast.success('Entity updated successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update entity');
    },
  });

  // Delete entity mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return entitiesApi.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entities'] });
      toast.success('Entity deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to delete entity');
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      description: '',
      parentId: '',
      isActive: true,
    });
  };

  const handleEdit = (entity: Entity) => {
    setEditingEntity(entity);
    setFormData({
      name: entity.name,
      code: entity.code,
      description: entity.description || '',
      parentId: entity.parentId || '',
      isActive: entity.isActive,
    });
    setShowModal(true);
  };

  const handleDelete = async (entity: Entity) => {
    if (entity.children && entity.children.length > 0) {
      toast.error('Cannot delete entity with children');
      return;
    }
    if (window.confirm(`Are you sure you want to delete "${entity.name}"?`)) {
      deleteMutation.mutate(entity.id);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingEntity) {
      updateMutation.mutate({ id: editingEntity.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedIds(newExpanded);
  };

  const filterEntities = (entities: Entity[], searchTerm: string): Entity[] => {
    if (!searchTerm) return entities;
    const term = searchTerm.toLowerCase();
    return entities.filter((entity) => {
      const matches = entity.name.toLowerCase().includes(term) || entity.code.toLowerCase().includes(term);
      if (entity.children && entity.children.length > 0) {
        const filteredChildren = filterEntities(entity.children, searchTerm);
        if (filteredChildren.length > 0) return true;
      }
      return matches;
    });
  };

  const renderEntityRow = (entity: Entity, level: number = 0): React.ReactNode => {
    const hasChildren = entity.children && entity.children.length > 0;
    const isExpanded = expandedIds.has(entity.id);

    return (
      <>
        <tr key={entity.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
          <td className="px-6 py-4">
            <div className="flex items-center gap-2" style={{ paddingLeft: `${level * 24}px` }}>
              {hasChildren ? (
                <button
                  onClick={() => toggleExpand(entity.id)}
                  className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                >
                  <ChevronRightIcon
                    className={clsx('h-4 w-4 transition-transform', isExpanded && 'rotate-90')}
                  />
                </button>
              ) : (
                <div className="w-6" />
              )}
              <BuildingOfficeIcon className="h-5 w-5 text-gray-400 dark:text-gray-500" />
              <div>
                <p className="font-medium text-gray-900 dark:text-gray-100">{entity.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{entity.code}</p>
              </div>
            </div>
          </td>
          <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">
            {entity.description || '-'}
          </td>
          <td className="px-6 py-4">
            <span
              className={clsx(
                'badge',
                entity.isActive ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
              )}
            >
              {entity.isActive ? 'Active' : 'Inactive'}
            </span>
          </td>
          <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
            {entity._count?.audits || 0} audits, {entity._count?.observations || 0} observations
          </td>
          <td className="px-6 py-4">
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => handleEdit(entity)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                title="Edit"
              >
                <PencilIcon className="h-5 w-5" />
              </button>
              <button
                onClick={() => handleDelete(entity)}
                className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                title="Delete"
              >
                <TrashIcon className="h-5 w-5" />
              </button>
            </div>
          </td>
        </tr>
        {hasChildren &&
          isExpanded &&
          entity.children!.map((child) => renderEntityRow(child, level + 1))}
      </>
    );
  };

  const filteredEntities = filterEntities(entities || [], search);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Entity Management</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage organizational entities and their hierarchy
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setEditingEntity(null);
            setShowModal(true);
          }}
          className="btn btn-primary"
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          Add Entity
        </button>
      </div>

      {/* Search */}
      <div className="card p-4">
        <div className="relative max-w-md">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search entities..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-10"
          />
        </div>
      </div>

      {/* Entities Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          </div>
        ) : filteredEntities.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-500 dark:text-gray-400">No entities found</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Entity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Usage
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredEntities.map((entity) => renderEntityRow(entity))}
            </tbody>
          </table>
        )}
      </div>

      {/* Entity Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setShowModal(false)} />
            <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                {editingEntity ? 'Edit Entity' : 'Add Entity'}
              </h3>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label">Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input"
                    required
                  />
                </div>

                <div>
                  <label className="label">Code *</label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    className="input"
                    placeholder="e.g., CORP-HQ"
                    required
                  />
                </div>

                <div>
                  <label className="label">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="input"
                    rows={3}
                  />
                </div>

                <div>
                  <label className="label">Parent Entity</label>
                  <select
                    value={formData.parentId}
                    onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
                    className="input"
                  >
                    <option value="">No parent (root entity)</option>
                    {flatEntities
                      ?.filter((e: Entity) => e.id !== editingEntity?.id)
                      .map((entity: Entity) => (
                        <option key={entity.id} value={entity.id}>
                          {entity.name} ({entity.code})
                        </option>
                      ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="h-4 w-4 text-primary-600 rounded"
                  />
                  <label htmlFor="isActive" className="text-sm text-gray-700 dark:text-gray-300">
                    Active
                  </label>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setEditingEntity(null);
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
                      : editingEntity
                      ? 'Update Entity'
                      : 'Create Entity'}
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
