// ============================================================================
// AI Observation Intelligence Types
// ============================================================================

/**
 * Input data structure for AI analysis
 */
export interface ObservationAIInput {
  title: string;
  description: string;
  riskRating: string;
  impact?: string;
  rootCause?: string;
  recommendation?: string;
  correctiveActionPlan?: string;
  managementResponse?: string;
  controlClauseRef?: string;
  controlRequirement?: string;
  evidenceCount: number;
  evidenceStatuses: string[];
  status: string;
  daysOpen: number;
  isOverdue: boolean;
}

/**
 * Masked input (PII redacted) sent to AI
 */
export interface MaskedObservationInput extends ObservationAIInput {
  originalHash: string;
}

// ============================================================================
// Validation Output Types
// ============================================================================

export interface ValidationResult {
  alignmentScore: number; // 0-100
  keyGaps: string[];
  riskSeverityJustification: string;
  auditDefensibility: 'WEAK' | 'ADEQUATE' | 'STRONG';
  aiConfidence: number; // 0-1
  defensibilityFlags: DefensibilityFlag[];
  // Standards Compliance for Observation
  standardsCompliance: ObservationStandardsMapping[];
  scopeValidation: {
    withinScope: boolean;
    scopeAlignment: string;
    relevantDomains: string[];
    auditObjective: string;
  };
  complianceSummary: string;
}

export interface DefensibilityFlag {
  type: 'VAGUE_WORDING' | 'MISSING_REFERENCE' | 'INCONSISTENT_RATING' | 'WEAK_IMPACT' | 'NO_ROOT_CAUSE';
  field: string;
  message: string;
  severity: 'WARNING' | 'CRITICAL';
  suggestion?: string;
}

export interface ObservationStandardsMapping {
  standard: 'ISO_27001' | 'NIST_CSF' | 'SOC2' | 'CIS_CONTROLS';
  domain: string;
  controlNumber: string;
  controlName: string;
  complianceStatus: 'COMPLIANT' | 'PARTIAL' | 'NON_COMPLIANT' | 'NOT_APPLICABLE';
  observationAlignment: string; // How the observation relates to this control
  gaps?: string; // What's missing for full compliance
  remediationGuidance?: string; // Specific guidance for this standard
}

// ============================================================================
// Recommendations Output Types
// ============================================================================

export interface RecommendationsResult {
  enhancedRecommendations: EnhancedRecommendation[];
  mappedStandards: StandardMapping[];
  remediationPriority: 'IMMEDIATE' | 'HIGH' | 'MEDIUM';
  // Standards-based recommendations
  standardsBasedRecommendations: StandardsBasedRecommendation[];
  complianceRoadmap: ComplianceRoadmapItem[];
  overallComplianceScore: number; // 0-100
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
  domain?: string;
  complianceStatus?: 'COMPLIANT' | 'PARTIAL' | 'NON_COMPLIANT' | 'NOT_APPLICABLE';
}

export interface StandardsBasedRecommendation {
  standard: 'ISO_27001' | 'NIST_CSF' | 'SOC2' | 'CIS_CONTROLS';
  controlNumber: string;
  controlName: string;
  recommendation: string;
  implementationSteps: string[];
  priority: 'IMMEDIATE' | 'HIGH' | 'MEDIUM' | 'LOW';
  expectedOutcome: string;
}

export interface ComplianceRoadmapItem {
  phase: number;
  title: string;
  description: string;
  standards: string[]; // Which standards this phase addresses
  actions: string[];
  dependencies?: string[];
}

// ============================================================================
// Evidence Guidance Output Types
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
// Role-Aware Guidance Output Types
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
// Executive Summary Output Types
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
// Full Analysis (combines all)
// ============================================================================

export interface FullAnalysisResult {
  validation: ValidationResult;
  recommendations: RecommendationsResult;
  evidenceGuidance: EvidenceGuidanceResult;
  roleGuidance: RoleGuidanceResult;
  executiveSummary: ExecutiveSummaryResult;
  generatedAt: Date;
  modelUsed: string;
  processingTimeMs: number;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export type AIInsightType =
  | 'VALIDATION'
  | 'RECOMMENDATIONS'
  | 'EVIDENCE_GUIDANCE'
  | 'ROLE_GUIDANCE'
  | 'EXECUTIVE_SUMMARY'
  | 'FULL_ANALYSIS';

export interface AIInsightRequest {
  observationId: string;
  insightTypes: AIInsightType[];
  forceRefresh?: boolean;
  userRole?: 'AUDITOR' | 'AUDITEE';
}

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
    generatedAt: Date;
    expiresAt: Date;
    processingTimeMs: number;
  };
  disclaimer: string;
}

// ============================================================================
// Evidence Review Types
// ============================================================================

export interface EvidenceReviewInput {
  evidenceId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  description?: string;
  extractedText?: string; // Text extracted from document
  observationContext: {
    title: string;
    description: string;
    riskRating: string;
    impact?: string;
    recommendation?: string;
    rootCause?: string;
    controlClauseRef?: string;
    controlRequirement?: string;
  };
}

export interface EvidenceStandardsMapping {
  standard: 'ISO_27001' | 'NIST_CSF' | 'SOC2' | 'CIS_CONTROLS';
  domain: string;
  controlNumber: string;
  controlName: string;
  complianceStatus: 'COMPLIANT' | 'PARTIAL' | 'NON_COMPLIANT' | 'NOT_APPLICABLE';
  evidenceAlignment: string; // How the evidence aligns with this control
  gaps?: string; // What's missing for full compliance
}

export interface EvidenceReviewResult {
  overallAssessment: 'SUFFICIENT' | 'PARTIAL' | 'INSUFFICIENT';
  relevanceScore: number; // 0-100
  sufficiencyScore: number; // 0-100
  summary: string;
  strengths: string[];
  weaknesses: string[];
  missingElements: string[];
  recommendations: string[];
  addressesRisk: boolean;
  addressesRecommendation: boolean;
  suggestedNextSteps: string[];
  aiConfidence: number; // 0-1
  // Standards Compliance
  standardsCompliance: EvidenceStandardsMapping[];
  scopeValidation: {
    withinScope: boolean;
    scopeAlignment: string;
    relevantDomains: string[];
  };
  complianceSummary: string;
}

export interface EvidenceReviewResponse {
  evidenceId: string;
  observationId: string;
  review: EvidenceReviewResult;
  metadata: {
    reviewedAt: Date;
    processingTimeMs: number;
    modelUsed: string;
  };
  disclaimer: string;
}

// ============================================================================
// Cache Types
// ============================================================================

export interface AIInsightCacheKey {
  observationId: string;
  insightType: string;
  inputHash: string;
}

// ============================================================================
// Static Fallback Types
// ============================================================================

export interface StaticGuidance {
  validation: Partial<ValidationResult>;
  recommendations: Partial<RecommendationsResult>;
  evidenceGuidance: Partial<EvidenceGuidanceResult>;
  roleGuidance: Partial<RoleGuidanceResult>;
}

// ============================================================================
// Prompt Template Types
// ============================================================================

export interface AIPrompt {
  system: string;
  user: string;
}
