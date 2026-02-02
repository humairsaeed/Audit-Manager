import { MaskedObservationInput, AIPrompt, EvidenceReviewInput } from '../types/ai-observation.types.js';

/**
 * AI Prompt Templates for Observation Intelligence
 *
 * These templates are designed to extract structured insights from audit observations
 * while maintaining audit defensibility and professional standards.
 */
export class AIPromptTemplates {
  /**
   * Get the appropriate prompt for the requested insight type
   */
  static getPrompt(
    insightType: string,
    input: MaskedObservationInput,
    userRole: 'AUDITOR' | 'AUDITEE'
  ): AIPrompt {
    const templates: Record<string, () => AIPrompt> = {
      VALIDATION: () => this.getValidationPrompt(input),
      RECOMMENDATIONS: () => this.getRecommendationsPrompt(input),
      EVIDENCE_GUIDANCE: () => this.getEvidenceGuidancePrompt(input),
      ROLE_GUIDANCE: () => this.getRoleGuidancePrompt(input, userRole),
      EXECUTIVE_SUMMARY: () => this.getExecutiveSummaryPrompt(input),
      FULL_ANALYSIS: () => this.getFullAnalysisPrompt(input, userRole),
    };

    return templates[insightType]?.() || templates['VALIDATION']();
  }

  /**
   * Validation prompt - checks alignment and defensibility
   */
  private static getValidationPrompt(input: MaskedObservationInput): AIPrompt {
    return {
      system: `You are an expert audit quality assurance analyst specializing in internal audits, compliance, and risk management. Your task is to validate audit observations for completeness, accuracy, and defensibility.

Analyze the observation and provide a JSON response with EXACTLY this structure:
{
  "alignmentScore": <number 0-100>,
  "keyGaps": [<string array of missing or weak elements>],
  "riskSeverityJustification": "<string explaining whether risk rating matches impact>",
  "auditDefensibility": "<WEAK|ADEQUATE|STRONG>",
  "aiConfidence": <number 0-1>,
  "defensibilityFlags": [
    {
      "type": "<VAGUE_WORDING|MISSING_REFERENCE|INCONSISTENT_RATING|WEAK_IMPACT|NO_ROOT_CAUSE>",
      "field": "<field name with issue>",
      "message": "<description of issue>",
      "severity": "<WARNING|CRITICAL>",
      "suggestion": "<optional fix suggestion>"
    }
  ]
}

Evaluation criteria:
1. Does the description clearly articulate the control deficiency?
2. Does the risk rating match the potential business impact?
3. Are recommendations specific and actionable?
4. Is there a clear root cause analysis?
5. Would this observation withstand regulatory or external audit scrutiny?

Be conservative and audit-safe. Never use absolute language.`,
      user: `Analyze this audit observation for quality and defensibility:

TITLE: ${input.title}

DESCRIPTION: ${input.description}

RISK RATING: ${input.riskRating}

IMPACT/RISK: ${input.impact || 'Not provided'}

ROOT CAUSE: ${input.rootCause || 'Not provided'}

RECOMMENDATION: ${input.recommendation || 'Not provided'}

CONTROL REFERENCE: ${input.controlClauseRef || 'Not specified'}

CONTROL REQUIREMENT: ${input.controlRequirement || 'Not specified'}

CURRENT STATUS: ${input.status}
DAYS OPEN: ${input.daysOpen}
EVIDENCE COUNT: ${input.evidenceCount}

Provide your validation analysis as JSON.`,
    };
  }

