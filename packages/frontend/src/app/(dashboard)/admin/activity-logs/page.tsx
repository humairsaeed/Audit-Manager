'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { MagnifyingGlassIcon, FunnelIcon } from '@heroicons/react/24/outline';
import { auditLogsApi } from '@/lib/api';
import { useAuthStore, ROLES } from '@/stores/auth';
import clsx from 'clsx';

const actionOptions = [
  'CREATE',
  'UPDATE',
  'DELETE',
  'LOGIN',
  'LOGOUT',
  'STATUS_CHANGE',
  'ASSIGNMENT',
  'EVIDENCE_UPLOAD',
  'EXPORT',
  'IMPORT',
  'PERMISSION_CHANGE',
];

const actionLabels: Record<string, string> = {
  CREATE: 'Created',
  UPDATE: 'Updated',
  DELETE: 'Deleted',
  LOGIN: 'Login',
  LOGOUT: 'Logout',
  STATUS_CHANGE: 'Status Change',
  ASSIGNMENT: 'Assignment',
  EVIDENCE_UPLOAD: 'Evidence Upload',
  EXPORT: 'Export',
  IMPORT: 'Import',
  PERMISSION_CHANGE: 'Permission Change',
};

const actionColors: Record<string, string> = {
  CREATE: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  UPDATE: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  DELETE: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  LOGIN: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  LOGOUT: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
  STATUS_CHANGE: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  ASSIGNMENT: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  EVIDENCE_UPLOAD: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  EXPORT: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  IMPORT: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  PERMISSION_CHANGE: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
};

const resourceLabels: Record<string, string> = {
  observations: 'Observation',
  audits: 'Audit',
  users: 'User',
  evidence: 'Evidence',
  session: 'Session',
  comments: 'Comment',
  status: 'Status',
  team: 'Team',
  documents: 'Document',
  import_job: 'Import',
  user_role: 'User Role',
  'follow-up': 'Follow-up',
  'review-cycle': 'Review Cycle',
  insights: 'AI Insight',
};

function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined) return '(empty)';
  if (typeof value === 'string') {
    if (value.length > 80) return value.substring(0, 80) + '...';
    return value;
  }
  if (value instanceof Date || (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value as string))) {
    try {
      return new Date(value as string).toLocaleDateString();
    } catch {
      return String(value);
    }
  }
  if (Array.isArray(value)) return value.join(', ');
  return String(value);
}

function ChangeDetails({ log }: { log: any }) {
  const changes = log.previousValue;

  // If previousValue contains change details (from/to format)
  if (changes && typeof changes === 'object' && !Array.isArray(changes)) {
    const entries = Object.entries(changes);
    const isChangeFormat = entries.length > 0 && entries.every(([, v]: [string, any]) =>
      v && typeof v === 'object' && 'from' in v && 'to' in v
    );

    if (isChangeFormat) {
      return (
        <div className="mt-1 space-y-1">
          {entries.map(([field, change]: [string, any]) => (
            <div key={field} className="text-xs">
              <span className="font-medium text-slate-600 dark:text-slate-300 capitalize">{field}:</span>{' '}
              <span className="text-red-500 line-through">{formatFieldValue(change.from)}</span>{' '}
              <span className="text-slate-400">&rarr;</span>{' '}
              <span className="text-green-600 dark:text-green-400">{formatFieldValue(change.to)}</span>
            </div>
          ))}
        </div>
      );
    }
  }

  return null;
}

export default function ActivityLogsPage() {
  const router = useRouter();
  const { hasAnyRole } = useAuthStore();
  const canAccess = hasAnyRole(ROLES.SYSTEM_ADMIN, ROLES.AUDIT_ADMIN);

  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');
  const [resource, setResource] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!canAccess) {
      router.replace('/dashboard');
    }
  }, [canAccess, router]);

  const params = useMemo(() => ({
    page,
    limit: 25,
    search: search || undefined,
    action: action || undefined,
    resource: resource || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  }), [page, search, action, resource, dateFrom, dateTo]);

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', params],
    queryFn: async () => {
      const response = await auditLogsApi.list(params);
      return response.data;
    },
    enabled: canAccess,
  });

  if (!canAccess) return null;

  const logs = data?.data || [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Activity Logs</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Audit trail of all platform changes and security events.
        </p>
      </div>

      <div className="card p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
          <div className="md:col-span-2">
            <label className="label">Search</label>
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="input pl-9"
                placeholder="User, resource, description..."
              />
            </div>
          </div>
          <div>
            <label className="label">Action</label>
            <select
              value={action}
              onChange={(e) => { setAction(e.target.value); setPage(1); }}
              className="input"
            >
              <option value="">All</option>
              {actionOptions.map((opt) => (
                <option key={opt} value={opt}>{actionLabels[opt] || opt}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Resource</label>
            <input
              value={resource}
              onChange={(e) => { setResource(e.target.value); setPage(1); }}
              className="input"
              placeholder="observations, audits..."
            />
          </div>
          <div>
            <label className="label">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
              className="input"
            />
          </div>
          <div>
            <label className="label">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
              className="input"
            />
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <FunnelIcon className="h-4 w-4" />
            Showing {logs.length} of {pagination?.total || 0}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
            <thead className="bg-slate-50 dark:bg-slate-900/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Time</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">User</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Action</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Resource</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Description</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
              {isLoading && (
                <tr>
                  <td className="px-6 py-6 text-sm text-slate-500" colSpan={6}>Loading...</td>
                </tr>
              )}
              {!isLoading && logs.length === 0 && (
                <tr>
                  <td className="px-6 py-6 text-sm text-slate-500" colSpan={6}>No activity logs found.</td>
                </tr>
              )}
              {!isLoading && logs.map((log: any) => (
                <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-200">
                    <div className="font-medium">
                      {log.user?.firstName || log.userEmail || 'System'} {log.user?.lastName || ''}
                    </div>
                    <div className="text-xs text-slate-500">{log.user?.email || log.userEmail}</div>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className={clsx(
                      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                      actionColors[log.action] || 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    )}>
                      {actionLabels[log.action] || log.action}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                    <div className="font-medium">
                      {resourceLabels[log.resource] || log.resource}
                    </div>
                    {log.resourceName && (
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 max-w-[200px] truncate" title={log.resourceName}>
                        {log.resourceName}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300 max-w-md">
                    <div className="line-clamp-2">{log.description}</div>
                    <ChangeDetails log={log} />
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500 whitespace-nowrap">{log.ipAddress || '--'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-800">
          <p className="text-xs text-slate-500">
            Page {pagination?.page || 1} of {pagination?.totalPages || 1}
          </p>
          <div className="flex items-center gap-2">
            <button
              className="btn btn-secondary"
              disabled={!pagination?.hasPrev}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            >
              Previous
            </button>
            <button
              className="btn btn-secondary"
              disabled={!pagination?.hasNext}
              onClick={() => setPage((prev) => prev + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
