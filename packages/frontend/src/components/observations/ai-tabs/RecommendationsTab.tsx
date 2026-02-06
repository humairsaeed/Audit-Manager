'use client';

import { useState } from 'react';
import clsx from 'clsx';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import type { RecommendationsResult, EnhancedRecommendation, StandardMapping, StandardsBasedRecommendation, ComplianceRoadmapItem } from '@/types/ai-insights';
import { ShieldCheckIcon, MapIcon, ChartBarIcon } from '@heroicons/react/24/outline';

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
  LOW: 'text-slate-500 dark:text-slate-400',
};

const standardLabels: Record<string, string> = {
  ISO_27001: 'ISO 27001:2022',
  NIST_CSF: 'NIST CSF 2.0',
  SOC2: 'SOC 2',
  CIS_CONTROLS: 'CIS Controls v8',
};

const standardColors: Record<string, string> = {
  ISO_27001: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  NIST_CSF: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  SOC2: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  CIS_CONTROLS: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
};

const complianceStatusColors = {
  COMPLIANT: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  PARTIAL: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  NON_COMPLIANT: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  NOT_APPLICABLE: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400',
};

const standardsPriorityColors: Record<string, string> = {
  IMMEDIATE: 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400',
  HIGH: 'text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400',
  MEDIUM: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400',
  LOW: 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400',
};

