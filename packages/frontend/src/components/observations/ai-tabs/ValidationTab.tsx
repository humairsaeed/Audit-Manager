'use client';

import clsx from 'clsx';
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import type { ValidationResult, DefensibilityFlag } from '@/types/ai-insights';

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
