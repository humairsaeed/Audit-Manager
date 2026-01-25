'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Cog6ToothIcon,
  ClockIcon,
  BellIcon,
  ShieldCheckIcon,
  DocumentTextIcon,
  EnvelopeIcon,
} from '@heroicons/react/24/outline';
import { settingsApi } from '@/lib/api';
import clsx from 'clsx';

interface SystemSettings {
  general: {
    applicationName: string;
    organizationName: string;
    defaultTimezone: string;
    dateFormat: string;
  };
  sla: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    informational: number;
  };
  notifications: {
    emailEnabled: boolean;
    teamsEnabled: boolean;
    reminderDaysBefore: number[];
    overdueReminderFrequency: string;
  };
  security: {
    passwordMinLength: number;
    passwordRequireUppercase: boolean;
    passwordRequireNumbers: boolean;
    passwordRequireSpecial: boolean;
    sessionTimeout: number;
    maxLoginAttempts: number;
  };
  audit: {
    defaultAuditType: string;
    requireApproval: boolean;
    autoCloseThreshold: number;
  };
}

const defaultSettings: SystemSettings = {
  general: {
    applicationName: 'Audit Management System',
    organizationName: '',
    defaultTimezone: 'UTC',
    dateFormat: 'MM/DD/YYYY',
  },
  sla: {
    critical: 7,
    high: 14,
    medium: 30,
    low: 60,
    informational: 90,
  },
  notifications: {
    emailEnabled: true,
    teamsEnabled: false,
    reminderDaysBefore: [7, 3, 1],
    overdueReminderFrequency: 'daily',
  },
  security: {
    passwordMinLength: 12,
    passwordRequireUppercase: true,
    passwordRequireNumbers: true,
    passwordRequireSpecial: true,
    sessionTimeout: 480,
    maxLoginAttempts: 5,
  },
  audit: {
    defaultAuditType: 'INTERNAL',
    requireApproval: true,
    autoCloseThreshold: 0,
  },
};