export function RecommendationsTab({ data }: RecommendationsTabProps) {
  const [expandedRec, setExpandedRec] = useState<number | null>(0);
  const [expandedStdRec, setExpandedStdRec] = useState<number | null>(null);

  return (
    <div className="space-y-5">
      {/* Remediation Priority */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
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

      {/* Overall Compliance Score */}
      {data.overallComplianceScore !== undefined && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <ChartBarIcon className="h-5 w-5 text-purple-500" />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Overall Compliance Score
              </span>
            </div>
            <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {data.overallComplianceScore}/100
            </span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5">
            <div
              className={clsx('h-2.5 rounded-full transition-all duration-500', {
                'bg-red-500': data.overallComplianceScore < 40,
                'bg-yellow-500': data.overallComplianceScore >= 40 && data.overallComplianceScore < 70,
                'bg-green-500': data.overallComplianceScore >= 70,
              })}
              style={{ width: `${data.overallComplianceScore}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Estimated compliance level across all relevant standards
          </p>
        </div>
      )}

      {/* Enhanced Recommendations */}
      {data.enhancedRecommendations && data.enhancedRecommendations.length > 0 && (
        <div>
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Enhanced Recommendations
          </span>
          <div className="mt-2 space-y-2">
            {data.enhancedRecommendations.map((rec: EnhancedRecommendation, index: number) => (
              <div
                key={index}
                className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden"
              >
                <button
                  onClick={() => setExpandedRec(expandedRec === index ? null : index)}
                  className="w-full p-3 flex items-center justify-between bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  <span className="text-sm font-medium text-slate-900 dark:text-slate-100 text-left">
                    Recommendation {index + 1}
                  </span>
                  {expandedRec === index ? (
                    <ChevronUpIcon className="h-4 w-4 text-slate-500" />
                  ) : (
                    <ChevronDownIcon className="h-4 w-4 text-slate-500" />
                  )}
                </button>
                {expandedRec === index && (
                  <div className="p-3 space-y-3 bg-white dark:bg-slate-800/50">
                    {rec.original && (
                      <div>
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                          Original
                        </span>
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 italic">
                          {rec.original || 'Not provided'}
                        </p>
                      </div>
                    )}
                    <div>
                      <span className="text-xs font-medium text-purple-600 dark:text-purple-400 uppercase tracking-wide">
                        Enhanced
                      </span>
                      <p className="mt-1 text-sm text-slate-900 dark:text-slate-100 font-medium">
                        {rec.enhanced}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                        Rationale
                      </span>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                        {rec.rationale}
                      </p>
                    </div>
                    {rec.implementationSteps && rec.implementationSteps.length > 0 && (
                      <div>
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                          Implementation Steps
                        </span>
                        <ol className="mt-1 list-decimal list-inside text-sm text-slate-600 dark:text-slate-400 space-y-1">
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
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheckIcon className="h-5 w-5 text-purple-500" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Mapped Standards
            </span>
          </div>
          <div className="mt-2 space-y-2">
            {data.mappedStandards.map((std: StandardMapping, index: number) => (
              <div
                key={index}
                className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700"
              >
                <div className="flex items-start justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={clsx(
                        'px-2 py-0.5 rounded text-xs font-medium',
                        standardColors[std.standard]
                      )}
                    >
                      {standardLabels[std.standard] || std.standard}
                    </span>
                    <span className="font-mono text-xs bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded">
                      {std.clauseRef}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={clsx('text-xs font-medium', relevanceColors[std.relevance])}
                    >
                      {std.relevance}
                    </span>
                    {std.complianceStatus && (
                      <span
                        className={clsx(
                          'px-2 py-0.5 rounded text-xs font-medium',
                          complianceStatusColors[std.complianceStatus]
                        )}
                      >
                        {std.complianceStatus.replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>
                </div>
                <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                  {std.clauseName}
                </p>
                {std.domain && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Domain: {std.domain}
                  </p>
                )}
                {std.complianceGap && (
                  <p className="mt-2 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-2 rounded">
                    <span className="font-medium">Gap:</span> {std.complianceGap}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Standards-Based Recommendations */}
      {data.standardsBasedRecommendations && data.standardsBasedRecommendations.length > 0 && (
        <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheckIcon className="h-5 w-5 text-blue-500" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Standards-Based Recommendations
            </span>
          </div>
          <div className="space-y-2">
            {data.standardsBasedRecommendations.map((rec: StandardsBasedRecommendation, index: number) => (
              <div
                key={index}
                className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden"
              >
                <button
                  onClick={() => setExpandedStdRec(expandedStdRec === index ? null : index)}
                  className="w-full p-3 flex items-center justify-between bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={clsx(
                        'px-2 py-0.5 rounded text-xs font-medium',
                        standardColors[rec.standard]
                      )}
                    >
                      {standardLabels[rec.standard] || rec.standard}
                    </span>
                    <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {rec.controlNumber}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={clsx(
                        'px-2 py-0.5 rounded text-xs font-medium',
                        standardsPriorityColors[rec.priority]
                      )}
                    >
                      {rec.priority}
                    </span>
                    {expandedStdRec === index ? (
                      <ChevronUpIcon className="h-4 w-4 text-slate-500" />
                    ) : (
                      <ChevronDownIcon className="h-4 w-4 text-slate-500" />
                    )}
                  </div>
                </button>
                {expandedStdRec === index && (
                  <div className="p-3 space-y-3 bg-white dark:bg-slate-800/50">
                    <div>
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                        Control
                      </span>
                      <p className="mt-1 text-sm text-slate-700 dark:text-slate-300 font-medium">
                        {rec.controlName}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-purple-600 dark:text-purple-400 uppercase tracking-wide">
                        Recommendation
                      </span>
                      <p className="mt-1 text-sm text-slate-900 dark:text-slate-100">
                        {rec.recommendation}
                      </p>
                    </div>
                    {rec.implementationSteps && rec.implementationSteps.length > 0 && (
                      <div>
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                          Implementation Steps
                        </span>
                        <ol className="mt-1 list-decimal list-inside text-sm text-slate-600 dark:text-slate-400 space-y-1">
                          {rec.implementationSteps.map((step: string, stepIndex: number) => (
                            <li key={stepIndex} className="pl-1">{step}</li>
                          ))}
                        </ol>
                      </div>
                    )}
                    <div>
                      <span className="text-xs font-medium text-green-600 dark:text-green-400 uppercase tracking-wide">
                        Expected Outcome
                      </span>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                        {rec.expectedOutcome}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Compliance Roadmap */}
      {data.complianceRoadmap && data.complianceRoadmap.length > 0 && (
        <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2 mb-3">
            <MapIcon className="h-5 w-5 text-green-500" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Compliance Roadmap
            </span>
          </div>
          <div className="space-y-3">
            {data.complianceRoadmap.map((phase: ComplianceRoadmapItem, index: number) => (
              <div
                key={index}
                className="relative pl-8 pb-4"
              >
                {/* Timeline connector */}
                {index < data.complianceRoadmap.length - 1 && (
                  <div className="absolute left-3 top-6 bottom-0 w-0.5 bg-slate-200 dark:bg-slate-700" />
                )}
                {/* Phase number */}
                <div className="absolute left-0 top-0 w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 flex items-center justify-center text-xs font-bold">
                  {phase.phase}
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                  <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {phase.title}
                  </h4>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    {phase.description}
                  </p>
                  {phase.standards && phase.standards.length > 0 && (
                    <div className="mt-2 flex items-center gap-1 flex-wrap">
                      <span className="text-xs text-slate-500 dark:text-slate-400">Standards:</span>
                      {phase.standards.map((std, stdIndex) => (
                        <span
                          key={stdIndex}
                          className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 px-1.5 py-0.5 rounded"
                        >
                          {std}
                        </span>
                      ))}
                    </div>
                  )}
                  {phase.actions && phase.actions.length > 0 && (
                    <div className="mt-2">
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Actions:</span>
                      <ul className="mt-1 space-y-0.5">
                        {phase.actions.map((action, actionIndex) => (
                          <li key={actionIndex} className="text-xs text-slate-600 dark:text-slate-400 flex items-start gap-1">
                            <span className="text-purple-500 mt-0.5">•</span>
                            <span>{action}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {phase.dependencies && phase.dependencies.length > 0 && (
                    <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                      <span className="font-medium">Dependencies:</span> {phase.dependencies.join(', ')}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {(!data.enhancedRecommendations || data.enhancedRecommendations.length === 0) &&
       (!data.mappedStandards || data.mappedStandards.length === 0) && (
        <div className="text-center py-6 text-slate-500 dark:text-slate-400">
          <p>No recommendations available.</p>
        </div>
      )}
    </div>
  );
}