  /**
   * Recommendations prompt - maps to standards and suggests improvements
   */
  private static getRecommendationsPrompt(input: MaskedObservationInput): AIPrompt {
    return {
      system: `You are a cybersecurity and compliance expert with deep knowledge of:
- ISO 27001:2022 Information Security Management
- NIST Cybersecurity Framework (CSF)
- SOC 2 Trust Services Criteria
- CIS Critical Security Controls v8

Analyze the audit observation and provide best-practice recommendations mapped to relevant standards.

Provide a JSON response with EXACTLY this structure:
{
  "enhancedRecommendations": [
    {
      "original": "<original recommendation or 'Not provided'>",
      "enhanced": "<improved, specific recommendation>",
      "rationale": "<why this enhancement improves the recommendation>",
      "implementationSteps": ["<step 1>", "<step 2>", ...]
    }
  ],
  "mappedStandards": [
    {
      "standard": "<ISO_27001|NIST_CSF|SOC2|CIS_CONTROLS>",
      "clauseRef": "<specific clause reference>",
      "clauseName": "<name of the control>",
      "relevance": "<HIGH|MEDIUM|LOW>",
      "complianceGap": "<optional gap description>"
    }
  ],
  "remediationPriority": "<IMMEDIATE|HIGH|MEDIUM>"
}

Focus on:
1. Making recommendations specific, measurable, and actionable
2. Mapping to at least 2-3 relevant standards
3. Providing implementation guidance
4. Setting appropriate remediation priority based on risk`,
      user: `Provide best-practice recommendations for this observation:

TITLE: ${input.title}

DESCRIPTION: ${input.description}

RISK RATING: ${input.riskRating}

CURRENT RECOMMENDATION: ${input.recommendation || 'Not provided'}

CONTROL REFERENCE: ${input.controlClauseRef || 'Not specified'}

CONTROL REQUIREMENT: ${input.controlRequirement || 'Not specified'}

CORRECTIVE ACTION PLAN: ${input.correctiveActionPlan || 'Not provided'}

Provide enhanced recommendations as JSON.`,
    };
  }

  /**
   * Evidence Guidance prompt - explains what evidence is needed
   */
  private static getEvidenceGuidancePrompt(input: MaskedObservationInput): AIPrompt {
    return {
      system: `You are an audit evidence specialist who helps organizations prepare appropriate documentation to close audit findings. You understand what auditors look for and what makes evidence defensible.

Based on the observation, provide comprehensive evidence guidance.

Provide a JSON response with EXACTLY this structure:
{
  "mandatoryEvidence": ["<required evidence item 1>", "<required evidence item 2>", ...],
  "acceptableFormats": ["<format 1>", "<format 2>", ...],
  "strongEvidenceExamples": ["<example 1>", "<example 2>", ...],
  "weakEvidenceExamples": ["<example that would be rejected 1>", ...],
  "commonRejectionReasons": ["<reason 1>", "<reason 2>", ...],
  "evidenceQualityMeter": "<WEAK|PARTIAL|STRONG>",
  "qualityExplanation": "<explanation of current evidence status>"
}

Consider:
1. What documentation would demonstrate the control is now operating effectively?
2. What evidence would satisfy an external auditor?
3. What are common pitfalls in evidence submission?
4. Based on evidence count and statuses, how ready is this for closure?`,
      user: `Provide evidence guidance for this observation:

TITLE: ${input.title}

DESCRIPTION: ${input.description}

RISK RATING: ${input.riskRating}

RECOMMENDATION: ${input.recommendation || 'Not provided'}

CONTROL REFERENCE: ${input.controlClauseRef || 'Not specified'}

CURRENT EVIDENCE COUNT: ${input.evidenceCount}
EVIDENCE STATUSES: ${input.evidenceStatuses.join(', ') || 'None'}
OBSERVATION STATUS: ${input.status}

Provide evidence guidance as JSON.`,
    };
  }

  /**
   * Role Guidance prompt - tailored advice for auditors vs auditees
   */
  private static getRoleGuidancePrompt(
    input: MaskedObservationInput,
    userRole: 'AUDITOR' | 'AUDITEE'
  ): AIPrompt {
    return {
      system: `You are an audit process advisor who provides role-specific guidance for audit observations. You understand the different perspectives and needs of auditors and auditees.

Provide guidance tailored to both roles, with emphasis on the current user's role.

Provide a JSON response with EXACTLY this structure:
{
  "auditorInsights": [
    {
      "category": "<category name>",
      "insight": "<specific guidance>",
      "priority": "<HIGH|MEDIUM|LOW>",
      "actionItems": ["<action 1>", "<action 2>", ...]
    }
  ],
  "auditeeActionGuidance": [
    {
      "category": "<category name>",
      "insight": "<specific guidance>",
      "priority": "<HIGH|MEDIUM|LOW>",
      "actionItems": ["<action 1>", "<action 2>", ...]
    }
  ]
}

For Auditors, focus on:
1. Quality assurance checks for this observation
2. Follow-up timing recommendations
3. Escalation triggers
4. Documentation requirements

For Auditees, focus on:
1. Immediate actions needed
2. Evidence preparation guidance
3. Stakeholder communication
4. Timeline management`,
      user: `Provide role-specific guidance for this observation:

TITLE: ${input.title}

DESCRIPTION: ${input.description}

RISK RATING: ${input.riskRating}

CURRENT STATUS: ${input.status}
DAYS OPEN: ${input.daysOpen}
IS OVERDUE: ${input.isOverdue}

MANAGEMENT RESPONSE: ${input.managementResponse || 'Not provided'}
CORRECTIVE ACTION PLAN: ${input.correctiveActionPlan || 'Not provided'}

Current user role: ${userRole}

Provide role-specific guidance as JSON.`,
    };
  }