type SettingsSection = 'general' | 'sla' | 'notifications' | 'security' | 'audit';

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState<SettingsSection>('general');
  const [settings, setSettings] = useState<SystemSettings>(defaultSettings);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch settings
  const { isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const response = await settingsApi.get();
      if (response.data) {
        setSettings({ ...defaultSettings, ...response.data });
      }
      return response.data;
    },
  });

  // Save settings mutation
  const saveMutation = useMutation({
    mutationFn: async (data: SystemSettings) => {
      return settingsApi.update(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      setHasChanges(false);
      toast.success('Settings saved successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to save settings');
    },
  });

  const handleChange = (section: keyof SystemSettings, key: string, value: any) => {
    setSettings((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value,
      },
    }));
    setHasChanges(true);
  };

  const handleSave = () => {
    saveMutation.mutate(settings);
  };

  const sections = [
    { id: 'general', label: 'General', icon: Cog6ToothIcon },
    { id: 'sla', label: 'SLA Configuration', icon: ClockIcon },
    { id: 'notifications', label: 'Notifications', icon: BellIcon },
    { id: 'security', label: 'Security', icon: ShieldCheckIcon },
    { id: 'audit', label: 'Audit Settings', icon: DocumentTextIcon },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Settings</h1>
          <p className="mt-1 text-sm text-gray-500">
            Configure application-wide settings and preferences
          </p>
        </div>
        {hasChanges && (
          <button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="btn btn-primary"
          >
            {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        )}
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-64 flex-shrink-0">
          <nav className="space-y-1">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id as SettingsSection)}
                  className={clsx(
                    'w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors',
                    activeSection === section.id
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-600 hover:bg-gray-50'
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span className="font-medium">{section.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1">
          {/* General Settings */}
          {activeSection === 'general' && (
            <div className="card p-6 space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">General Settings</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="label">Application Name</label>
                  <input
                    type="text"
                    value={settings.general.applicationName}
                    onChange={(e) => handleChange('general', 'applicationName', e.target.value)}
                    className="input"
                  />
                </div>

                <div>
                  <label className="label">Organization Name</label>
                  <input
                    type="text"
                    value={settings.general.organizationName}
                    onChange={(e) => handleChange('general', 'organizationName', e.target.value)}
                    className="input"
                    placeholder="Your Organization"
                  />
                </div>

                <div>
                  <label className="label">Default Timezone</label>
                  <select
                    value={settings.general.defaultTimezone}
                    onChange={(e) => handleChange('general', 'defaultTimezone', e.target.value)}
                    className="input"
                  >
                    <option value="UTC">UTC</option>
                    <option value="America/New_York">Eastern Time</option>
                    <option value="America/Chicago">Central Time</option>
                    <option value="America/Denver">Mountain Time</option>
                    <option value="America/Los_Angeles">Pacific Time</option>
                    <option value="Europe/London">London</option>
                    <option value="Europe/Paris">Paris</option>
                    <option value="Asia/Dubai">Dubai</option>
                    <option value="Asia/Singapore">Singapore</option>
                  </select>
                </div>

                <div>
                  <label className="label">Date Format</label>
                  <select
                    value={settings.general.dateFormat}
                    onChange={(e) => handleChange('general', 'dateFormat', e.target.value)}
                    className="input"
                  >
                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* SLA Settings */}
          {activeSection === 'sla' && (
            <div className="card p-6 space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">SLA Configuration</h2>
              <p className="text-sm text-gray-500">
                Set default remediation timeframes (in days) for each risk rating
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Object.entries(settings.sla).map(([key, value]) => (
                  <div key={key}>
                    <label className="label capitalize">{key} Risk (days)</label>
                    <input
                      type="number"
                      min="1"
                      value={value}
                      onChange={(e) => handleChange('sla', key, parseInt(e.target.value))}
                      className="input"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notification Settings */}
          {activeSection === 'notifications' && (
            <div className="card p-6 space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Notification Settings</h2>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <EnvelopeIcon className="h-6 w-6 text-gray-400" />
                    <div>
                      <p className="font-medium text-gray-900">Email Notifications</p>
                      <p className="text-sm text-gray-500">Send notifications via email</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.notifications.emailEnabled}
                      onChange={(e) =>
                        handleChange('notifications', 'emailEnabled', e.target.checked)
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <svg className="h-6 w-6 text-gray-400" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                    </svg>
                    <div>
                      <p className="font-medium text-gray-900">Microsoft Teams</p>
                      <p className="text-sm text-gray-500">Send notifications to Teams channels</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.notifications.teamsEnabled}
                      onChange={(e) =>
                        handleChange('notifications', 'teamsEnabled', e.target.checked)
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                  </label>
                </div>

                <div>
                  <label className="label">Overdue Reminder Frequency</label>
                  <select
                    value={settings.notifications.overdueReminderFrequency}
                    onChange={(e) =>
                      handleChange('notifications', 'overdueReminderFrequency', e.target.value)
                    }
                    className="input max-w-xs"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="never">Never</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Security Settings */}
          {activeSection === 'security' && (
            <div className="card p-6 space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Security Settings</h2>

              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-4">Password Requirements</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="label">Minimum Length</label>
                      <input
                        type="number"
                        min="8"
                        max="32"
                        value={settings.security.passwordMinLength}
                        onChange={(e) =>
                          handleChange('security', 'passwordMinLength', parseInt(e.target.value))
                        }
                        className="input"
                      />
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={settings.security.passwordRequireUppercase}
                        onChange={(e) =>
                          handleChange('security', 'passwordRequireUppercase', e.target.checked)
                        }
                        className="h-4 w-4 text-primary-600 rounded"
                      />
                      <span className="text-sm text-gray-700">Require uppercase letters</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={settings.security.passwordRequireNumbers}
                        onChange={(e) =>
                          handleChange('security', 'passwordRequireNumbers', e.target.checked)
                        }
                        className="h-4 w-4 text-primary-600 rounded"
                      />
                      <span className="text-sm text-gray-700">Require numbers</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={settings.security.passwordRequireSpecial}
                        onChange={(e) =>
                          handleChange('security', 'passwordRequireSpecial', e.target.checked)
                        }
                        className="h-4 w-4 text-primary-600 rounded"
                      />
                      <span className="text-sm text-gray-700">Require special characters</span>
                    </label>
                  </div>
                </div>

                <div className="border-t pt-6">
                  <h3 className="text-sm font-medium text-gray-900 mb-4">Session & Login</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="label">Session Timeout (minutes)</label>
                      <input
                        type="number"
                        min="5"
                        value={settings.security.sessionTimeout}
                        onChange={(e) =>
                          handleChange('security', 'sessionTimeout', parseInt(e.target.value))
                        }
                        className="input"
                      />
                    </div>
                    <div>
                      <label className="label">Max Login Attempts</label>
                      <input
                        type="number"
                        min="3"
                        max="10"
                        value={settings.security.maxLoginAttempts}
                        onChange={(e) =>
                          handleChange('security', 'maxLoginAttempts', parseInt(e.target.value))
                        }
                        className="input"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Audit Settings */}
          {activeSection === 'audit' && (
            <div className="card p-6 space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Audit Settings</h2>

              <div className="space-y-4">
                <div>
                  <label className="label">Default Audit Type</label>
                  <select
                    value={settings.audit.defaultAuditType}
                    onChange={(e) => handleChange('audit', 'defaultAuditType', e.target.value)}
                    className="input max-w-xs"
                  >
                    <option value="INTERNAL">Internal</option>
                    <option value="EXTERNAL">External</option>
                    <option value="ISO">ISO</option>
                    <option value="SOC">SOC</option>
                    <option value="FINANCIAL">Financial</option>
                    <option value="IT">IT</option>
                    <option value="COMPLIANCE">Compliance</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="requireApproval"
                    checked={settings.audit.requireApproval}
                    onChange={(e) => handleChange('audit', 'requireApproval', e.target.checked)}
                    className="h-4 w-4 text-primary-600 rounded"
                  />
                  <label htmlFor="requireApproval" className="text-sm text-gray-700">
                    Require manager approval for observation closure
                  </label>
                </div>

                <div>
                  <label className="label">
                    Auto-close threshold (days after target date, 0 to disable)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={settings.audit.autoCloseThreshold}
                    onChange={(e) =>
                      handleChange('audit', 'autoCloseThreshold', parseInt(e.target.value))
                    }
                    className="input max-w-xs"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Automatically close observations this many days after their target date
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
