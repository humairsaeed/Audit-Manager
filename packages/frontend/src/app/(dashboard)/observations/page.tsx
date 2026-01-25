'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  PlusIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { observationsApi, entitiesApi, auditsApi } from '@/lib/api';
import { useAuthStore, ROLES } from '@/stores/auth';
import clsx from 'clsx';

const riskColors: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-800',
  HIGH: 'bg-orange-100 text-orange-800',
  MEDIUM: 'bg-yellow-100 text-yellow-800',
  LOW: 'bg-green-100 text-green-800',
  INFORMATIONAL: 'bg-gray-100 text-gray-800',
};

const statusColors: Record<string, string> = {
  OPEN: 'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-purple-100 text-purple-800',
  EVIDENCE_SUBMITTED: 'bg-cyan-100 text-cyan-800',
  UNDER_REVIEW: 'bg-amber-100 text-amber-800',
  REJECTED: 'bg-red-100 text-red-800',
  CLOSED: 'bg-green-100 text-green-800',
  OVERDUE: 'bg-red-100 text-red-800 ring-2 ring-red-500',
};

export default function ObservationsPage() {
  const searchParams = useSearchParams();
  const { hasAnyRole } = useAuthStore();
  const canCreate = hasAnyRole(ROLES.SYSTEM_ADMIN, ROLES.AUDIT_ADMIN, ROLES.AUDITOR);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({
    status: searchParams.get('status') || '',
    riskRating: '',
    auditId: '',
    entityId: '',
  });
  const [showFilters, setShowFilters] = useState(false);

  // Fetch observations
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['observations', page, search, filters],
    queryFn: async () => {
      const params: Record<string, any> = {
        page,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      };

      if (search) params.search = search;
      if (filters.status) params.status = filters.status;
      if (filters.riskRating) params.riskRating = filters.riskRating;
      if (filters.auditId) params.auditId = filters.auditId;
      if (filters.entityId) params.entityId = filters.entityId;

      const response = await observationsApi.list(params);
      return response.data;
    },
  });

  // Fetch filter options
  const { data: entitiesData } = useQuery({
    queryKey: ['entities'],
    queryFn: async () => {
      const response = await entitiesApi.list(true);
      return response.data?.entities || [];
    },
  });

  const { data: auditsData } = useQuery({
    queryKey: ['audits-filter'],
    queryFn: async () => {
      const response = await auditsApi.list({ limit: 100 });
      return response.data?.data || [];
    },
  });

  const observations = data?.data || [];
  const pagination = data?.pagination;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    refetch();
  };

  const clearFilters = () => {
    setFilters({ status: '', riskRating: '', auditId: '', entityId: '' });
    setSearch('');
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Observations</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage and track audit observations across your organization
          </p>
        </div>
        {canCreate && (
          <Link href="/observations/new" className="btn btn-primary">
            <PlusIcon className="h-5 w-5 mr-2" />
            New Observation
          </Link>
        )}
      </div>

      {/* Search and Filters */}
      <div className="card p-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          {/* Search */}
          <form onSubmit={handleSearch} className="flex-1">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search observations..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input pl-10"
              />
            </div>
          </form>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={clsx(
              'btn btn-secondary',
              showFilters && 'bg-primary-50 text-primary-700'
            )}
          >
            <FunnelIcon className="h-5 w-5 mr-2" />
            Filters
            {(filters.status || filters.riskRating || filters.auditId || filters.entityId) && (
              <span className="ml-2 bg-primary-600 text-white text-xs px-2 py-0.5 rounded-full">
                {[filters.status, filters.riskRating, filters.auditId, filters.entityId].filter(Boolean).length}
              </span>
            )}
          </button>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="label">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="input"
              >
                <option value="">All Statuses</option>
                <option value="OPEN">Open</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="EVIDENCE_SUBMITTED">Evidence Submitted</option>
                <option value="UNDER_REVIEW">Under Review</option>
                <option value="REJECTED">Rejected</option>
                <option value="CLOSED">Closed</option>
                <option value="OVERDUE">Overdue</option>
              </select>
            </div>

            <div>
              <label className="label">Risk Rating</label>
              <select
                value={filters.riskRating}
                onChange={(e) => setFilters({ ...filters, riskRating: e.target.value })}
                className="input"
              >
                <option value="">All Ratings</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
                <option value="INFORMATIONAL">Informational</option>
              </select>
            </div>

            <div>
              <label className="label">Audit</label>
              <select
                value={filters.auditId}
                onChange={(e) => setFilters({ ...filters, auditId: e.target.value })}
                className="input"
              >
                <option value="">All Audits</option>
                {auditsData?.map((audit: any) => (
                  <option key={audit.id} value={audit.id}>
                    {audit.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Entity</label>
              <select
                value={filters.entityId}
                onChange={(e) => setFilters({ ...filters, entityId: e.target.value })}
                className="input"
              >
                <option value="">All Entities</option>
                {entitiesData?.map((entity: any) => (
                  <option key={entity.id} value={entity.id}>
                    {entity.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="lg:col-span-4 flex justify-end">
              <button onClick={clearFilters} className="text-sm text-gray-500 hover:text-gray-700">
                Clear all filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Observations Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-2 text-sm text-gray-500">Loading observations...</p>
          </div>
        ) : observations.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-500">No observations found</p>
            {canCreate && (
              <Link href="/observations/new" className="btn btn-primary mt-4">
                Create your first observation
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Observation
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Audit / Entity
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Risk
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Owner
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Due Date
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {observations.map((obs: any) => {
                    const isOverdue = new Date(obs.targetDate) < new Date() && obs.status !== 'CLOSED';

                    return (
                      <tr key={obs.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <Link href={`/observations/${obs.id}`} className="block">
                            <p className="text-sm font-medium text-gray-900 hover:text-primary-600">
                              {obs.title}
                            </p>
                            <p className="text-xs text-gray-500">{obs.globalSequence}</p>
                          </Link>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-gray-900">{obs.audit?.name}</p>
                          <p className="text-xs text-gray-500">{obs.entity?.name || '-'}</p>
                        </td>
                        <td className="px-6 py-4">
                          <span className={clsx('badge', riskColors[obs.riskRating])}>
                            {obs.riskRating}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={clsx('badge', statusColors[obs.status])}>
                            {obs.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {obs.owner ? (
                            <p className="text-sm text-gray-900">
                              {obs.owner.displayName || `${obs.owner.firstName} ${obs.owner.lastName}`}
                            </p>
                          ) : (
                            <span className="text-sm text-gray-400">Unassigned</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <p className={clsx('text-sm', isOverdue ? 'text-red-600 font-medium' : 'text-gray-900')}>
                            {new Date(obs.targetDate).toLocaleDateString()}
                          </p>
                          {isOverdue && <p className="text-xs text-red-500">Overdue</p>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                  {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} results
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(page - 1)}
                    disabled={!pagination.hasPrev}
                    className="btn btn-secondary p-2 disabled:opacity-50"
                  >
                    <ChevronLeftIcon className="h-5 w-5" />
                  </button>
                  <span className="text-sm text-gray-700">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                  <button
                    onClick={() => setPage(page + 1)}
                    disabled={!pagination.hasNext}
                    className="btn btn-secondary p-2 disabled:opacity-50"
                  >
                    <ChevronRightIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