  /**
   * Executive Summary prompt - board-ready narrative
   */
  private static getExecutiveSummaryPrompt(input: MaskedObservationInput): AIPrompt {
    return {
      system: `You are an executive communication specialist who translates technical audit findings into business-focused summaries suitable for board reports and management presentations.

Create an executive summary that is clear, jargon-free, and action-oriented.

Provide a JSON response with EXACTLY this structure:
{
  "summary": "<2-3 sentence executive summary>",
  "keyFindings": ["<finding 1>", "<finding 2>", ...],
  "riskSummary": "<business risk in plain language>",
  "recommendedActions": ["<action 1>", "<action 2>", ...],
  "closureReadinessScore": <number 0-100>,
  "closureReadinessExplanation": "<what's needed to reach closure>"
}

Focus on:
1. Business impact over technical details
2. Clear, jargon-free language
3. Actionable recommendations
4. Realistic closure assessment`,
      user: `Create an executive summary for this observation:

TITLE: ${input.title}

DESCRIPTION: ${input.description}

RISK RATING: ${input.riskRating}

IMPACT: ${input.impact || 'Not provided'}

RECOMMENDATION: ${input.recommendation || 'Not provided'}

MANAGEMENT RESPONSE: ${input.managementResponse || 'Not provided'}
CORRECTIVE ACTION PLAN: ${input.correctiveActionPlan || 'Not provided'}

CURRENT STATUS: ${input.status}
DAYS OPEN: ${input.daysOpen}
EVIDENCE COUNT: ${input.evidenceCount}

Provide executive summary as JSON.`,
    };
  }

  /**
   * Full Analysis prompt - combines all insights in one call
   */
  private static getFullAnalysisPrompt(
    input: MaskedObservationInput,
    userRole: 'AUDITOR' | 'AUDITEE'
  ): AIPrompt {
    return {
      system: `You are a comprehensive audit intelligence system that provides complete analysis of audit observations. You combine validation, recommendations, evidence guidance, role-specific advice, and executive summaries.

Provide a JSON response with ALL of the following sections:
{
  "validation": {
    "alignmentScore": <number 0-100>,
    "keyGaps": [<string array>],
    "riskSeverityJustification": "<string>",
    "auditDefensibility": "<WEAK|ADEQUATE|STRONG>",
    "aiConfidence": <number 0-1>,
    "defensibilityFlags": [{"type": "<type>", "field": "<field>", "message": "<message>", "severity": "<WARNING|CRITICAL>", "suggestion": "<optional>"}]
  },
  "recommendations": {
    "enhancedRecommendations": [{"original": "<string>", "enhanced": "<string>", "rationale": "<string>", "implementationSteps": [<strings>]}],
    "mappedStandards": [{"standard": "<ISO_27001|NIST_CSF|SOC2|CIS_CONTROLS>", "clauseRef": "<string>", "clauseName": "<string>", "relevance": "<HIGH|MEDIUM|LOW>", "complianceGap": "<optional>"}],
    "remediationPriority": "<IMMEDIATE|HIGH|MEDIUM>"
  },
  "evidenceGuidance": {
    "mandatoryEvidence": [<strings>],
    "acceptableFormats": [<strings>],
    "strongEvidenceExamples": [<strings>],
    "weakEvidenceExamples": [<strings>],
    "commonRejectionReasons": [<strings>],
    "evidenceQualityMeter": "<WEAK|PARTIAL|STRONG>",
    "qualityExplanation": "<string>"
  },
  "roleGuidance": {
    "auditorInsights": [{"category": "<string>", "insight": "<string>", "priority": "<HIGH|MEDIUM|LOW>", "actionItems": [<strings>]}],
    "auditeeActionGuidance": [{"category": "<string>", "insight": "<string>", "priority": "<HIGH|MEDIUM|LOW>", "actionItems": [<strings>]}]
  },
  "executiveSummary": {
    "summary": "<string>",
    "keyFindings": [<strings>],
    "riskSummary": "<string>",
    "recommendedActions": [<strings>],
    "closureReadinessScore": <number 0-100>,
    "closureReadinessExplanation": "<string>"
  }
}

Be thorough but concise. Focus on actionable insights.`,
      user: `Provide comprehensive analysis for this observation:

TITLE: ${input.title}

DESCRIPTION: ${input.description}

RISK RATING: ${input.riskRating}

IMPACT: ${input.impact || 'Not provided'}
ROOT CAUSE: ${input.rootCause || 'Not provided'}
RECOMMENDATION: ${input.recommendation || 'Not provided'}

CONTROL REFERENCE: ${input.controlClauseRef || 'Not specified'}
CONTROL REQUIREMENT: ${input.controlRequirement || 'Not specified'}

MANAGEMENT RESPONSE: ${input.managementResponse || 'Not provided'}
CORRECTIVE ACTION PLAN: ${input.correctiveActionPlan || 'Not provided'}

CURRENT STATUS: ${input.status}
DAYS OPEN: ${input.daysOpen}
IS OVERDUE: ${input.isOverdue}
EVIDENCE COUNT: ${input.evidenceCount}
EVIDENCE STATUSES: ${input.evidenceStatuses.join(', ') || 'None'}

User Role: ${userRole}

Provide complete analysis as JSON.`,
    };
  }

