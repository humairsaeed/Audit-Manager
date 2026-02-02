'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  SparklesIcon,
  CheckBadgeIcon,
  LightBulbIcon,
  DocumentTextIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { aiInsightsApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import type {
  AIInsightResponse,
  AIInsightType,
  ValidationResult,
  RecommendationsResult,
  EvidenceGuidanceResult,
} from '@/types/ai-insights';
import { ValidationTab } from './ai-tabs/ValidationTab';
import { RecommendationsTab } from './ai-tabs/RecommendationsTab';
import { EvidenceGuidanceTab } from './ai-tabs/EvidenceGuidanceTab';

interface AIAssistPanelProps {
  observationId: string;
  className?: string;
}

type TabType = 'validation' | 'recommendations' | 'evidence';

const tabs: { id: TabType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'validation', label: 'Validation', icon: CheckBadgeIcon },
  { id: 'recommendations', label: 'Recommendations', icon: LightBulbIcon },
  { id: 'evidence', label: 'Evidence', icon: DocumentTextIcon },
];

const tabToInsightType: Record<TabType, AIInsightType> = {
  validation: 'VALIDATION',
  recommendations: 'RECOMMENDATIONS',
  evidence: 'EVIDENCE_GUIDANCE',
};

// Roles that can access AI insights
const ALLOWED_ROLES = ['system_admin', 'audit_admin', 'compliance_manager', 'auditor'];

export function AIAssistPanel({ observationId, className }: AIAssistPanelProps) {
  const { hasAnyRole, user } = useAuthStore();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>('validation');
  const [isExpanded, setIsExpanded] = useState(true);

  // Check if user has access
  const hasAccess = user?.roles?.some(r => ALLOWED_ROLES.includes(r.name));

  // Determine user role for AI context
  const userRole = hasAnyRole('auditor', 'audit_admin', 'compliance_manager')
    ? 'AUDITOR'
    : 'AUDITEE';

  // Fetch insights query
  const {
    data: insightResponse,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['ai-insights', observationId, activeTab],
    queryFn: async () => {
      const response = await aiInsightsApi.getInsights(
        observationId,
        [tabToInsightType[activeTab]],
        { userRole }
      );
      return response.data as AIInsightResponse;
    },
    enabled: hasAccess && isExpanded,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });

  // Refresh mutation
  const refreshMutation = useMutation({
    mutationFn: async () => {
      const response = await aiInsightsApi.getInsights(
        observationId,
        [tabToInsightType[activeTab]],
        { forceRefresh: true, userRole }
      );
      return response.data as AIInsightResponse;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['ai-insights', observationId, activeTab], data);
      toast.success('AI insights refreshed');
    },
    onError: () => {
      toast.error('Failed to refresh insights');
    },
  });

  // Don't render if user doesn't have access
  if (!hasAccess) {
    return null;
  }

  const insights = insightResponse?.insights;
  const metadata = insightResponse?.metadata;

  return (
    <div className={clsx('card overflow-hidden', className)}>
      {/* Header */}
      <div
        className="p-4 border-b border-gray-200 dark:border-gray-700 cursor-pointer flex items-center justify-between bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <SparklesIcon className="h-5 w-5 text-purple-500" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            AI Assist
          </h3>
          {metadata?.fromCache && (
            <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
              cached
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              refreshMutation.mutate();
            }}
            disabled={refreshMutation.isPending || isLoading}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-50"
            title="Refresh insights"
          >
            <ArrowPathIcon
              className={clsx('h-5 w-5', {
                'animate-spin': refreshMutation.isPending || isLoading,
              })}
            />
          </button>
          {isExpanded ? (
            <ChevronUpIcon className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDownIcon className="h-5 w-5 text-gray-400" />
          )}
        </div>
      </div>

      {isExpanded && (
        <>
          {/* Disclaimer */}
          <div className="px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800">
            <div className="flex items-start gap-2">
              <InformationCircleIcon className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-700 dark:text-amber-300">
                AI insights are advisory and do not replace auditor judgment.
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200 dark:border-gray-700">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  'flex-1 px-3 py-3 text-sm font-medium flex items-center justify-center gap-1.5 transition-colors',
                  activeTab === tab.id
                    ? 'text-purple-600 dark:text-purple-400 border-b-2 border-purple-600 dark:border-purple-400 bg-purple-50 dark:bg-purple-900/20'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                )}
              >
                <tab.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="p-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                <span className="ml-3 text-gray-500 dark:text-gray-400">
                  Analyzing observation...
                </span>
              </div>
            ) : error ? (
              <div className="text-center py-8">
                <ExclamationTriangleIcon className="mx-auto h-8 w-8 text-red-500" />
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  Failed to load AI insights. Please try again.
                </p>
                <button
                  onClick={() => refetch()}
                  className="mt-2 text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 text-sm font-medium"
                >
                  Retry
                </button>
              </div>
            ) : (
              <>
                {activeTab === 'validation' && insights?.validation && (
                  <ValidationTab data={insights.validation as ValidationResult} />
                )}
                {activeTab === 'recommendations' && insights?.recommendations && (
                  <RecommendationsTab data={insights.recommendations as RecommendationsResult} />
                )}
                {activeTab === 'evidence' && insights?.evidenceGuidance && (
                  <EvidenceGuidanceTab data={insights.evidenceGuidance as EvidenceGuidanceResult} />
                )}
                {!insights && !isLoading && (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <p>No insights available. Click refresh to generate.</p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer with metadata */}
          {metadata && (
            <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50">
              Generated: {new Date(metadata.generatedAt).toLocaleString()} |
              Processing: {metadata.processingTimeMs}ms
            </div>
          )}
        </>
      )}
    </div>
  );
}
