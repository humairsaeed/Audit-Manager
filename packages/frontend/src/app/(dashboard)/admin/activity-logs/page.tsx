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
                <option key={opt} value={opt}>{opt}</option>
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
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-200">
                    <div className="font-medium">
                      {log.user?.firstName || log.userEmail || 'System'} {log.user?.lastName || ''}
                    </div>
                    <div className="text-xs text-slate-500">{log.user?.email || log.userEmail}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-200">
                    <span className="badge bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      {log.action}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                    {log.resource}{log.resourceId ? ` (${log.resourceId})` : ''}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300 max-w-md">
                    <span className="line-clamp-2">{log.description}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">{log.ipAddress || '--'}</td>
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
