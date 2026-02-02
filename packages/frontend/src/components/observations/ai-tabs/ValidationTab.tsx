'use client';

import clsx from 'clsx';
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import type { ValidationResult, DefensibilityFlag, ObservationStandardsMapping } from '@/types/ai-insights';
import { ShieldCheckIcon, GlobeAltIcon } from '@heroicons/react/24/outline';

interface ValidationTabProps {
  data: ValidationResult;
}

const defensibilityColors = {
  WEAK: 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400',
  ADEQUATE: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400',
  STRONG: 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400',
};

const defensibilityIcons = {
  WEAK: XCircleIcon,
  ADEQUATE: ExclamationCircleIcon,
  STRONG: CheckCircleIcon,
};

const severityColors = {
  WARNING: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800',
  CRITICAL: 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800',
};

const severityIconColors = {
  WARNING: 'text-yellow-500',
  CRITICAL: 'text-red-500',
};

const complianceStatusColors = {
  COMPLIANT: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  PARTIAL: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  NON_COMPLIANT: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  NOT_APPLICABLE: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
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

export function ValidationTab({ data }: ValidationTabProps) {
  const DefensibilityIcon = defensibilityIcons[data.auditDefensibility];

  return (
    <div className="space-y-5">
      {/* Alignment Score */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Alignment Score
          </span>
          <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {data.alignmentScore}/100
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
          <div
            className={clsx('h-2.5 rounded-full transition-all duration-500', {
              'bg-red-500': data.alignmentScore < 40,
              'bg-yellow-500': data.alignmentScore >= 40 && data.alignmentScore < 70,
              'bg-green-500': data.alignmentScore >= 70,
            })}
            style={{ width: `${data.alignmentScore}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Measures alignment between description, risk, and recommendation
        </p>
      </div>

      {/* Audit Defensibility */}
      <div>
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Audit Defensibility
        </span>
        <div className="mt-2">
          <span
            className={clsx(
              'inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium',
              defensibilityColors[data.auditDefensibility]
            )}
          >
            <DefensibilityIcon className="h-4 w-4 mr-1.5" />
            {data.auditDefensibility}
          </span>
        </div>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          How well this observation would withstand external scrutiny
        </p>
      </div>

      {/* Risk Severity Justification */}
      <div>
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Risk Rating Analysis
        </span>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
          {data.riskSeverityJustification}
        </p>
      </div>

      {/* Key Gaps */}
      {data.keyGaps && data.keyGaps.length > 0 && (
        <div>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Key Gaps Identified
          </span>
          <ul className="mt-2 space-y-2">
            {data.keyGaps.map((gap, index) => (
              <li
                key={index}
                className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400"
              >
                <span className="text-yellow-500 mt-0.5 flex-shrink-0">•</span>
                <span>{gap}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Defensibility Flags */}
      {data.defensibilityFlags && data.defensibilityFlags.length > 0 && (
        <div>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Issues to Address
          </span>
          <div className="mt-2 space-y-2">
            {data.defensibilityFlags.map((flag: DefensibilityFlag, index: number) => {
              const Icon = flag.severity === 'CRITICAL' ? XCircleIcon : ExclamationCircleIcon;
              return (
                <div
                  key={index}
                  className={clsx(
                    'p-3 rounded-lg border',
                    severityColors[flag.severity]
                  )}
                >
                  <div className="flex items-start gap-2">
                    <Icon
                      className={clsx(
                        'h-5 w-5 flex-shrink-0 mt-0.5',
                        severityIconColors[flag.severity]
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-700 px-1.5 py-0.5 rounded">
                          {flag.type.replace(/_/g, ' ')}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          in {flag.field}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                        {flag.message}
                      </p>
                      {flag.suggestion && (
                        <p className="mt-1.5 text-sm text-purple-600 dark:text-purple-400 font-medium">
                          💡 {flag.suggestion}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Standards Compliance */}
      {data.standardsCompliance && data.standardsCompliance.length > 0 && (
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheckIcon className="h-5 w-5 text-purple-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Standards Compliance Mapping
            </span>
          </div>
          <div className="space-y-3">
            {data.standardsCompliance.map((mapping: ObservationStandardsMapping, index: number) => (
              <div
                key={index}
                className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={clsx(
                        'px-2 py-0.5 rounded text-xs font-medium',
                        standardColors[mapping.standard]
                      )}
                    >
                      {standardLabels[mapping.standard] || mapping.standard}
                    </span>
                    <span className="text-xs font-mono text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-700 px-1.5 py-0.5 rounded">
                      {mapping.controlNumber}
                    </span>
                  </div>
                  <span
                    className={clsx(
                      'px-2 py-0.5 rounded text-xs font-medium',
                      complianceStatusColors[mapping.complianceStatus]
                    )}
                  >
                    {mapping.complianceStatus.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="mt-2">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {mapping.controlName}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Domain: {mapping.domain}
                  </p>
                </div>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  {mapping.observationAlignment}
                </p>
                {mapping.gaps && (
                  <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
                    <span className="font-medium">Gap:</span> {mapping.gaps}
                  </p>
                )}
                {mapping.remediationGuidance && (
                  <p className="mt-2 text-sm text-purple-600 dark:text-purple-400">
                    <span className="font-medium">Guidance:</span> {mapping.remediationGuidance}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scope Validation */}
      {data.scopeValidation && (
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-3">
            <GlobeAltIcon className="h-5 w-5 text-blue-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Scope Validation
            </span>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <span
                className={clsx(
                  'px-2 py-0.5 rounded text-xs font-medium',
                  data.scopeValidation.withinScope
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                )}
              >
                {data.scopeValidation.withinScope ? 'Within Scope' : 'Outside Scope'}
              </span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {data.scopeValidation.scopeAlignment}
            </p>
            {data.scopeValidation.auditObjective && (
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium">Audit Objective:</span> {data.scopeValidation.auditObjective}
              </p>
            )}
            {data.scopeValidation.relevantDomains && data.scopeValidation.relevantDomains.length > 0 && (
              <div className="mt-2 flex items-center gap-1 flex-wrap">
                <span className="text-xs text-gray-500 dark:text-gray-400">Relevant Domains:</span>
                {data.scopeValidation.relevantDomains.map((domain, index) => (
                  <span
                    key={index}
                    className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-1.5 py-0.5 rounded"
                  >
                    {domain}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Compliance Summary */}
      {data.complianceSummary && (
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Compliance Summary
          </span>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg border border-purple-200 dark:border-purple-800">
            {data.complianceSummary}
          </p>
        </div>
      )}

      {/* AI Confidence */}
      <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>AI Confidence</span>
          <div className="flex items-center gap-2">
            <div className="w-20 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
              <div
                className="h-1.5 rounded-full bg-purple-500"
                style={{ width: `${Math.round(data.aiConfidence * 100)}%` }}
              />
            </div>
            <span>{Math.round(data.aiConfidence * 100)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
