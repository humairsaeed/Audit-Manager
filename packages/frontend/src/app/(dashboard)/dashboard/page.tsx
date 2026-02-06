'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  ClipboardDocumentListIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  CheckCircleIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  BoltIcon,
  ChartBarIcon,
  PlusIcon,
  ArrowUpTrayIcon,
} from '@heroicons/react/24/outline';
import { dashboardApi, observationsApi } from '@/lib/api';
import { useAuthStore, ROLES } from '@/stores/auth';
import clsx from 'clsx';

const riskColors: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
  HIGH: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800',
  MEDIUM: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800',
  LOW: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800',
  INFORMATIONAL: 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600',
};

const statusColors: Record<string, string> = {
  OPEN: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  IN_PROGRESS: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  EVIDENCE_SUBMITTED: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
  UNDER_REVIEW: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  REJECTED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  CLOSED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  OVERDUE: 'bg-red-100 text-red-800 ring-2 ring-red-500 dark:bg-red-900/30 dark:text-red-400',
};

const riskOrder = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFORMATIONAL'];

type RangeKey = 'today' | 'week' | 'month' | 'custom';

export default function DashboardPage() {
  const { user, hasAnyRole } = useAuthStore();
  const isManager = hasAnyRole(
    ROLES.SYSTEM_ADMIN,
    ROLES.AUDIT_ADMIN,
    ROLES.COMPLIANCE_MANAGER,
    ROLES.EXECUTIVE
  );
  const [range, setRange] = useState<RangeKey>('week');

  const { data: userDashboard, isLoading: userLoading } = useQuery({
    queryKey: ['user-dashboard'],
    queryFn: async () => {
      const response = await dashboardApi.getUserDashboard();
      return response.data?.dashboard;
    },
  });

  const { data: managementDashboard, isLoading: mgmtLoading } = useQuery({
    queryKey: ['management-dashboard'],
    queryFn: async () => {
      const response = await dashboardApi.getManagementDashboard();
      return response.data?.dashboard;
    },
    enabled: isManager,
  });

  const { data: dueSoonData } = useQuery({
    queryKey: ['observations-due-soon'],
    queryFn: async () => {
      const response = await observationsApi.dueSoon(7);
      return response.data?.observations || [];
    },
  });

  const isLoading = userLoading || (isManager && mgmtLoading);
  const myObs = userDashboard?.myObservations;

  const statusSummary = managementDashboard?.byStatus || {};
  const riskSummary = managementDashboard?.byRiskRating || {};
  const totalObservations = managementDashboard?.totalObservations || 0;
  const closedObservations = (statusSummary as any).CLOSED || 0;
  const openObservations = managementDashboard?.openObservations || 0;
  const overdueObservations = managementDashboard?.overdueObservations || 0;
  const slaCompliance = managementDashboard?.slaCompliance ?? null;

  const topHighRisk = useMemo(() => {
    if (!dueSoonData) return [];
    return [...dueSoonData]
      .sort((a: any, b: any) => riskOrder.indexOf(a.riskRating) - riskOrder.indexOf(b.riskRating))
      .slice(0, 5);
  }, [dueSoonData]);

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 bg-slate-200 dark:bg-slate-700 rounded-lg" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-64 bg-slate-200 dark:bg-slate-700 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const roleLabel = user?.roles?.map((r) => r.displayName).join(', ') || 'Team Member';

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
            Welcome back, {user?.firstName}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {roleLabel} dashboard. Review priorities and act on items due soon.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <RangeSelector value={range} onChange={setRange} />
          <div className="flex items-center gap-2">
            <Link href="/observations/new" className="btn btn-primary">
              <PlusIcon className="h-4 w-4 mr-2" />
              Create Observation
            </Link>
            {hasAnyRole(ROLES.SYSTEM_ADMIN, ROLES.AUDIT_ADMIN) && (
              <Link href="/import" className="btn btn-secondary">
                <ArrowUpTrayIcon className="h-4 w-4 mr-2" />
                Import
              </Link>
            )}
            <Link href="/reports" className="btn btn-secondary">
              <ChartBarIcon className="h-4 w-4 mr-2" />
              Reports
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <KpiCard title="My Assigned" value={myObs?.total || 0} icon={ClipboardDocumentListIcon} href="/observations/my" />
        <KpiCard title="Overdue" value={myObs?.overdue || 0} icon={ExclamationTriangleIcon} danger href="/observations/my?status=OVERDUE" />
        <KpiCard title="Due This Week" value={myObs?.dueThisWeek || 0} icon={ClockIcon} href="/observations/my" />
        <KpiCard title="Pending Reviews" value={userDashboard?.pendingReviews || 0} icon={CheckCircleIcon} href="/observations?status=EVIDENCE_SUBMITTED" />
        <KpiCard title="SLA Breach Risk" value={overdueObservations} icon={BoltIcon} danger />
        <KpiCard title="Avg Closure Time" value={managementDashboard?.avgClosureDays ? `${managementDashboard.avgClosureDays}d` : '--'} icon={ChartBarIcon} />
      </div>

      {/* Organization Overview */}
      {isManager && (
        <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="card p-6 xl:col-span-2">
            <SectionHeader title="Compliance Health" subtitle="Organization snapshot" />
            <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
              <MetricCard title="Total Observations" value={totalObservations} />
              <MetricCard title="Open vs Closed" value={`${openObservations} / ${closedObservations}`} />
              <MetricCard title="Overdue Observations" value={overdueObservations} />
              <MetricCard title="SLA Compliance" value={slaCompliance !== null ? `${slaCompliance}%` : '--'} />
            </div>
            <div className="mt-6 space-y-3">
              <ProgressRow label="Open ratio" value={totalObservations ? (openObservations / totalObservations) * 100 : 0} />
              <ProgressRow label="Closed ratio" value={totalObservations ? (closedObservations / totalObservations) * 100 : 0} />
            </div>
          </div>
          <div className="card p-6">
            <SectionHeader title="Risk Exposure" subtitle="High impact focus" />
            <div className="mt-6 space-y-3">
              {riskOrder.map((rating) => (
                <div key={rating} className="flex items-center justify-between">
                  <span className={clsx('badge', riskColors[rating])}>{rating}</span>
                  <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {(riskSummary as any)[rating] || 0}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Risk & Priority Insights */}
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="card p-6">
          <SectionHeader title="Observations by Status" subtitle="Workflow distribution" />
          <div className="mt-6 space-y-3">
            {Object.entries(statusSummary)
              .filter(([_, count]) => (count as number) > 0)
              .map(([status, count]) => (
                <div key={status} className="flex items-center justify-between">
                  <span className={clsx('badge', statusColors[status])}>
                    {status.replace(/_/g, ' ')}
                  </span>
                  <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{count as number}</span>
                </div>
              ))}
            {Object.keys(statusSummary).length === 0 && (
              <EmptyState message="No workflow data available." />
            )}
          </div>
        </div>

        <div className="card p-6">
          <SectionHeader title="Aging Buckets" subtitle="Days since open" />
          <div className="mt-6 space-y-3">
            <AgingRow label="0-7 days" value={(managementDashboard as any)?.aging?.['0_7'] || 0} />
            <AgingRow label="8-15 days" value={(managementDashboard as any)?.aging?.['8_15'] || 0} />
            <AgingRow label="16-30 days" value={(managementDashboard as any)?.aging?.['16_30'] || 0} />
            <AgingRow label="30+ days" value={(managementDashboard as any)?.aging?.['30_plus'] || 0} />
          </div>
        </div>

        <div className="card p-6">
          <SectionHeader title="Top High-Risk Observations" subtitle="Priority list" />
          <div className="mt-6 space-y-4">
            {topHighRisk.length === 0 && <EmptyState message="No high-risk items due soon." />}
            {topHighRisk.map((obs: any) => (
              <Link
                key={obs.id}
                href={`/observations/${obs.id}`}
                className="block rounded-md border border-slate-200 dark:border-slate-800 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 line-clamp-1">
                      {obs.title}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {obs.audit?.name || 'Unassigned'}
                    </p>
                  </div>
                  <span className={clsx('badge', riskColors[obs.riskRating])}>{obs.riskRating}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Actionable Sections */}
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-4">
        <ActionList
          title="Immediate Action"
          items={dueSoonData?.filter((obs: any) => obs.isOverdue) || []}
          emptyMessage="No critical items right now."
        />
        <ActionList
          title="Upcoming Due"
          items={dueSoonData?.slice(0, 5) || []}
          emptyMessage="No upcoming due items."
        />
        <ActionList
          title="Waiting on Others"
          items={(userDashboard?.waitingOnOthers || []).slice(0, 5)}
          emptyMessage="No items waiting on others."
        />
        <ActionList
          title="Recently Closed"
          items={(userDashboard?.recentlyClosed || []).slice(0, 5)}
          emptyMessage="No recently closed items."
        />
      </section>

      {/* Executive Summary */}
      {isManager && (
        <section className="card p-6">
          <div className="flex items-center justify-between">
            <SectionHeader title="Executive Summary" subtitle="Leadership overview" />
            <button
              className="btn btn-secondary"
              onClick={() => setRange((prev) => (prev === 'month' ? 'week' : 'month'))}
            >
              Toggle 30/7 day view
            </button>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-4">
            <MetricCard title="Compliance Score" value={slaCompliance !== null ? `${slaCompliance}%` : '--'} />
            <MetricCard title="SLA Trend" value={(managementDashboard as any)?.slaTrend || '--'} />
            <MetricCard title="Risk Exposure" value={(managementDashboard as any)?.riskExposure || '--'} />
            <MetricCard title="Closed vs Created" value={(managementDashboard as any)?.closedVsCreated || '--'} />
          </div>
        </section>
      )}
    </div>
  );
}

function RangeSelector({ value, onChange }: { value: RangeKey; onChange: (value: RangeKey) => void }) {
  const ranges: { key: RangeKey; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'week', label: 'This Week' },
    { key: 'month', label: 'This Month' },
    { key: 'custom', label: 'Custom' },
  ];
  return (
    <div className="flex items-center rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-1 py-1">
      {ranges.map((range) => (
        <button
          key={range.key}
          onClick={() => onChange(range.key)}
          className={clsx(
            'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
            value === range.key
              ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          )}
        >
          {range.label}
        </button>
      ))}
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
      {subtitle && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
    </div>
  );
}

function ProgressRow({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span>{label}</span>
        <span>{Math.round(value)}%</span>
      </div>
      <div className="mt-2 h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className="h-2 rounded-full bg-primary-500"
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </div>
  );
}

function MetricCard({ title, value }: { title: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">{value}</p>
    </div>
  );
}

function KpiCard({
  title,
  value,
  icon: Icon,
  href,
  danger,
  trend,
}: {
  title: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
  danger?: boolean;
  trend?: { value: number; isPositive: boolean };
}) {
  const Card = href ? Link : 'div';
  const props = href ? { href } : {};
  return (
    <Card
      {...(props as any)}
      className={clsx(
        'rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 transition-colors',
        href && 'hover:border-slate-300 dark:hover:border-slate-700'
      )}
    >
      <div className="flex items-center justify-between">
        <div className={clsx('rounded-md p-2', danger ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300')}>
          <Icon className="h-5 w-5" />
        </div>
        {trend && (
          <div className={clsx('flex items-center text-xs font-medium', trend.isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
            {trend.isPositive ? <ArrowTrendingUpIcon className="h-4 w-4 mr-1" /> : <ArrowTrendingDownIcon className="h-4 w-4 mr-1" />}
            {trend.value}%
          </div>
        )}
      </div>
      <div className="mt-3">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{title}</p>
        <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">{value}</p>
      </div>
    </Card>
  );
}

function AgingRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-slate-600 dark:text-slate-300">{label}</span>
      <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{value}</span>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return <p className="text-sm text-slate-500 dark:text-slate-400">{message}</p>;
}

function ActionList({
  title,
  items,
  emptyMessage,
}: {
  title: string;
  items: any[];
  emptyMessage: string;
}) {
  return (
    <div className="card p-6">
      <SectionHeader title={title} subtitle="Next steps" />
      <div className="mt-4 space-y-3">
        {items.length === 0 && <EmptyState message={emptyMessage} />}
        {items.map((item) => (
          <Link
            key={item.id}
            href={`/observations/${item.id}`}
            className="block rounded-md border border-slate-200 dark:border-slate-800 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100 line-clamp-1">{item.title}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {item.audit?.name || 'Unassigned'}
                </p>
              </div>
              {item.riskRating && (
                <span className={clsx('badge', riskColors[item.riskRating])}>{item.riskRating}</span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
