'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  ArrowLeftIcon,
  PencilIcon,
  CalendarIcon,
  UserGroupIcon,
  BuildingOfficeIcon,
  DocumentTextIcon,
  PlusIcon,
  ExclamationTriangleIcon,
  ChartBarIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { auditsApi, observationsApi } from '@/lib/api';
import { useAuthStore, ROLES } from '@/stores/auth';
import clsx from 'clsx';

interface AuditUser {
  id: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  email: string;
}

interface Audit {
  id: string;
  name: string;
  reference: string;
  type: string;
  status: string;
  year: number;
  description?: string;
  scope?: string;
  objectives?: string;
  framework?: string;
  startDate?: string;
  endDate?: string;
  entity?: { id: string; name: string; code: string };
  leadAuditor?: AuditUser;
  auditTeam?: AuditUser[];
  teamMembers?: AuditUser[];
  createdAt: string;
  updatedAt: string;
}

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

const riskColors: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  HIGH: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  MEDIUM: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  LOW: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  INFORMATIONAL: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
};

const obsStatusColors: Record<string, string> = {
  OPEN: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  IN_PROGRESS: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  EVIDENCE_SUBMITTED: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
  UNDER_REVIEW: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  REJECTED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  CLOSED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
};

const statusTransitions: Record<string, { label: string; action: string }[]> = {
  PLANNED: [{ label: 'Start Audit', action: 'IN_PROGRESS' }],
  IN_PROGRESS: [{ label: 'Submit for Review', action: 'UNDER_REVIEW' }],
  UNDER_REVIEW: [
    { label: 'Reopen', action: 'IN_PROGRESS' },
    { label: 'Close Audit', action: 'CLOSED' },
  ],
};

const normalizePaginated = (value: any) => {
  if (!value) return undefined;
  if (Array.isArray(value)) return { data: value, pagination: undefined };
  if (Array.isArray(value?.data)) return value;
  if (Array.isArray(value?.data?.data)) return value.data;
  return value;
};

