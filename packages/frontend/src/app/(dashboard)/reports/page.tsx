'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ChartBarIcon,
  DocumentArrowDownIcon,
  FunnelIcon,
  CalendarIcon,
} from '@heroicons/react/24/outline';
import { dashboardApi, reportsApi } from '@/lib/api';
import clsx from 'clsx';

type ReportType = 'summary' | 'trends' | 'compliance' | 'aging';

const riskColors: Record<string, string> = {
  CRITICAL: '#ef4444',
  HIGH: '#f97316',
  MEDIUM: '#eab308',
  LOW: '#22c55e',
  INFORMATIONAL: '#6b7280',
};

const statusColors: Record<string, string> = {
  OPEN: '#3b82f6',
  IN_PROGRESS: '#8b5cf6',
  EVIDENCE_SUBMITTED: '#06b6d4',
  UNDER_REVIEW: '#f59e0b',
  REJECTED: '#ef4444',
  CLOSED: '#22c55e',
};

export default function ReportsPage() {
  const [activeReport, setActiveReport] = useState<ReportType>('summary');
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });
  const [filters, setFilters] = useState({
    entityId: '',
    auditType: '',
  });

  // Fetch executive summary
  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ['report-summary', dateRange, filters],
    queryFn: async () => {
      const response = await dashboardApi.getExecutiveSummary({
        startDate: dateRange.start,
        endDate: dateRange.end,
        ...filters,
      });
      // Extract nested summary data
      return response.data?.summary || response.data;
    },
    enabled: activeReport === 'summary',
  });

  // Fetch trends data
  const { data: trendsData, isLoading: trendsLoading } = useQuery({
    queryKey: ['report-trends', dateRange],
    queryFn: async () => {
      const response = await dashboardApi.getTrends(6, {
        startDate: dateRange.start,
        endDate: dateRange.end,
      });
      // Extract nested trends data
      return response.data?.trends || response.data;
    },
    enabled: activeReport === 'trends',
  });

  const trendsMonthly = (() => {
    if (!trendsData) return [];
    if (Array.isArray(trendsData.monthly)) return trendsData.monthly;
    if (Array.isArray(trendsData.labels)) {
      return trendsData.labels.map((label: string, index: number) => ({
        month: label,
        created: trendsData.opened?.[index] ?? 0,
        closed: trendsData.closed?.[index] ?? 0,
        overdue: trendsData.overdue?.[index] ?? 0,
      }));
    }
    return [];
  })();

  // Fetch compliance data
  const { data: complianceData, isLoading: complianceLoading } = useQuery({
    queryKey: ['report-compliance', dateRange, filters],
    queryFn: async () => {
      const response = await dashboardApi.getComplianceStatus(filters);
      // Return nested data
      return response.data || { entities: [] };
    },
    enabled: activeReport === 'compliance',
  });

  // Fetch aging report
  const { data: agingData, isLoading: agingLoading } = useQuery({
    queryKey: ['report-aging', filters],
    queryFn: async () => {
      const response = await reportsApi.getAging(filters);
      // Return nested data
      return (response.data || { buckets: [] }) as { buckets: any[] };
    },
    enabled: activeReport === 'aging',
  });

  const handleExport = async (format: 'pdf' | 'excel') => {
    try {
      const response = await reportsApi.export({
        type: activeReport,
        format,
        dateRange,
        filters,
      });

      const contentType = response.headers?.['content-type'] || '';
      if (contentType.includes('application/json')) {
        const text = await response.data.text();
        const payload = JSON.parse(text);
        throw new Error(payload?.message || 'Export failed');
      }

      const blob = response.data;
      const url = window.URL.createObjectURL(blob);
      const header = response.headers?.['content-disposition'] || '';
      const match = header.match(/filename="([^"]+)"/);
      const fileName = match?.[1] || `${activeReport}-report.${format === 'pdf' ? 'pdf' : 'xlsx'}`;

      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const reports = [
    { id: 'summary', label: 'Executive Summary', description: 'High-level overview of observations' },
    { id: 'trends', label: 'Trends Analysis', description: 'Observation trends over time' },
    { id: 'compliance', label: 'Compliance Status', description: 'Compliance metrics by entity' },
    { id: 'aging', label: 'Aging Report', description: 'Open observations by age' },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Reports & Analytics</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Generate insights and export compliance reports
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => handleExport('excel')} className="btn btn-secondary">
            <DocumentArrowDownIcon className="h-5 w-5 mr-2" />
            Export Excel
          </button>
          <button onClick={() => handleExport('pdf')} className="btn btn-primary">
            <DocumentArrowDownIcon className="h-5 w-5 mr-2" />
            Export PDF
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-gray-400" />
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="input"
            />
            <span className="text-gray-500 dark:text-gray-400">to</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="input"
            />
          </div>
          <select
            value={filters.auditType}
            onChange={(e) => setFilters({ ...filters, auditType: e.target.value })}
            className="input"
          >
            <option value="">All Audit Types</option>
            <option value="INTERNAL">Internal</option>
            <option value="EXTERNAL">External</option>
            <option value="ISO">ISO</option>
            <option value="SOC">SOC</option>
            <option value="FINANCIAL">Financial</option>
          </select>
        </div>
      </div>

      {/* Report Type Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {reports.map((report) => (
          <button
            key={report.id}
            onClick={() => setActiveReport(report.id as ReportType)}
            className={clsx(
              'px-4 py-3 rounded-lg text-left min-w-[180px] transition-colors',
              activeReport === report.id
                ? 'bg-primary-100 border-2 border-primary-500 dark:bg-primary-900/50 dark:border-primary-400'
                : 'bg-white border border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:hover:bg-gray-700'
            )}
          >
            <p className={clsx(
              'font-medium',
              activeReport === report.id
                ? 'text-primary-900 dark:text-white'
                : 'text-gray-900 dark:text-gray-100'
            )}>{report.label}</p>
            <p className={clsx(
              'text-xs',
              activeReport === report.id
                ? 'text-primary-600 dark:text-primary-300'
                : 'text-gray-500 dark:text-gray-400'
            )}>{report.description}</p>
          </button>
        ))}
      </div>

      {/* Report Content */}
      <div className="card p-6">
        {/* Executive Summary */}
        {activeReport === 'summary' && (
          <>
            {summaryLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              </div>
            ) : (
              <div className="space-y-8">
                {/* KPI Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg text-center">
                    <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{summaryData?.totalObservations || 0}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Total Observations</p>
                  </div>
                  <div className="p-4 bg-green-50 dark:bg-green-900/30 rounded-lg text-center">
                    <p className="text-3xl font-bold text-green-600 dark:text-green-400">{summaryData?.closedObservations || 0}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Closed</p>
                  </div>
                  <div className="p-4 bg-red-50 dark:bg-red-900/30 rounded-lg text-center">
                    <p className="text-3xl font-bold text-red-600 dark:text-red-400">{summaryData?.overdueObservations || 0}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Overdue</p>
                  </div>
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-center">
                    <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                      {summaryData?.closureRate ? `${summaryData.closureRate.toFixed(1)}%` : '0%'}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Closure Rate</p>
                  </div>
                </div>

                {/* Charts */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Risk Distribution */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Risk Distribution</h3>
                    <div className="space-y-3">
                      {Object.entries(summaryData?.byRisk || {}).map(([risk, count]) => {
                        const total = Object.values(summaryData?.byRisk || {}).reduce((a: number, b: any) => a + b, 0) as number;
                        const percentage = total > 0 ? ((count as number) / total) * 100 : 0;
                        return (
                          <div key={risk}>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="font-medium text-gray-700 dark:text-gray-300">{risk}</span>
                              <span className="text-gray-500 dark:text-gray-400">{count as number} ({percentage.toFixed(1)}%)</span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                              <div
                                className="h-3 rounded-full transition-all"
                                style={{
                                  width: `${percentage}%`,
                                  backgroundColor: riskColors[risk] || '#6b7280',
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Status Distribution */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Status Distribution</h3>
                    <div className="space-y-3">
                      {Object.entries(summaryData?.byStatus || {}).map(([status, count]) => {
                        const total = Object.values(summaryData?.byStatus || {}).reduce((a: number, b: any) => a + b, 0) as number;
                        const percentage = total > 0 ? ((count as number) / total) * 100 : 0;
                        return (
                          <div key={status}>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="font-medium text-gray-700 dark:text-gray-300">{status.replace(/_/g, ' ')}</span>
                              <span className="text-gray-500 dark:text-gray-400">{count as number} ({percentage.toFixed(1)}%)</span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                              <div
                                className="h-3 rounded-full transition-all"
                                style={{
                                  width: `${percentage}%`,
                                  backgroundColor: statusColors[status] || '#6b7280',
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* By Entity */}
                {summaryData?.byEntity && Object.keys(summaryData.byEntity).length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Observations by Entity</h3>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-800">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Entity</th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Total</th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Open</th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Closed</th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Overdue</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                          {Object.entries(summaryData.byEntity).map(([entity, data]: [string, any]) => (
                            <tr key={entity}>
                              <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{entity}</td>
                              <td className="px-4 py-3 text-center text-gray-900 dark:text-gray-100">{data.total}</td>
                              <td className="px-4 py-3 text-center text-blue-600 dark:text-blue-400">{data.open}</td>
                              <td className="px-4 py-3 text-center text-green-600 dark:text-green-400">{data.closed}</td>
                              <td className="px-4 py-3 text-center text-red-600 dark:text-red-400">{data.overdue}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Trends Analysis */}
        {activeReport === 'trends' && (
          <>
            {trendsLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              </div>
            ) : (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Monthly Trends</h3>

                {/* Simple bar chart representation */}
                <div className="overflow-x-auto">
                  <div className="flex items-end gap-2 min-w-max h-64 p-4">
                    {trendsMonthly.map((month: any, index: number) => {
                      const maxCount = Math.max(...(trendsMonthly.map((m: any) => m.created) || [1]));
                      const height = (month.created / maxCount) * 200;
                      return (
                        <div key={index} className="flex flex-col items-center gap-2">
                          <div className="flex gap-1 items-end">
                            <div
                              className="w-8 bg-blue-500 rounded-t"
                              style={{ height: `${height}px` }}
                              title={`Created: ${month.created}`}
                            />
                            <div
                              className="w-8 bg-green-500 rounded-t"
                              style={{ height: `${(month.closed / maxCount) * 200}px` }}
                              title={`Closed: ${month.closed}`}
                            />
                          </div>
                          <span className="text-xs text-gray-500 dark:text-gray-400">{month.month}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex gap-4 justify-center mt-4">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-blue-500 rounded" />
                      <span className="text-sm text-gray-600 dark:text-gray-400">Created</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-green-500 rounded" />
                      <span className="text-sm text-gray-600 dark:text-gray-400">Closed</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Compliance Status */}
        {activeReport === 'compliance' && (
          <>
            {complianceLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {complianceData?.entities?.map((entity: any) => (
                    <div key={entity.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-gray-900 dark:text-gray-100">{entity.name}</h4>
                        <span className={clsx(
                          'badge',
                          entity.complianceRate >= 90 ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                          entity.complianceRate >= 70 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                          'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                        )}>
                          {entity.complianceRate?.toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-2">
                        <div
                          className={clsx(
                            'h-2 rounded-full',
                            entity.complianceRate >= 90 ? 'bg-green-500' :
                            entity.complianceRate >= 70 ? 'bg-yellow-500' :
                            'bg-red-500'
                          )}
                          style={{ width: `${entity.complianceRate}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                        <span>{entity.closedCount} closed</span>
                        <span>{entity.openCount} open</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Aging Report */}
        {activeReport === 'aging' && (
          <>
            {agingLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Age Bucket</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Critical</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">High</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Medium</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Low</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {agingData?.buckets?.map((bucket: any) => (
                        <tr key={bucket.range}>
                          <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{bucket.range}</td>
                          <td className="px-4 py-3 text-center text-red-600 dark:text-red-400">{bucket.critical || 0}</td>
                          <td className="px-4 py-3 text-center text-orange-600 dark:text-orange-400">{bucket.high || 0}</td>
                          <td className="px-4 py-3 text-center text-yellow-600 dark:text-yellow-400">{bucket.medium || 0}</td>
                          <td className="px-4 py-3 text-center text-green-600 dark:text-green-400">{bucket.low || 0}</td>
                          <td className="px-4 py-3 text-center font-medium text-gray-900 dark:text-gray-100">{bucket.total || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
