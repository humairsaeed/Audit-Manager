'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  ClipboardDocumentListIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  CheckCircleIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
} from '@heroicons/react/24/outline';
import { dashboardApi, observationsApi } from '@/lib/api';
import { useAuthStore, ROLES } from '@/stores/auth';
import clsx from 'clsx';

const riskColors: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-800 border-red-200',
  HIGH: 'bg-orange-100 text-orange-800 border-orange-200',
  MEDIUM: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  LOW: 'bg-green-100 text-green-800 border-green-200',
  INFORMATIONAL: 'bg-gray-100 text-gray-800 border-gray-200',
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

export default function DashboardPage() {
  const { user, hasAnyRole } = useAuthStore();
  const isManager = hasAnyRole(ROLES.SYSTEM_ADMIN, ROLES.AUDIT_ADMIN, ROLES.COMPLIANCE_MANAGER, ROLES.EXECUTIVE);

  // Fetch user dashboard
  const { data: userDashboard, isLoading: userLoading } = useQuery({
    queryKey: ['user-dashboard'],
    queryFn: async () => {
      const response = await dashboardApi.getUserDashboard();
      return response.data?.dashboard;
    },
  });

  // Fetch management dashboard (for managers only)
  const { data: managementDashboard, isLoading: mgmtLoading } = useQuery({
    queryKey: ['management-dashboard'],
    queryFn: async () => {
      const response = await dashboardApi.getManagementDashboard();
      return response.data?.dashboard;
    },
    enabled: isManager,
  });

  // Fetch due soon observations
  const { data: dueSoonData } = useQuery({
    queryKey: ['observations-due-soon'],
    queryFn: async () => {
      const response = await observationsApi.dueSoon(7);
      return response.data?.observations || [];
    },
  });

  const isLoading = userLoading || (isManager && mgmtLoading);

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-gray-200 rounded w-1/4"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  const myObs = userDashboard?.myObservations;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {user?.firstName}!
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Here's what's happening with your observations today.
        </p>
      </div>

      {/* My Observations Stats */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">My Observations</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Total Assigned"
            value={myObs?.total || 0}
            icon={ClipboardDocumentListIcon}
            color="blue"
            href="/observations/my"
          />
          <StatCard
            title="Overdue"
            value={myObs?.overdue || 0}
            icon={ExclamationTriangleIcon}
            color="red"
            href="/observations/my?status=OVERDUE"
          />
          <StatCard
            title="Due This Week"
            value={myObs?.dueThisWeek || 0}
            icon={ClockIcon}
            color="amber"
            href="/observations/my"
          />
          <StatCard
            title="Pending Reviews"
            value={userDashboard?.pendingReviews || 0}
            icon={CheckCircleIcon}
            color="purple"
            href="/observations?status=EVIDENCE_SUBMITTED"
          />
        </div>
      </div>

      {/* Management Dashboard (for managers) */}
      {isManager && managementDashboard && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Organization Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              title="Total Observations"
              value={managementDashboard.totalObservations}
              icon={ClipboardDocumentListIcon}
              color="gray"
            />
            <StatCard
              title="Open"
              value={managementDashboard.openObservations}
              icon={ExclamationTriangleIcon}
              color="blue"
            />
            <StatCard
              title="Overdue"
              value={managementDashboard.overdueObservations}
              icon={ClockIcon}
              color="red"
            />
            <StatCard
              title="SLA Compliance"
              value={`${managementDashboard.slaCompliance}%`}
              icon={CheckCircleIcon}
              color={managementDashboard.slaCompliance >= 80 ? 'green' : 'amber'}
            />
          </div>

          {/* Risk Distribution */}
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card p-6">
              <h3 className="text-sm font-medium text-gray-500 mb-4">By Risk Rating</h3>
              <div className="space-y-3">
                {Object.entries(managementDashboard.byRiskRating || {}).map(([rating, count]) => (
                  <div key={rating} className="flex items-center justify-between">
                    <div className="flex items-center">
                      <span className={clsx('badge', riskColors[rating])}>{rating}</span>
                    </div>
                    <span className="text-sm font-medium text-gray-900">{count as number}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-6">
              <h3 className="text-sm font-medium text-gray-500 mb-4">By Status</h3>
              <div className="space-y-3">
                {Object.entries(managementDashboard.byStatus || {})
                  .filter(([_, count]) => (count as number) > 0)
                  .map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between">
                      <div className="flex items-center">
                        <span className={clsx('badge', statusColors[status])}>
                          {status.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-gray-900">{count as number}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Due Soon List */}
      {dueSoonData && dueSoonData.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Due This Week</h2>
            <Link href="/observations/my" className="text-sm text-primary-600 hover:text-primary-700">
              View all →
            </Link>
          </div>
          <div className="card overflow-hidden">
            <ul className="divide-y divide-gray-200">
              {dueSoonData.slice(0, 5).map((obs: any) => (
                <li key={obs.id}>
                  <Link
                    href={`/observations/${obs.id}`}
                    className="block hover:bg-gray-50 px-6 py-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{obs.title}</p>
                        <p className="text-sm text-gray-500">
                          {obs.audit?.name} • {obs.entity?.name}
                        </p>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className={clsx('badge', riskColors[obs.riskRating])}>
                          {obs.riskRating}
                        </span>
                        <span className="text-sm text-gray-500">
                          Due: {new Date(obs.targetDate).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Recent Activity */}
      {userDashboard?.recentActivity && userDashboard.recentActivity.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
          <div className="card overflow-hidden">
            <ul className="divide-y divide-gray-200">
              {userDashboard.recentActivity.slice(0, 10).map((activity: any) => (
                <li key={activity.id} className="px-6 py-4">
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0">
                      <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center">
                        <ClipboardDocumentListIcon className="h-4 w-4 text-gray-500" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900">{activity.description}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(activity.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  color: 'blue' | 'green' | 'red' | 'amber' | 'purple' | 'gray';
  href?: string;
  trend?: { value: number; isPositive: boolean };
}

function StatCard({ title, value, icon: Icon, color, href, trend }: StatCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-600',
    amber: 'bg-amber-50 text-amber-600',
    purple: 'bg-purple-50 text-purple-600',
    gray: 'bg-gray-50 text-gray-600',
  };

  const Card = href ? Link : 'div';
  const props = href ? { href } : {};

  return (
    <Card
      {...(props as any)}
      className={clsx(
        'card p-6 transition-shadow',
        href && 'hover:shadow-md cursor-pointer'
      )}
    >
      <div className="flex items-center justify-between">
        <div className={clsx('p-3 rounded-lg', colorClasses[color])}>
          <Icon className="h-6 w-6" />
        </div>
        {trend && (
          <div
            className={clsx(
              'flex items-center text-sm font-medium',
              trend.isPositive ? 'text-green-600' : 'text-red-600'
            )}
          >
            {trend.isPositive ? (
              <ArrowTrendingUpIcon className="h-4 w-4 mr-1" />
            ) : (
              <ArrowTrendingDownIcon className="h-4 w-4 mr-1" />
            )}
            {trend.value}%
          </div>
        )}
      </div>
      <div className="mt-4">
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <p className="mt-1 text-3xl font-bold text-gray-900">{value}</p>
      </div>
    </Card>
  );
}
