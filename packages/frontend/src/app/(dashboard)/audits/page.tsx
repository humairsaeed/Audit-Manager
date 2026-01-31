'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  PlusIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CalendarIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import { auditsApi, entitiesApi } from '@/lib/api';
import { useAuthStore, ROLES } from '@/stores/auth';
import clsx from 'clsx';

const typeColors: Record<string, string> = {
  INTERNAL: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  EXTERNAL: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  ISO: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
  SOC: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400',
  ISR: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
  FINANCIAL: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  IT: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  COMPLIANCE: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400',
  OPERATIONAL: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  OTHER: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
};

const statusColors: Record<string, string> = {
  PLANNED: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  IN_PROGRESS: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  UNDER_REVIEW: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  CLOSED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  CANCELLED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

export default function AuditsPage() {
  const { hasAnyRole } = useAuthStore();
  const canCreate = hasAnyRole(ROLES.SYSTEM_ADMIN, ROLES.AUDIT_ADMIN);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({
    type: '',
    status: '',
    entityId: '',
    year: '',
  });
  const [showFilters, setShowFilters] = useState(false);

  // Fetch audits
  const { data, isLoading } = useQuery({
    queryKey: ['audits', page, search, filters],
    queryFn: async () => {
      const params: Record<string, any> = {
        page,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      };

      if (search) params.search = search;
      if (filters.type) params.type = filters.type;
      if (filters.status) params.status = filters.status;
      if (filters.entityId) params.entityId = filters.entityId;
      if (filters.year) params.year = filters.year;

      const response = await auditsApi.list(params);
      return response.data;
    },
  });

  // Fetch entities for filter
  const { data: entities } = useQuery({
    queryKey: ['entities'],
    queryFn: async () => {
      const response = await entitiesApi.list(true);
      return response.data?.entities || [];
    },
  });

  const audits = data?.data || [];
  const pagination = data?.pagination;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
  };

  const clearFilters = () => {
    setFilters({ type: '', status: '', entityId: '', year: '' });
    setSearch('');
    setPage(1);
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Audits</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage audit engagements across your organization
          </p>
        </div>
        {canCreate && (
          <Link href="/audits/new" className="btn btn-primary">
            <PlusIcon className="h-5 w-5 mr-2" />
            New Audit
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
                placeholder="Search audits..."
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
            {(filters.type || filters.status || filters.entityId || filters.year) && (
              <span className="ml-2 bg-primary-600 text-white text-xs px-2 py-0.5 rounded-full">
                {[filters.type, filters.status, filters.entityId, filters.year].filter(Boolean).length}
              </span>
            )}
          </button>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="label">Type</label>
              <select
                value={filters.type}
                onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                className="input"
              >
                <option value="">All Types</option>
                <option value="INTERNAL">Internal</option>
                <option value="EXTERNAL">External</option>
                <option value="ISO">ISO</option>
                <option value="SOC">SOC</option>
                <option value="ISR">ISR</option>
                <option value="FINANCIAL">Financial</option>
                <option value="IT">IT</option>
                <option value="COMPLIANCE">Compliance</option>
                <option value="OPERATIONAL">Operational</option>
              </select>
            </div>

            <div>
              <label className="label">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="input"
              >
                <option value="">All Statuses</option>
                <option value="PLANNED">Planned</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="UNDER_REVIEW">Under Review</option>
                <option value="CLOSED">Closed</option>
                <option value="CANCELLED">Cancelled</option>
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
                {entities?.map((entity: any) => (
                  <option key={entity.id} value={entity.id}>
                    {entity.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Year</label>
              <select
                value={filters.year}
                onChange={(e) => setFilters({ ...filters, year: e.target.value })}
                className="input"
              >
                <option value="">All Years</option>
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            <div className="lg:col-span-4 flex justify-end">
              <button onClick={clearFilters} className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">
                Clear all filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Audits Grid */}
      {isLoading ? (
        <div className="card p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Loading audits...</p>
        </div>
      ) : audits.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-gray-500 dark:text-gray-400">No audits found</p>
          {canCreate && (
            <Link href="/audits/new" className="btn btn-primary mt-4">
              Create your first audit
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {audits.map((audit: any) => (
              <Link
                key={audit.id}
                href={`/audits/${audit.id}`}
                className="card p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <span className={clsx('badge', typeColors[audit.type])}>
                    {audit.type}
                  </span>
                  <span className={clsx('badge', statusColors[audit.status])}>
                    {audit.status.replace(/_/g, ' ')}
                  </span>
                </div>

                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2 line-clamp-2">
                  {audit.name}
                </h3>

                {audit.description && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 line-clamp-2">
                    {audit.description}
                  </p>
                )}

                <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                    <span>
                      {audit.periodStart ? new Date(audit.periodStart).toLocaleDateString() : 'N/A'} -{' '}
                      {audit.periodEnd ? new Date(audit.periodEnd).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>

                  {audit.leadAuditor && (
                    <div className="flex items-center gap-2">
                      <UserGroupIcon className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                      <span>
                        {audit.leadAuditor.displayName ||
                          `${audit.leadAuditor.firstName} ${audit.leadAuditor.lastName}`}
                      </span>
                    </div>
                  )}
                </div>

                {/* Stats */}
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                  <div className="text-center">
                    <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {audit.totalObservations ?? audit._count?.observations ?? 0}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Observations</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                      {audit.closedObservations || 0}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Closed</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-semibold text-red-600 dark:text-red-400">
                      {audit.overdueObservations || 0}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Overdue</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500 dark:text-gray-400">
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
                <span className="text-sm text-gray-700 dark:text-gray-300">
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
  );
}
