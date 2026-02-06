'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  BellIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  DocumentTextIcon,
  ClockIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { notificationsApi } from '@/lib/api';
import clsx from 'clsx';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  data?: any;
  observationId?: string;
  isRead: boolean;
  createdAt: string;
}

const typeConfig: Record<string, { icon: any; color: string; bgColor: string }> = {
  OBSERVATION_ASSIGNED: {
    icon: DocumentTextIcon,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
  },
  DUE_DATE_REMINDER: {
    icon: ClockIcon,
    color: 'text-amber-600',
    bgColor: 'bg-amber-100',
  },
  OVERDUE_ALERT: {
    icon: ExclamationTriangleIcon,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
  },
  EVIDENCE_SUBMITTED: {
    icon: DocumentTextIcon,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
  },
  EVIDENCE_REJECTED: {
    icon: ExclamationTriangleIcon,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
  },
  EVIDENCE_APPROVED: {
    icon: CheckCircleIcon,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
  },
  OBSERVATION_CLOSED: {
    icon: CheckCircleIcon,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
  },
  REVIEW_REQUIRED: {
    icon: DocumentTextIcon,
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-100',
  },
  STATUS_CHANGED: {
    icon: BellIcon,
    color: 'text-slate-600',
    bgColor: 'bg-slate-100',
  },
  COMMENT_ADDED: {
    icon: DocumentTextIcon,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-100',
  },
};

export default function NotificationsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  // Fetch notifications
  const { data, isLoading } = useQuery({
    queryKey: ['notifications', filter],
    queryFn: async () => {
      const response = await notificationsApi.list({
        unreadOnly: filter === 'unread',
        limit: 50,
      });
      return response.data;
    },
  });

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      return notificationsApi.markAsRead(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-count'] });
    },
  });

  // Mark all as read mutation
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      return notificationsApi.markAllAsRead();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-count'] });
      toast.success('All notifications marked as read');
    },
    onError: () => {
      toast.error('Failed to mark notifications as read');
    },
  });

  const handleNotificationClick = (notification: Notification) => {
    // Mark as read if unread
    if (!notification.isRead) {
      markAsReadMutation.mutate(notification.id);
    }

    // Navigate to observation if available
    if (notification.observationId) {
      router.push(`/observations/${notification.observationId}`);
    }
  };

  const notifications = data?.notifications || [];
  const unreadCount = data?.unreadCount || 0;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
          <p className="mt-1 text-sm text-slate-500">
            {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'All caught up!'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => markAllAsReadMutation.mutate()}
            disabled={markAllAsReadMutation.isPending}
            className="btn btn-secondary"
          >
            <CheckIcon className="h-4 w-4 mr-2" />
            Mark all as read
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <button
          onClick={() => setFilter('all')}
          className={clsx(
            'px-4 py-2 text-sm font-medium rounded-lg',
            filter === 'all'
              ? 'bg-primary-100 text-primary-700'
              : 'text-slate-500 hover:bg-slate-100'
          )}
        >
          All
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={clsx(
            'px-4 py-2 text-sm font-medium rounded-lg',
            filter === 'unread'
              ? 'bg-primary-100 text-primary-700'
              : 'text-slate-500 hover:bg-slate-100'
          )}
        >
          Unread
        </button>
      </div>

      {/* Notifications List */}
      {isLoading ? (
        <div className="card p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
        </div>
      ) : notifications.length === 0 ? (
        <div className="card p-8 text-center">
          <BellIcon className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">
            {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
          </p>
        </div>
      ) : (
        <div className="card divide-y divide-slate-100">
          {notifications.map((notification: Notification) => {
            const config = typeConfig[notification.type] || typeConfig.STATUS_CHANGED;
            const Icon = config.icon;

            return (
              <div
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={clsx(
                  'p-4 flex gap-4 cursor-pointer transition-colors',
                  notification.isRead ? 'bg-white' : 'bg-blue-50',
                  'hover:bg-slate-50'
                )}
              >
                <div className={clsx('p-2 rounded-lg flex-shrink-0', config.bgColor)}>
                  <Icon className={clsx('h-5 w-5', config.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={clsx(
                      'text-sm',
                      notification.isRead ? 'text-slate-900' : 'text-slate-900 font-medium'
                    )}>
                      {notification.title}
                    </p>
                    <span className="text-xs text-slate-500 whitespace-nowrap">
                      {formatDate(notification.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 mt-1 line-clamp-2">
                    {notification.message}
                  </p>
                  {!notification.isRead && (
                    <span className="inline-block mt-2 px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                      New
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