export default function AuditDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hasAnyRole, hasPermission, user } = useAuthStore();
  const auditId = params.id as string;

  const canEdit = hasAnyRole(ROLES.SYSTEM_ADMIN, ROLES.AUDIT_ADMIN);
  const canAddObservation = hasAnyRole(ROLES.SYSTEM_ADMIN, ROLES.AUDIT_ADMIN, ROLES.AUDITOR);
  const isReviewer = hasAnyRole(ROLES.REVIEWER);
  const canReadAllObservations =
    hasAnyRole(
      ROLES.SYSTEM_ADMIN,
      ROLES.AUDIT_ADMIN,
      ROLES.AUDITOR,
      ROLES.COMPLIANCE_MANAGER,
      ROLES.EXECUTIVE
    ) ||
    hasPermission('observation:read:all') ||
    hasPermission('observation:read:entity') ||
    hasPermission('observation:read:team');

  const [activeTab, setActiveTab] = useState<'overview' | 'observations' | 'team'>('overview');

  // Fetch audit details
  const { data: audit, isLoading, error } = useQuery<Audit>({
    queryKey: ['audit', auditId],
    queryFn: async () => {
      const response = await auditsApi.getById(auditId);
      // API returns { success: true, data: { audit: {...} } }
      return (response.data?.audit || response.data) as Audit;
    },
  });

  // Fetch observations for this audit
  const { data: observationsData, isLoading: observationsLoading } = useQuery({
    queryKey: ['audit-observations', auditId, canReadAllObservations, isReviewer, user?.id],
    queryFn: async () => {
      const response = canReadAllObservations
        ? await observationsApi.list({ auditId, limit: 100 })
        : isReviewer
          ? await observationsApi.list({ auditId, reviewerId: user?.id, limit: 100 })
          : await observationsApi.my({ auditId, limit: 100 });
      return response?.data ?? response;
    },
    enabled: !!auditId && (!!user?.id || canReadAllObservations),
  });

  const { data: auditStatsData } = useQuery({
    queryKey: ['audit-stats', auditId],
    queryFn: async () => {
      const response = await auditsApi.getStats(auditId);
      return response.data?.stats ?? response.data?.data?.stats ?? response.data;
    },
    enabled: !!auditId && canReadAllObservations,
  });

  // Status transition mutation
  const statusMutation = useMutation({
    mutationFn: async (status: string) => {
      return auditsApi.updateStatus(auditId, status);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audit', auditId] });
      toast.success('Audit status updated');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update status');
    },
  });

  // Delete audit mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      return auditsApi.delete(auditId);
    },
    onSuccess: () => {
      toast.success('Audit deleted successfully');
      router.push('/audits');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to delete audit');
    },
  });

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this audit? This action cannot be undone.')) {
      deleteMutation.mutate();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error || !audit) {
    return (
      <div className="text-center py-12">
        <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-red-500 dark:text-red-400" />
        <h3 className="mt-2 text-lg font-medium text-gray-900 dark:text-gray-100">Audit not found</h3>
        <Link href="/audits" className="btn btn-primary mt-4">
          Back to Audits
        </Link>
      </div>
    );
  }

  const normalizedObservations = normalizePaginated(observationsData);
  const observations = normalizedObservations?.data || [];
  const availableTransitions = statusTransitions[audit.status] || [];

  // Calculate stats
  const fallbackStats = {
    total: observations.length,
    open: observations.filter((o: any) => o.status === 'OPEN').length,
    inProgress: observations.filter((o: any) =>
      ['IN_PROGRESS', 'EVIDENCE_SUBMITTED', 'UNDER_REVIEW'].includes(o.status)
    ).length,
    closed: observations.filter((o: any) => o.status === 'CLOSED').length,
    overdue: observations.filter(
      (o: any) => new Date(o.targetDate) < new Date() && o.status !== 'CLOSED'
    ).length,
    critical: observations.filter((o: any) => o.riskRating === 'CRITICAL').length,
    high: observations.filter((o: any) => o.riskRating === 'HIGH').length,
  };

  const stats = canReadAllObservations && auditStatsData
    ? {
        total: auditStatsData.total ?? 0,
        open: auditStatsData.byStatus?.OPEN ?? 0,
        inProgress:
          (auditStatsData.byStatus?.IN_PROGRESS ?? 0) +
          (auditStatsData.byStatus?.EVIDENCE_SUBMITTED ?? 0) +
          (auditStatsData.byStatus?.UNDER_REVIEW ?? 0),
        closed: auditStatsData.byStatus?.CLOSED ?? 0,
        overdue: auditStatsData.overdue ?? 0,
        critical: auditStatsData.byRiskRating?.CRITICAL ?? 0,
        high: auditStatsData.byRiskRating?.HIGH ?? 0,
      }
    : fallbackStats;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Link href="/audits" className="mt-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <ArrowLeftIcon className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{audit.name}</h1>
              <span className={clsx('badge', typeColors[audit.type])}>{audit.type}</span>
              <span className={clsx('badge', statusColors[audit.status])}>
                {audit.status.replace(/_/g, ' ')}
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {audit.year} • Created {new Date(audit.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && audit.status !== 'CLOSED' && audit.status !== 'CANCELLED' && (
            <>
              <Link href={`/audits/${auditId}/edit`} className="btn btn-secondary">
                <PencilIcon className="h-4 w-4 mr-2" />
                Edit
              </Link>
              <button
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="btn btn-secondary text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30"
              >
                <TrashIcon className="h-4 w-4 mr-2" />
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </>
          )}
          {canAddObservation && audit.status === 'IN_PROGRESS' && (
            <Link href={`/observations/new?auditId=${auditId}`} className="btn btn-primary">
              <PlusIcon className="h-4 w-4 mr-2" />
              Add Observation
            </Link>
          )}
        </div>
      </div>

      {/* Status Actions */}
      {canEdit && availableTransitions.length > 0 && (
        <div className="card p-4 bg-gray-50 dark:bg-gray-700/50">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-300">Available actions:</span>
            <div className="flex gap-2">
              {availableTransitions.map((transition) => (
                <button
                  key={transition.action}
                  onClick={() => statusMutation.mutate(transition.action)}
                  disabled={statusMutation.isPending}
                  className="btn btn-primary btn-sm"
                >
                  {transition.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.total}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Total</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.open}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Open</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{stats.inProgress}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">In Progress</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.closed}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Closed</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.overdue}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Overdue</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{stats.critical + stats.high}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">High Risk</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex gap-8">
          <button
            onClick={() => setActiveTab('overview')}
            className={clsx(
              'py-4 px-1 border-b-2 font-medium text-sm',
              activeTab === 'overview'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:border-gray-600'
            )}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('observations')}
            className={clsx(
              'py-4 px-1 border-b-2 font-medium text-sm',
              activeTab === 'observations'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:border-gray-600'
            )}
          >
            Observations ({stats.total})
          </button>
          <button
            onClick={() => setActiveTab('team')}
            className={clsx(
              'py-4 px-1 border-b-2 font-medium text-sm',
              activeTab === 'team'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:border-gray-600'
            )}
          >
            Team
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Description</h2>
              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {audit.description || 'No description provided.'}
              </p>
            </div>

            {/* Scope & Objectives */}
            {(audit.scope || audit.objectives) && (
              <div className="card p-6">
                {audit.scope && (
                  <div className="mb-6">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Scope</h2>
                    <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{audit.scope}</p>
                  </div>
                )}
                {audit.objectives && (
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Objectives</h2>
                    <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{audit.objectives}</p>
                  </div>
                )}
              </div>
            )}

            {/* Risk by Category Chart Placeholder */}
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                <ChartBarIcon className="inline h-5 w-5 mr-2" />
                Observations by Risk Rating
              </h2>
              <div className="space-y-3">
                {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFORMATIONAL'].map((rating) => {
                  const count = observations.filter((o: any) => o.riskRating === rating).length;
                  const percentage = stats.total > 0 ? (count / stats.total) * 100 : 0;
                  return (
                    <div key={rating}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className={clsx('badge', riskColors[rating])}>{rating}</span>
                        <span className="text-gray-600 dark:text-gray-400">{count}</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className={clsx('h-2 rounded-full', {
                            'bg-red-500': rating === 'CRITICAL',
                            'bg-orange-500': rating === 'HIGH',
                            'bg-yellow-500': rating === 'MEDIUM',
                            'bg-green-500': rating === 'LOW',
                            'bg-gray-500': rating === 'INFORMATIONAL',
                          })}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="card p-6">
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-4">Details</h3>
              <dl className="space-y-4">
                {(audit.startDate || audit.endDate) && (
                  <div>
                    <dt className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4" />
                      Audit Period
                    </dt>
                    <dd className="text-sm font-medium text-gray-900 dark:text-gray-100 mt-1">
                      {audit.startDate ? new Date(audit.startDate).toLocaleDateString() : 'N/A'} -{' '}
                      {audit.endDate ? new Date(audit.endDate).toLocaleDateString() : 'N/A'}
                    </dd>
                  </div>
                )}

                {audit.entity && (
                  <div>
                    <dt className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                      <BuildingOfficeIcon className="h-4 w-4" />
                      Entity
                    </dt>
                    <dd className="text-sm font-medium text-gray-900 dark:text-gray-100 mt-1">
                      {audit.entity.name}
                    </dd>
                  </div>
                )}

                {audit.leadAuditor && (
                  <div>
                    <dt className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                      <UserGroupIcon className="h-4 w-4" />
                      Lead Auditor
                    </dt>
                    <dd className="text-sm font-medium text-gray-900 dark:text-gray-100 mt-1">
                      {audit.leadAuditor.displayName ||
                        `${audit.leadAuditor.firstName} ${audit.leadAuditor.lastName}`}
                    </dd>
                  </div>
                )}

                {audit.framework && (
                  <div>
                    <dt className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                      <DocumentTextIcon className="h-4 w-4" />
                      Framework
                    </dt>
                    <dd className="text-sm font-medium text-gray-900 dark:text-gray-100 mt-1">
                      {audit.framework}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'observations' && (
        <div className="card overflow-hidden">
          {observationsLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Loading observations...</p>
            </div>
          ) : observations.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-500 dark:text-gray-400">No observations for this audit</p>
              {canAddObservation && audit.status === 'IN_PROGRESS' && (
                <Link href={`/observations/new?auditId=${auditId}`} className="btn btn-primary mt-4">
                  Add first observation
                </Link>
              )}
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Observation
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Risk
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Owner
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Due Date
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {observations.map((obs: any) => {
                  const isOverdue = new Date(obs.targetDate) < new Date() && obs.status !== 'CLOSED';
                  return (
                    <tr key={obs.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-6 py-4">
                        <Link href={`/observations/${obs.id}`}>
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-primary-600 dark:hover:text-primary-400">
                            {obs.title}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{obs.globalSequence}</p>
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        <span className={clsx('badge', riskColors[obs.riskRating])}>
                          {obs.riskRating}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={clsx('badge', obsStatusColors[obs.status])}>
                          {obs.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                        {obs.owner?.displayName || obs.owner?.firstName
                          ? `${obs.owner.firstName} ${obs.owner.lastName}`
                          : 'Unassigned'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={clsx('text-sm', isOverdue ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-900 dark:text-gray-100')}>
                          {new Date(obs.targetDate).toLocaleDateString()}
                        </span>
                        {isOverdue && <p className="text-xs text-red-500 dark:text-red-400">Overdue</p>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'team' && (
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Audit Team</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {audit.leadAuditor && (
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase mb-2">Lead Auditor</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center">
                    <span className="text-white font-medium">
                      {audit.leadAuditor.firstName?.[0]}
                      {audit.leadAuditor.lastName?.[0]}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {audit.leadAuditor.displayName ||
                        `${audit.leadAuditor.firstName} ${audit.leadAuditor.lastName}`}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{audit.leadAuditor.email}</p>
                  </div>
                </div>
              </div>
            )}

            {audit.teamMembers?.map((member: any) => (
              <div key={member.id} className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase mb-2">Team Member</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-400 dark:bg-gray-600 flex items-center justify-center">
                    <span className="text-white font-medium">
                      {member.firstName?.[0]}
                      {member.lastName?.[0]}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {member.displayName || `${member.firstName} ${member.lastName}`}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{member.email}</p>
                  </div>
                </div>
              </div>
            ))}

            {!audit.leadAuditor && (!audit.teamMembers || audit.teamMembers.length === 0) && (
              <p className="text-gray-500 dark:text-gray-400 col-span-full">No team members assigned</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