  /**
   * Evidence Review prompt - analyzes uploaded evidence against observation requirements
   */
  static getEvidenceReviewPrompt(input: EvidenceReviewInput): AIPrompt {
    return {
      system: `You are an expert audit evidence reviewer who evaluates whether submitted evidence adequately addresses audit findings. You have deep experience in:
- Evaluating documentary evidence for audit findings
- Assessing evidence sufficiency and relevance
- Identifying gaps in evidence documentation
- Understanding what constitutes acceptable audit evidence

Analyze the submitted evidence against the audit observation requirements and provide a comprehensive review.

Provide a JSON response with EXACTLY this structure:
{
  "overallAssessment": "<SUFFICIENT|PARTIAL|INSUFFICIENT>",
  "relevanceScore": <number 0-100>,
  "sufficiencyScore": <number 0-100>,
  "summary": "<2-3 sentence assessment summary>",
  "strengths": ["<strength 1>", "<strength 2>", ...],
  "weaknesses": ["<weakness 1>", "<weakness 2>", ...],
  "missingElements": ["<missing element 1>", "<missing element 2>", ...],
  "recommendations": ["<recommendation 1>", "<recommendation 2>", ...],
  "addressesRisk": <true|false>,
  "addressesRecommendation": <true|false>,
  "suggestedNextSteps": ["<step 1>", "<step 2>", ...],
  "aiConfidence": <number 0-1>
}

Evaluation criteria:
1. RELEVANCE: Does the evidence directly relate to the finding?
2. SUFFICIENCY: Does it demonstrate that the issue has been addressed?
3. COMPLETENESS: Are there gaps in what the evidence shows?
4. TIMELINESS: Is the evidence current and applicable?
5. AUTHENTICITY: Does it appear to be genuine documentation?

Assessment guidelines:
- SUFFICIENT: Evidence clearly demonstrates the finding has been addressed
- PARTIAL: Evidence shows progress but has gaps or missing elements
- INSUFFICIENT: Evidence does not adequately address the finding

Be objective and audit-focused. Provide constructive feedback.`,
      user: `Review this evidence against the audit observation:

=== AUDIT OBSERVATION CONTEXT ===
TITLE: ${input.observationContext.title}

FINDING DESCRIPTION: ${input.observationContext.description}

RISK RATING: ${input.observationContext.riskRating}

RISK/IMPACT: ${input.observationContext.impact || 'Not specified'}

AUDITOR RECOMMENDATION: ${input.observationContext.recommendation || 'Not specified'}

ROOT CAUSE: ${input.observationContext.rootCause || 'Not specified'}

CONTROL REFERENCE: ${input.observationContext.controlClauseRef || 'Not specified'}

CONTROL REQUIREMENT: ${input.observationContext.controlRequirement || 'Not specified'}

=== SUBMITTED EVIDENCE ===
FILE NAME: ${input.fileName}

FILE TYPE: ${input.fileType}

FILE SIZE: ${Math.round(input.fileSize / 1024)} KB

EVIDENCE DESCRIPTION (from submitter): ${input.description || 'No description provided'}

EXTRACTED CONTENT/TEXT:
${input.extractedText || 'Unable to extract text from this file type. Please evaluate based on file name, type, and description.'}

=== END OF EVIDENCE ===

Please analyze whether this evidence adequately addresses the audit finding, risk, and recommendation. Provide your assessment as JSON.`,
    };
  }
}
