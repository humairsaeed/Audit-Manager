'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import { observationsApi, auditsApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import clsx from 'clsx';

const riskColors: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  HIGH: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  MEDIUM: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  LOW: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  INFORMATIONAL: 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300',
};

const statusColors: Record<string, string> = {
  OPEN: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  IN_PROGRESS: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  EVIDENCE_SUBMITTED: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
  UNDER_REVIEW: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  REJECTED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  CLOSED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
};

type TabType = 'owned' | 'reviewing' | 'overdue';

const normalizePaginated = (value: any) => {
  if (!value) return undefined;
  if (Array.isArray(value)) return { data: value, pagination: undefined };
  if (Array.isArray(value?.data)) return value;
  if (Array.isArray(value?.data?.data)) return value.data;
  return value;
};

export default function MyObservationsPage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabType>('owned');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    auditId: '',
    riskRating: '',
    status: '',
    dueFrom: '',
    dueTo: '',
    daysRemainingMax: '',
  });

  const { data: auditsData } = useQuery({
    queryKey: ['audits-filter'],
    queryFn: async () => {
      const response = await auditsApi.list({ limit: 100 });
      return response.data?.data || [];
    },
  });

  // Fetch observations owned by user
  const { data: ownedData, isLoading: ownedLoading } = useQuery({
    queryKey: ['my-observations-owned', user?.id, page, search, filters],
    queryFn: async () => {
      const params: Record<string, any> = {
        page,
        limit: 20,
        sortBy: 'targetDate',
        sortOrder: 'asc',
      };
      if (search) params.search = search;
      if (filters.auditId) params.auditId = filters.auditId;
      if (filters.riskRating) params.riskRating = filters.riskRating;
      if (filters.status) params.status = filters.status;
      if (filters.dueFrom) params.dateFrom = filters.dueFrom;
      if (filters.dueTo) params.dateTo = filters.dueTo;
      const response = await observationsApi.my(params);
      // Handle nested response: { success, data: { data: [], pagination: {} } }
      const apiResponse = response as any;
      return apiResponse?.data || apiResponse;
    },
    enabled: !!user?.id,
  });

  // Fetch observations user is reviewing
  const { data: reviewingData, isLoading: reviewingLoading } = useQuery({
    queryKey: ['my-observations-reviewing', user?.id, page, search, filters],
    queryFn: async () => {
      const params: Record<string, any> = {
        reviewerId: user?.id,
        page,
        limit: 20,
        sortBy: 'targetDate',
        sortOrder: 'asc',
      };
      if (search) params.search = search;
      if (filters.auditId) params.auditId = filters.auditId;
      if (filters.riskRating) params.riskRating = filters.riskRating;
      if (filters.status) params.status = filters.status;
      if (filters.dueFrom) params.dateFrom = filters.dueFrom;
      if (filters.dueTo) params.dateTo = filters.dueTo;
      const response = await observationsApi.list(params);
      // Handle nested response: { success, data: { data: [], pagination: {} } }
      const apiResponse = response as any;
      return apiResponse?.data || apiResponse;
    },
    enabled: !!user?.id,
  });

  // Fetch overdue observations owned by user
  const { data: overdueData, isLoading: overdueLoading } = useQuery({
    queryKey: ['my-observations-overdue', user?.id, page, search, filters],
    queryFn: async () => {
      const params: Record<string, any> = {
        overdueOnly: true,
        page,
        limit: 20,
        sortBy: 'targetDate',
        sortOrder: 'asc',
      };
      if (search) params.search = search;
      if (filters.auditId) params.auditId = filters.auditId;
      if (filters.riskRating) params.riskRating = filters.riskRating;
      if (filters.status) params.status = filters.status;
      if (filters.dueFrom) params.dateFrom = filters.dueFrom;
      if (filters.dueTo) params.dateTo = filters.dueTo;
      const response = await observationsApi.my(params);
      // Handle nested response: { success, data: { data: [], pagination: {} } }
      const apiResponse = response as any;
      return apiResponse?.data || apiResponse;
    },
    enabled: !!user?.id,
  });

  const getCurrentData = () => {
    switch (activeTab) {
      case 'owned':
        return { data: ownedData, loading: ownedLoading };
      case 'reviewing':
        return { data: reviewingData, loading: reviewingLoading };
      case 'overdue':
        return { data: overdueData, loading: overdueLoading };
    }
  };

  const { data, loading } = getCurrentData();
  const normalizedData = normalizePaginated(data);
  const observations = normalizedData?.data || [];
  const filteredObservations = observations.filter((obs: any) => {
    if (!filters.daysRemainingMax) return true;
    const targetDate = new Date(obs.targetDate);
    const today = new Date();
    const daysRemaining = Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysRemaining <= Number(filters.daysRemainingMax);
  });
  const pagination = normalizedData?.pagination;

  // Summary counts
  const ownedNormalized = normalizePaginated(ownedData);
  const reviewingNormalized = normalizePaginated(reviewingData);
  const overdueNormalized = normalizePaginated(overdueData);
  const ownedCount = ownedNormalized?.pagination?.total ?? ownedNormalized?.data?.length ?? 0;
  const reviewingCount = reviewingNormalized?.pagination?.total ?? reviewingNormalized?.data?.length ?? 0;
  const overdueCount = overdueNormalized?.pagination?.total ?? overdueNormalized?.data?.length ?? 0;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">My Observations</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Observations assigned to you or pending your review
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={() => { setActiveTab('owned'); setPage(1); }}
          className={clsx(
            'card p-6 text-left transition-all',
            activeTab === 'owned' ? 'ring-2 ring-primary-500' : 'hover:shadow-lg'
          )}
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <ClockIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{ownedCount}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Assigned to Me</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => { setActiveTab('reviewing'); setPage(1); }}
          className={clsx(
            'card p-6 text-left transition-all',
            activeTab === 'reviewing' ? 'ring-2 ring-primary-500' : 'hover:shadow-lg'
          )}
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <CheckCircleIcon className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{reviewingCount}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Pending My Review</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => { setActiveTab('overdue'); setPage(1); }}
          className={clsx(
            'card p-6 text-left transition-all',
            activeTab === 'overdue' ? 'ring-2 ring-primary-500' : 'hover:shadow-lg'
          )}
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <ExclamationTriangleIcon className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{overdueCount}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Overdue</p>
            </div>
          </div>
        </button>
      </div>

      {/* Tab Content Title */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100">
          {activeTab === 'owned' && 'Observations Assigned to Me'}
          {activeTab === 'reviewing' && 'Observations Pending My Review'}
          {activeTab === 'overdue' && 'Overdue Observations'}
        </h2>
      </div>

      {/* Search and Filters */}
      <div className="card p-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setPage(1);
            }}
            className="flex-1"
          >
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search observation..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input pl-10"
              />
            </div>
          </form>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={clsx(
              'btn btn-secondary',
              showFilters && 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
            )}
          >
            <FunnelIcon className="h-5 w-5 mr-2" />
            Filters
            {(filters.auditId || filters.riskRating || filters.status || filters.dueFrom || filters.dueTo || filters.daysRemainingMax) && (
              <span className="ml-2 bg-primary-600 text-white text-xs px-2 py-0.5 rounded-full">
                {[filters.auditId, filters.riskRating, filters.status, filters.dueFrom, filters.dueTo, filters.daysRemainingMax].filter(Boolean).length}
              </span>
            )}
          </button>
        </div>

        {showFilters && (
          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
              <label className="label">Risk</label>
              <select
                value={filters.riskRating}
                onChange={(e) => setFilters({ ...filters, riskRating: e.target.value })}
                className="input"
              >
                <option value="">All Risks</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
                <option value="INFORMATIONAL">Informational</option>
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
              <label className="label">Days Remaining ≤</label>
              <input
                type="number"
                min="0"
                value={filters.daysRemainingMax}
                onChange={(e) => setFilters({ ...filters, daysRemainingMax: e.target.value })}
                className="input"
                placeholder="e.g., 7"
              />
            </div>

            <div>
              <label className="label">Due From</label>
              <input
                type="date"
                value={filters.dueFrom}
                onChange={(e) => setFilters({ ...filters, dueFrom: e.target.value })}
                className="input"
              />
            </div>

            <div>
              <label className="label">Due To</label>
              <input
                type="date"
                value={filters.dueTo}
                onChange={(e) => setFilters({ ...filters, dueTo: e.target.value })}
                className="input"
              />
            </div>

            <div className="lg:col-span-4 flex justify-end">
              <button
                onClick={() => {
                  setFilters({
                    auditId: '',
                    riskRating: '',
                    status: '',
                    dueFrom: '',
                    dueTo: '',
                    daysRemainingMax: '',
                  });
                  setSearch('');
                  setPage(1);
                }}
                className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
              >
                Clear all filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Observations List */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Loading observations...</p>
          </div>
        ) : filteredObservations.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-slate-500 dark:text-slate-400">
              {activeTab === 'owned' && 'No observations assigned to you'}
              {activeTab === 'reviewing' && 'No observations pending your review'}
              {activeTab === 'overdue' && 'No overdue observations'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                <thead className="bg-slate-50 dark:bg-slate-800">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Observation
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Audit
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Risk
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Due Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Days Remaining
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                  {filteredObservations.map((obs: any) => {
                    const targetDate = new Date(obs.targetDate);
                    const today = new Date();
                    const daysRemaining = Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                    const isOverdue = daysRemaining < 0 && obs.status !== 'CLOSED';

                    return (
                      <tr key={obs.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                        <td className="px-6 py-4">
                          <Link href={`/observations/${obs.id}`} className="block">
                            <p className="text-sm font-medium text-slate-900 dark:text-slate-100 hover:text-primary-600">
                              {obs.title}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{obs.globalSequence}</p>
                          </Link>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-slate-900 dark:text-slate-100">{obs.audit?.name}</p>
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
                          <p className={clsx('text-sm', isOverdue ? 'text-red-600 dark:text-red-400 font-medium' : 'text-slate-900 dark:text-slate-100')}>
                            {targetDate.toLocaleDateString()}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          {obs.status === 'CLOSED' ? (
                            <span className="text-sm text-green-600 dark:text-green-400">Completed</span>
                          ) : isOverdue ? (
                            <span className="text-sm text-red-600 dark:text-red-400 font-medium">
                              {Math.abs(daysRemaining)} days overdue
                            </span>
                          ) : (
                            <span className={clsx('text-sm', {
                              'text-red-600 dark:text-red-400 font-medium': daysRemaining <= 3,
                              'text-orange-600 dark:text-orange-400': daysRemaining <= 7,
                              'text-slate-600 dark:text-slate-400': daysRemaining > 7,
                            })}>
                              {daysRemaining} days
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <p className="text-sm text-slate-500 dark:text-slate-400">
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
                  <span className="text-sm text-slate-700 dark:text-slate-300">
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

