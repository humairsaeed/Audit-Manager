'use client';

import { useState } from 'react';
import clsx from 'clsx';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import type { RecommendationsResult, EnhancedRecommendation, StandardMapping } from '@/types/ai-insights';

interface RecommendationsTabProps {
  data: RecommendationsResult;
}

const priorityColors = {
  IMMEDIATE: 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400',
  HIGH: 'text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400',
  MEDIUM: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400',
};

const relevanceColors = {
  HIGH: 'text-green-600 dark:text-green-400',
  MEDIUM: 'text-yellow-600 dark:text-yellow-400',
  LOW: 'text-gray-500 dark:text-gray-400',
};

const standardLabels: Record<string, string> = {
  ISO_27001: 'ISO 27001',
  NIST_CSF: 'NIST CSF',
  SOC2: 'SOC 2',
  CIS_CONTROLS: 'CIS Controls',
};

export function RecommendationsTab({ data }: RecommendationsTabProps) {
  const [expandedRec, setExpandedRec] = useState<number | null>(0);

  return (
    <div className="space-y-5">
      {/* Remediation Priority */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Remediation Priority
        </span>
        <span
          className={clsx(
            'px-3 py-1 rounded-full text-sm font-medium',
            priorityColors[data.remediationPriority]
          )}
        >
          {data.remediationPriority}
        </span>
      </div>

      {/* Enhanced Recommendations */}
      {data.enhancedRecommendations && data.enhancedRecommendations.length > 0 && (
        <div>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Enhanced Recommendations
          </span>
          <div className="mt-2 space-y-2">
            {data.enhancedRecommendations.map((rec: EnhancedRecommendation, index: number) => (
              <div
                key={index}
                className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
              >
                <button
                  onClick={() => setExpandedRec(expandedRec === index ? null : index)}
                  className="w-full p-3 flex items-center justify-between bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100 text-left">
                    Recommendation {index + 1}
                  </span>
                  {expandedRec === index ? (
                    <ChevronUpIcon className="h-4 w-4 text-gray-500" />
                  ) : (
                    <ChevronDownIcon className="h-4 w-4 text-gray-500" />
                  )}
                </button>
                {expandedRec === index && (
                  <div className="p-3 space-y-3 bg-white dark:bg-gray-800/50">
                    {rec.original && (
                      <div>
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                          Original
                        </span>
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 italic">
                          {rec.original || 'Not provided'}
                        </p>
                      </div>
                    )}
                    <div>
                      <span className="text-xs font-medium text-purple-600 dark:text-purple-400 uppercase tracking-wide">
                        Enhanced
                      </span>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100 font-medium">
                        {rec.enhanced}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        Rationale
                      </span>
                      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                        {rec.rationale}
                      </p>
                    </div>
                    {rec.implementationSteps && rec.implementationSteps.length > 0 && (
                      <div>
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                          Implementation Steps
                        </span>
                        <ol className="mt-1 list-decimal list-inside text-sm text-gray-600 dark:text-gray-400 space-y-1">
                          {rec.implementationSteps.map((step: string, stepIndex: number) => (
                            <li key={stepIndex} className="pl-1">{step}</li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mapped Standards */}
      {data.mappedStandards && data.mappedStandards.length > 0 && (
        <div>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Relevant Standards
          </span>
          <div className="mt-2 space-y-2">
            {data.mappedStandards.map((std: StandardMapping, index: number) => (
              <div
                key={index}
                className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {standardLabels[std.standard] || std.standard}
                  </span>
                  <span
                    className={clsx('text-xs font-medium', relevanceColors[std.relevance])}
                  >
                    {std.relevance} relevance
                  </span>
                </div>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-mono text-xs bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded mr-2">
                    {std.clauseRef}
                  </span>
                  {std.clauseName}
                </p>
                {std.complianceGap && (
                  <p className="mt-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded">
                    <span className="font-medium">Gap:</span> {std.complianceGap}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {(!data.enhancedRecommendations || data.enhancedRecommendations.length === 0) &&
       (!data.mappedStandards || data.mappedStandards.length === 0) && (
        <div className="text-center py-6 text-gray-500 dark:text-gray-400">
          <p>No recommendations available.</p>
        </div>
      )}
    </div>
  );
}
