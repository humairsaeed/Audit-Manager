'use client';

import clsx from 'clsx';
import {
  CheckCircleIcon,
  XCircleIcon,
  DocumentIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import type { EvidenceGuidanceResult } from '@/types/ai-insights';

interface EvidenceGuidanceTabProps {
  data: EvidenceGuidanceResult;
}

const qualityColors = {
  WEAK: 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400',
  PARTIAL: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400',
  STRONG: 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400',
};

const qualityIcons = {
  WEAK: XCircleIcon,
  PARTIAL: ExclamationTriangleIcon,
  STRONG: CheckCircleIcon,
};

export function EvidenceGuidanceTab({ data }: EvidenceGuidanceTabProps) {
  const QualityIcon = qualityIcons[data.evidenceQualityMeter];

  return (
    <div className="space-y-5">
      {/* Evidence Quality Meter */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Current Evidence Quality
          </span>
          <span
            className={clsx(
              'inline-flex items-center px-3 py-1 rounded-full text-sm font-medium',
              qualityColors[data.evidenceQualityMeter]
            )}
          >
            <QualityIcon className="h-4 w-4 mr-1.5" />
            {data.evidenceQualityMeter}
          </span>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 p-3 rounded-lg">
          {data.qualityExplanation}
        </p>
      </div>

      {/* Mandatory Evidence */}
      {data.mandatoryEvidence && data.mandatoryEvidence.length > 0 && (
        <div>
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <DocumentIcon className="h-4 w-4 text-purple-500" />
            Required Evidence
          </span>
          <ul className="mt-2 space-y-2">
            {data.mandatoryEvidence.map((item: string, index: number) => (
              <li
                key={index}
                className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400 bg-purple-50 dark:bg-purple-900/20 p-2 rounded-lg"
              >
                <span className="text-purple-500 font-bold">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Acceptable Formats */}
      {data.acceptableFormats && data.acceptableFormats.length > 0 && (
        <div>
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Acceptable Formats
          </span>
          <div className="mt-2 flex flex-wrap gap-2">
            {data.acceptableFormats.map((format: string, index: number) => (
              <span
                key={index}
                className="px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded text-xs font-medium"
              >
                {format}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Strong Evidence Examples */}
      {data.strongEvidenceExamples && data.strongEvidenceExamples.length > 0 && (
        <div>
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <CheckCircleIcon className="h-4 w-4 text-green-500" />
            Strong Evidence Examples
          </span>
          <ul className="mt-2 space-y-1.5">
            {data.strongEvidenceExamples.map((example: string, index: number) => (
              <li
                key={index}
                className="text-sm text-green-700 dark:text-green-400 pl-6 relative"
              >
                <span className="absolute left-0">✓</span>
                {example}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Weak Evidence Examples */}
      {data.weakEvidenceExamples && data.weakEvidenceExamples.length > 0 && (
        <div>
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <XCircleIcon className="h-4 w-4 text-red-500" />
            Avoid These Evidence Types
          </span>
          <ul className="mt-2 space-y-1.5">
            {data.weakEvidenceExamples.map((example: string, index: number) => (
              <li
                key={index}
                className="text-sm text-red-700 dark:text-red-400 pl-6 relative"
              >
                <span className="absolute left-0">✗</span>
                {example}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Common Rejection Reasons */}
      {data.commonRejectionReasons && data.commonRejectionReasons.length > 0 && (
        <div>
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Common Rejection Reasons
          </span>
          <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
            <ul className="space-y-1.5">
              {data.commonRejectionReasons.map((reason: string, index: number) => (
                <li
                  key={index}
                  className="text-sm text-red-700 dark:text-red-400 flex items-start gap-2"
                >
                  <ExclamationTriangleIcon className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

