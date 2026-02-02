// ============================================================================
// AI Observation Intelligence Types (Frontend)
// ============================================================================

/**
 * AI Insight Types
 */
export type AIInsightType =
  | 'VALIDATION'
  | 'RECOMMENDATIONS'
  | 'EVIDENCE_GUIDANCE'
  | 'ROLE_GUIDANCE'
  | 'EXECUTIVE_SUMMARY'
  | 'FULL_ANALYSIS';

/**
 * Main response from AI insights API
 */
export interface AIInsightResponse {
  observationId: string;
  insights: {
    validation?: ValidationResult;
    recommendations?: RecommendationsResult;
    evidenceGuidance?: EvidenceGuidanceResult;
    roleGuidance?: RoleGuidanceResult;
    executiveSummary?: ExecutiveSummaryResult;
  };
  metadata: {
    fromCache: boolean;
    generatedAt: string;
    expiresAt: string;
    processingTimeMs: number;
  };
  disclaimer: string;
}

// ============================================================================
// Validation Types
// ============================================================================

export interface ValidationResult {
  alignmentScore: number; // 0-100
  keyGaps: string[];
  riskSeverityJustification: string;
  auditDefensibility: 'WEAK' | 'ADEQUATE' | 'STRONG';
  aiConfidence: number; // 0-1
  defensibilityFlags: DefensibilityFlag[];
}

export interface DefensibilityFlag {
  type: 'VAGUE_WORDING' | 'MISSING_REFERENCE' | 'INCONSISTENT_RATING' | 'WEAK_IMPACT' | 'NO_ROOT_CAUSE';
  field: string;
  message: string;
  severity: 'WARNING' | 'CRITICAL';
  suggestion?: string;
}

// ============================================================================
// Recommendations Types
// ============================================================================

export interface RecommendationsResult {
  enhancedRecommendations: EnhancedRecommendation[];
  mappedStandards: StandardMapping[];
  remediationPriority: 'IMMEDIATE' | 'HIGH' | 'MEDIUM';
}

export interface EnhancedRecommendation {
  original: string;
  enhanced: string;
  rationale: string;
  implementationSteps?: string[];
}

export interface StandardMapping {
  standard: 'ISO_27001' | 'NIST_CSF' | 'SOC2' | 'CIS_CONTROLS';
  clauseRef: string;
  clauseName: string;
  relevance: 'HIGH' | 'MEDIUM' | 'LOW';
  complianceGap?: string;
}

// ============================================================================
// Evidence Guidance Types
// ============================================================================

export interface EvidenceGuidanceResult {
  mandatoryEvidence: string[];
  acceptableFormats: string[];
  strongEvidenceExamples: string[];
  weakEvidenceExamples: string[];
  commonRejectionReasons: string[];
  evidenceQualityMeter: 'WEAK' | 'PARTIAL' | 'STRONG';
  qualityExplanation: string;
}

// ============================================================================
// Role Guidance Types
// ============================================================================

export interface RoleGuidanceResult {
  auditorInsights: RoleInsight[];
  auditeeActionGuidance: RoleInsight[];
}

export interface RoleInsight {
  category: string;
  insight: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  actionItems?: string[];
}

// ============================================================================
// Executive Summary Types
// ============================================================================

export interface ExecutiveSummaryResult {
  summary: string;
  keyFindings: string[];
  riskSummary: string;
  recommendedActions: string[];
  closureReadinessScore: number; // 0-100
  closureReadinessExplanation: string;
}

// ============================================================================
// History Types
// ============================================================================

export interface AIInsightHistory {
  id: string;
  insightType: AIInsightType;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'EXPIRED';
  aiConfidence: number | null;
  processingTimeMs: number | null;
  createdAt: string;
  requestedBy: {
    firstName: string;
    lastName: string;
    email: string;
  };
}

export interface AIInsightDetail {
  id: string;
  observationId: string;
  insightType: AIInsightType;
  requestHash: string;
  rawResponse: unknown;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'EXPIRED';
  aiConfidence: number | null;
  modelUsed: string | null;
  processingTimeMs: number | null;
  createdAt: string;
  expiresAt: string | null;
  requestedBy: {
    firstName: string;
    lastName: string;
    email: string;
  };
}
