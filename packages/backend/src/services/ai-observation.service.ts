import OpenAI from 'openai';
import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { config } from '../config/index.js';
import logger from '../lib/logger.js';
import { AppError } from '../middleware/error.middleware.js';
import { RedisService } from './redis.service.js';
import { AIPromptTemplates } from './ai-prompt-templates.js';
import {
  ObservationAIInput,
  MaskedObservationInput,
  ValidationResult,
  RecommendationsResult,
  EvidenceGuidanceResult,
  RoleGuidanceResult,
  ExecutiveSummaryResult,
  AIInsightRequest,
  AIInsightResponse,
  AIInsightType,
  EvidenceReviewInput,
  EvidenceReviewResult,
  EvidenceReviewResponse,
} from '../types/ai-observation.types.js';
import { AIInsightType as PrismaAIInsightType } from '@prisma/client';

const AI_DISCLAIMER = 'AI insights are advisory and do not replace auditor judgment. All recommendations should be reviewed by qualified personnel before implementation.';

// Roles that can access AI insights
const ALLOWED_ROLES = ['system_admin', 'audit_admin', 'compliance_manager', 'auditor'];

/**
 * AI Observation Intelligence Service
 *
 * Provides AI-powered insights for audit observations including:
 * - Validation and defensibility assessment
 * - Best-practice recommendations mapped to standards
 * - Evidence guidance
 * - Role-specific advice
 * - Executive summaries
 */
export class AIObservationService {
  private static openai: OpenAI | null = null;

  /**
   * Initialize OpenAI client
   */
  private static getOpenAIClient(): OpenAI {
    if (!this.openai) {
      if (!config.ai.openai.apiKey) {
        throw AppError.internal('OpenAI API key not configured');
      }
      this.openai = new OpenAI({
        apiKey: config.ai.openai.apiKey,
      });
    }
    return this.openai;
  }

  /**
   * Main entry point for getting AI insights
   */
  static async getInsights(
    request: AIInsightRequest,
    userId: string,
    userEmail: string,
    userRoles: string[]
  ): Promise<AIInsightResponse> {
    const startTime = Date.now();

    // Check RBAC - only allowed roles can access
    if (!this.canAccessAIInsights(userRoles)) {
      throw AppError.forbidden('AI insights are only available to Auditor and Compliance roles');
    }

    // Check rate limit
    await this.checkRateLimit(userId);

    // Get observation with all related data
    const observation = await this.getObservationForAnalysis(request.observationId);

    // Prepare and mask input
    const rawInput = this.prepareObservationInput(observation);
    const maskedInput = this.maskPII(rawInput);
    const inputHash = this.generateInputHash(maskedInput);

    const insights: AIInsightResponse['insights'] = {};
    let fromCache = true;

    // Determine user role for AI context
    const aiUserRole = userRoles.some(r => ['auditor', 'audit_admin', 'compliance_manager'].includes(r))
      ? 'AUDITOR'
      : 'AUDITEE';

    for (const insightType of request.insightTypes) {
      // Check cache first (unless force refresh)
      if (!request.forceRefresh) {
        const cached = await this.getFromCache(request.observationId, insightType, inputHash);
        if (cached) {
          this.assignInsight(insights, insightType, cached);

          // Log cache hit
          await this.logRequest(
            request.observationId,
            insightType,
            userId,
            userEmail,
            maskedInput,
            inputHash,
            'cached',
            Date.now() - startTime,
            true
          );
          continue;
        }
      }

      fromCache = false;

      // Generate insight
      try {
        const result = await this.generateInsight(
          insightType,
          maskedInput,
          request.userRole || aiUserRole
        );

        this.assignInsight(insights, insightType, result);

        // Store in database and cache
        await this.storeInsight(
          request.observationId,
          insightType,
          inputHash,
          result,
          userId,
          Date.now() - startTime
        );

        // Log the request
        await this.logRequest(
          request.observationId,
          insightType,
          userId,
          userEmail,
          maskedInput,
          inputHash,
          'success',
          Date.now() - startTime,
          false
        );
      } catch (error) {
        logger.error(`AI insight generation failed for ${insightType}:`, error);

        // Use static fallback if enabled
        if (config.ai.fallbackEnabled) {
          const fallback = this.getStaticFallback(insightType, maskedInput);
          this.assignInsight(insights, insightType, fallback);
        }

        // Log the error
        await this.logRequest(
          request.observationId,
          insightType,
          userId,
          userEmail,
          maskedInput,
          inputHash,
          'error',
          Date.now() - startTime,
          false
        );
      }
    }

    return {
      observationId: request.observationId,
      insights,
      metadata: {
        fromCache,
        generatedAt: new Date(),
        expiresAt: new Date(Date.now() + config.ai.cache.ttlHours * 60 * 60 * 1000),
        processingTimeMs: Date.now() - startTime,
      },
      disclaimer: AI_DISCLAIMER,
    };
  }

  /**
   * Assign insight result to the appropriate field
   */
  private static assignInsight(
    insights: AIInsightResponse['insights'],
    insightType: AIInsightType,
    result: unknown
  ): void {
    switch (insightType) {
      case 'VALIDATION':
        insights.validation = result as ValidationResult;
        break;
      case 'RECOMMENDATIONS':
        insights.recommendations = result as RecommendationsResult;
        break;
      case 'EVIDENCE_GUIDANCE':
        insights.evidenceGuidance = result as EvidenceGuidanceResult;
        break;
      case 'ROLE_GUIDANCE':
        insights.roleGuidance = result as RoleGuidanceResult;
        break;
      case 'EXECUTIVE_SUMMARY':
        insights.executiveSummary = result as ExecutiveSummaryResult;
        break;
      case 'FULL_ANALYSIS':
        // Full analysis contains all sections
        const fullResult = result as {
          validation: ValidationResult;
          recommendations: RecommendationsResult;
          evidenceGuidance: EvidenceGuidanceResult;
          roleGuidance: RoleGuidanceResult;
          executiveSummary: ExecutiveSummaryResult;
        };
        insights.validation = fullResult.validation;
        insights.recommendations = fullResult.recommendations;
        insights.evidenceGuidance = fullResult.evidenceGuidance;
        insights.roleGuidance = fullResult.roleGuidance;
        insights.executiveSummary = fullResult.executiveSummary;
        break;
    }
  }

  /**
   * Mask PII from observation input before sending to AI
   */
  private static maskPII(input: ObservationAIInput): MaskedObservationInput {
    const piiPatterns = {
      email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      uuid: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
      employeeId: /\b(EMP|USR|ID)[0-9]{4,}\b/gi,
      phone: /\b\+?[\d\s\-()]{10,}\b/g,
      name: /\b(Mr\.|Mrs\.|Ms\.|Dr\.)\s+[A-Z][a-z]+\s+[A-Z][a-z]+\b/g,
      ipAddress: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
    };

    const maskString = (str: string | undefined): string => {
      if (!str) return '';
      let masked = str;
      masked = masked.replace(piiPatterns.email, '[EMAIL_REDACTED]');
      masked = masked.replace(piiPatterns.uuid, '[ID_REDACTED]');
      masked = masked.replace(piiPatterns.employeeId, '[EMPLOYEE_ID_REDACTED]');
      masked = masked.replace(piiPatterns.phone, '[PHONE_REDACTED]');
      masked = masked.replace(piiPatterns.name, '[NAME_REDACTED]');
      masked = masked.replace(piiPatterns.ipAddress, '[IP_REDACTED]');
      return masked;
    };

    return {
      title: maskString(input.title),
      description: maskString(input.description),
      riskRating: input.riskRating,
      impact: maskString(input.impact),
      rootCause: maskString(input.rootCause),
      recommendation: maskString(input.recommendation),
      correctiveActionPlan: maskString(input.correctiveActionPlan),
      managementResponse: maskString(input.managementResponse),
      controlClauseRef: input.controlClauseRef,
      controlRequirement: maskString(input.controlRequirement),
      evidenceCount: input.evidenceCount,
      evidenceStatuses: input.evidenceStatuses,
      status: input.status,
      daysOpen: input.daysOpen,
      isOverdue: input.isOverdue,
      originalHash: this.generateInputHash(input),
    };
  }

  /**
   * Generate hash for cache key
   */
  private static generateInputHash(input: unknown): string {
    const normalized = JSON.stringify(input, Object.keys(input as object).sort());
    return crypto.createHash('sha256').update(normalized).digest('hex').substring(0, 16);
  }

  /**
   * Generate specific insight using OpenAI
   */
  private static async generateInsight(
    insightType: AIInsightType,
    input: MaskedObservationInput,
    userRole: 'AUDITOR' | 'AUDITEE'
  ): Promise<unknown> {
    const openai = this.getOpenAIClient();
    const prompt = AIPromptTemplates.getPrompt(insightType, input, userRole);

    const completion = await openai.chat.completions.create({
      model: config.ai.openai.model,
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
      max_tokens: config.ai.openai.maxTokens,
      temperature: config.ai.openai.temperature,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from OpenAI');
    }

    try {
      return JSON.parse(content);
    } catch (parseError) {
      logger.error('Failed to parse OpenAI response:', content);
      throw new Error('Invalid JSON response from OpenAI');
    }
  }

  /**
   * Get insight from Redis cache
   */
  private static async getFromCache(
    observationId: string,
    insightType: AIInsightType,
    inputHash: string
  ): Promise<unknown | null> {
    try {
      const cacheKey = `ai:insight:${observationId}:${insightType}:${inputHash}`;
      const cached = await RedisService.get(cacheKey);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  }

  /**
   * Store insight in database and cache
   */
  private static async storeInsight(
    observationId: string,
    insightType: AIInsightType,
    inputHash: string,
    result: unknown,
    userId: string,
    processingTimeMs: number
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + config.ai.cache.ttlHours * 60 * 60 * 1000);

    try {
      // Store in database
      await prisma.aIObservationInsight.upsert({
        where: {
          observationId_insightType_requestHash: {
            observationId,
            insightType: insightType as PrismaAIInsightType,
            requestHash: inputHash,
          },
        },
        update: {
          rawResponse: result as object,
          status: 'COMPLETED',
          processingTimeMs,
          modelUsed: config.ai.openai.model,
          expiresAt,
        },
        create: {
          observationId,
          insightType: insightType as PrismaAIInsightType,
          requestHash: inputHash,
          rawResponse: result as object,
          status: 'COMPLETED',
          processingTimeMs,
          modelUsed: config.ai.openai.model,
          requestedById: userId,
          expiresAt,
        },
      });

      // Store in Redis cache
      const cacheKey = `ai:insight:${observationId}:${insightType}:${inputHash}`;
      await RedisService.set(
        cacheKey,
        JSON.stringify(result),
        config.ai.cache.ttlHours * 60 * 60
      );
    } catch (error) {
      logger.error('Failed to store AI insight:', error);
    }
  }

  /**
   * Check rate limit for user
   */
  private static async checkRateLimit(userId: string): Promise<void> {
    const key = `ai:ratelimit:${userId}`;
    const count = await RedisService.incr(key);

    if (count === 1) {
      await RedisService.expire(key, config.ai.rateLimit.windowHours * 60 * 60);
    }

    if (count > config.ai.rateLimit.perUser) {
      throw AppError.badRequest(
        `AI insight rate limit exceeded. Maximum ${config.ai.rateLimit.perUser} requests per ${config.ai.rateLimit.windowHours} hours.`
      );
    }
  }

  /**
   * Check if user has required roles
   */
  private static canAccessAIInsights(roles: string[]): boolean {
    return roles.some(role => ALLOWED_ROLES.includes(role));
  }

  /**
   * Get observation data for analysis
   */
  private static async getObservationForAnalysis(observationId: string) {
    const observation = await prisma.observation.findUnique({
      where: { id: observationId },
      include: {
        evidence: {
          where: { deletedAt: null },
          select: { status: true },
        },
        control: {
          select: { clauseRef: true, requirement: true },
        },
      },
    });

    if (!observation) {
      throw AppError.notFound('Observation');
    }

    return observation;
  }

  /**
   * Prepare observation input for AI
   */
  private static prepareObservationInput(observation: {
    title: string;
    description: string;
    riskRating: string;
    impact: string | null;
    rootCause: string | null;
    recommendation: string | null;
    correctiveActionPlan: string | null;
    managementResponse: string | null;
    controlClauseRef: string | null;
    controlRequirement: string | null;
    control: { clauseRef: string; requirement: string | null } | null;
    evidence: { status: string }[];
    status: string;
    openDate: Date;
    targetDate: Date;
  }): ObservationAIInput {
    const daysOpen = Math.floor(
      (Date.now() - new Date(observation.openDate).getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      title: observation.title,
      description: observation.description,
      riskRating: observation.riskRating,
      impact: observation.impact || undefined,
      rootCause: observation.rootCause || undefined,
      recommendation: observation.recommendation || undefined,
      correctiveActionPlan: observation.correctiveActionPlan || undefined,
      managementResponse: observation.managementResponse || undefined,
      controlClauseRef: observation.controlClauseRef || observation.control?.clauseRef || undefined,
      controlRequirement: observation.controlRequirement || observation.control?.requirement || undefined,
      evidenceCount: observation.evidence?.length || 0,
      evidenceStatuses: observation.evidence?.map(e => e.status) || [],
      status: observation.status,
      daysOpen,
      isOverdue: observation.targetDate < new Date() && observation.status !== 'CLOSED',
    };
  }

  /**
   * Log AI request for audit trail
   */
  private static async logRequest(
    observationId: string,
    insightType: AIInsightType,
    userId: string,
    userEmail: string,
    maskedInput: MaskedObservationInput,
    inputHash: string,
    status: string,
    responseTimeMs: number,
    cacheHit: boolean
  ): Promise<void> {
    try {
      await prisma.aIRequestLog.create({
        data: {
          observationId,
          insightType: insightType as PrismaAIInsightType,
          userId,
          userEmail,
          maskedInput: maskedInput as object,
          inputHash,
          responseStatus: status,
          responseTimeMs,
          cacheHit,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      logger.error('Failed to log AI request:', error);
    }
  }

  /**
   * Get static fallback guidance when AI is unavailable
   */
  private static getStaticFallback(
    insightType: AIInsightType,
    input: MaskedObservationInput
  ): unknown {
    const riskLevel = input.riskRating || 'MEDIUM';

    // Static guidance based on risk rating
    const staticValidation: Partial<ValidationResult> = {
      alignmentScore: 50,
      auditDefensibility: 'ADEQUATE',
      aiConfidence: 0.3,
      keyGaps: [
        'AI service temporarily unavailable',
        'Manual review recommended',
      ],
      riskSeverityJustification: `Risk rating of ${riskLevel} should be validated against business impact.`,
      defensibilityFlags: [],
    };

    const staticRecommendations: Partial<RecommendationsResult> = {
      remediationPriority: riskLevel === 'CRITICAL' ? 'IMMEDIATE' : riskLevel === 'HIGH' ? 'HIGH' : 'MEDIUM',
      enhancedRecommendations: [],
      mappedStandards: [],
    };

    const staticEvidenceGuidance: Partial<EvidenceGuidanceResult> = {
      evidenceQualityMeter: input.evidenceCount === 0 ? 'WEAK' : input.evidenceCount < 3 ? 'PARTIAL' : 'STRONG',
      qualityExplanation: 'AI service temporarily unavailable. Please ensure evidence demonstrates control effectiveness.',
      mandatoryEvidence: [
        'Documentation of remediation actions taken',
        'Evidence of control implementation',
        'Management sign-off on remediation',
      ],
      acceptableFormats: ['PDF', 'DOCX', 'XLSX', 'PNG', 'JPG', 'Screenshot'],
      strongEvidenceExamples: [],
      weakEvidenceExamples: [],
      commonRejectionReasons: [
        'Evidence does not demonstrate control effectiveness',
        'Insufficient detail or context',
        'Missing dates or timestamps',
      ],
    };

    const staticRoleGuidance: Partial<RoleGuidanceResult> = {
      auditorInsights: [
        {
          category: 'Review',
          insight: 'AI service unavailable. Perform manual review.',
          priority: 'HIGH' as const,
          actionItems: ['Review observation completeness', 'Verify risk rating'],
        },
      ],
      auditeeActionGuidance: [
        {
          category: 'Action',
          insight: 'Ensure all required evidence is uploaded before requesting review.',
          priority: 'HIGH' as const,
          actionItems: ['Upload supporting documentation', 'Add management response'],
        },
      ],
    };

    const staticExecutiveSummary: Partial<ExecutiveSummaryResult> = {
      summary: `${input.title} - ${riskLevel} risk observation requiring attention.`,
      keyFindings: ['AI service temporarily unavailable for detailed analysis'],
      riskSummary: `This observation has been rated ${riskLevel} and requires appropriate remediation.`,
      recommendedActions: ['Complete remediation activities', 'Submit required evidence'],
      closureReadinessScore: input.evidenceCount > 0 && input.status === 'EVIDENCE_SUBMITTED' ? 60 : 30,
      closureReadinessExplanation: 'Manual assessment required. AI service temporarily unavailable.',
    };

    switch (insightType) {
      case 'VALIDATION':
        return staticValidation;
      case 'RECOMMENDATIONS':
        return staticRecommendations;
      case 'EVIDENCE_GUIDANCE':
        return staticEvidenceGuidance;
      case 'ROLE_GUIDANCE':
        return staticRoleGuidance;
      case 'EXECUTIVE_SUMMARY':
        return staticExecutiveSummary;
      case 'FULL_ANALYSIS':
        return {
          validation: staticValidation,
          recommendations: staticRecommendations,
          evidenceGuidance: staticEvidenceGuidance,
          roleGuidance: staticRoleGuidance,
          executiveSummary: staticExecutiveSummary,
        };
      default:
        return staticValidation;
    }
  }

  /**
   * Get insight history for an observation
   */
  static async getInsightHistory(observationId: string, limit = 20) {
    return prisma.aIObservationInsight.findMany({
      where: { observationId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        insightType: true,
        status: true,
        aiConfidence: true,
        processingTimeMs: true,
        createdAt: true,
        requestedBy: {
          select: { firstName: true, lastName: true, email: true },
        },
      },
    });
  }

  /**
   * Get a specific insight by ID
   */
  static async getInsightById(insightId: string) {
    const insight = await prisma.aIObservationInsight.findUnique({
      where: { id: insightId },
      include: {
        requestedBy: {
          select: { firstName: true, lastName: true, email: true },
        },
      },
    });

    if (!insight) {
      throw AppError.notFound('AI Insight');
    }

    return insight;
  }

  /**
   * Review uploaded evidence against observation requirements
   */
  static async reviewEvidence(
    evidenceId: string,
    userId: string,
    userEmail: string,
    userRoles: string[]
  ): Promise<EvidenceReviewResponse> {
    const startTime = Date.now();

    // Check RBAC
    if (!this.canAccessAIInsights(userRoles)) {
      throw AppError.forbidden('AI evidence review is only available to Auditor and Compliance roles');
    }

    // Check rate limit
    await this.checkRateLimit(userId);

    // Get evidence with observation data
    const evidence = await prisma.evidence.findUnique({
      where: { id: evidenceId },
      include: {
        observation: {
          include: {
            control: {
              select: { clauseRef: true, requirement: true },
            },
          },
        },
      },
    });

    if (!evidence) {
      throw AppError.notFound('Evidence');
    }

    if (!evidence.observation) {
      throw AppError.notFound('Associated observation');
    }

    // Prepare evidence review input
    const reviewInput: EvidenceReviewInput = {
      evidenceId: evidence.id,
      fileName: evidence.fileName,
      fileType: evidence.mimeType || this.getFileTypeFromName(evidence.fileName),
      fileSize: evidence.fileSize || 0,
      description: evidence.description || undefined,
      extractedText: await this.extractTextFromEvidence(evidence),
      observationContext: {
        title: evidence.observation.title,
        description: evidence.observation.description,
        riskRating: evidence.observation.riskRating,
        impact: evidence.observation.impact || undefined,
        recommendation: evidence.observation.recommendation || undefined,
        rootCause: evidence.observation.rootCause || undefined,
        controlClauseRef: evidence.observation.controlClauseRef || evidence.observation.control?.clauseRef || undefined,
        controlRequirement: evidence.observation.controlRequirement || evidence.observation.control?.requirement || undefined,
      },
    };

    // Mask PII from the review input
    const maskedInput = this.maskEvidenceReviewInput(reviewInput);

    try {
      // Generate review using OpenAI
      const result = await this.generateEvidenceReview(maskedInput);

      // Store review result in database
      await this.storeEvidenceReview(evidence.id, evidence.observationId, result, userId, Date.now() - startTime);

      // Log the request
      await this.logEvidenceReviewRequest(
        evidence.id,
        evidence.observationId,
        userId,
        userEmail,
        'success',
        Date.now() - startTime
      );

      return {
        evidenceId: evidence.id,
        observationId: evidence.observationId,
        review: result,
        metadata: {
          reviewedAt: new Date(),
          processingTimeMs: Date.now() - startTime,
          modelUsed: config.ai.openai.model,
        },
        disclaimer: AI_DISCLAIMER,
      };
    } catch (error) {
      logger.error('AI evidence review failed:', error);

      // Log the error
      await this.logEvidenceReviewRequest(
        evidence.id,
        evidence.observationId,
        userId,
        userEmail,
        'error',
        Date.now() - startTime
      );

      // Return static fallback
      if (config.ai.fallbackEnabled) {
        const fallbackResult = this.getStaticEvidenceReviewFallback(reviewInput);
        return {
          evidenceId: evidence.id,
          observationId: evidence.observationId,
          review: fallbackResult,
          metadata: {
            reviewedAt: new Date(),
            processingTimeMs: Date.now() - startTime,
            modelUsed: 'fallback',
          },
          disclaimer: AI_DISCLAIMER,
        };
      }

      throw AppError.internal('Failed to review evidence. Please try again later.');
    }
  }

  /**
   * Get file type from file name
   */
  private static getFileTypeFromName(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    const mimeTypes: Record<string, string> = {
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      txt: 'text/plain',
      csv: 'text/csv',
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Extract text from evidence file (placeholder for actual document parsing)
   */
  private static async extractTextFromEvidence(evidence: {
    fileName: string;
    mimeType: string | null;
    description: string | null;
    filePath: string | null;
  }): Promise<string | undefined> {
    // For now, return description as the text content
    // In a production system, this would integrate with:
    // - PDF parsing library (pdf-parse, pdfjs)
    // - Document parsing (mammoth for docx)
    // - OCR for images (tesseract.js)
    // - S3/storage service to download and process files

    const fileType = evidence.mimeType || this.getFileTypeFromName(evidence.fileName);

    // For text-based files, we could read content
    if (fileType === 'text/plain' || fileType === 'text/csv') {
      // Would read file content here
      return evidence.description || undefined;
    }

    // For images, we'd use OCR
    if (fileType.startsWith('image/')) {
      return `[Image file: ${evidence.fileName}] ${evidence.description || 'No description provided'}`;
    }

    // For PDFs and documents, we'd extract text
    if (fileType === 'application/pdf' || fileType.includes('document')) {
      return `[Document: ${evidence.fileName}] ${evidence.description || 'No description provided'}`;
    }

    // For spreadsheets
    if (fileType.includes('spreadsheet') || fileType.includes('excel')) {
      return `[Spreadsheet: ${evidence.fileName}] ${evidence.description || 'No description provided'}`;
    }

    return evidence.description || undefined;
  }

  /**
   * Mask PII from evidence review input
   */
  private static maskEvidenceReviewInput(input: EvidenceReviewInput): EvidenceReviewInput {
    const piiPatterns = {
      email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      uuid: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
      employeeId: /\b(EMP|USR|ID)[0-9]{4,}\b/gi,
      phone: /\b\+?[\d\s\-()]{10,}\b/g,
      name: /\b(Mr\.|Mrs\.|Ms\.|Dr\.)\s+[A-Z][a-z]+\s+[A-Z][a-z]+\b/g,
      ipAddress: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
    };

    const maskString = (str: string | undefined): string | undefined => {
      if (!str) return str;
      let masked = str;
      masked = masked.replace(piiPatterns.email, '[EMAIL_REDACTED]');
      masked = masked.replace(piiPatterns.uuid, '[ID_REDACTED]');
      masked = masked.replace(piiPatterns.employeeId, '[EMPLOYEE_ID_REDACTED]');
      masked = masked.replace(piiPatterns.phone, '[PHONE_REDACTED]');
      masked = masked.replace(piiPatterns.name, '[NAME_REDACTED]');
      masked = masked.replace(piiPatterns.ipAddress, '[IP_REDACTED]');
      return masked;
    };

    return {
      ...input,
      description: maskString(input.description),
      extractedText: maskString(input.extractedText),
      observationContext: {
        ...input.observationContext,
        title: maskString(input.observationContext.title) || '',
        description: maskString(input.observationContext.description) || '',
        impact: maskString(input.observationContext.impact),
        recommendation: maskString(input.observationContext.recommendation),
        rootCause: maskString(input.observationContext.rootCause),
        controlRequirement: maskString(input.observationContext.controlRequirement),
      },
    };
  }

  /**
   * Generate evidence review using OpenAI
   */
  private static async generateEvidenceReview(input: EvidenceReviewInput): Promise<EvidenceReviewResult> {
    const openai = this.getOpenAIClient();
    const prompt = AIPromptTemplates.getEvidenceReviewPrompt(input);

    const completion = await openai.chat.completions.create({
      model: config.ai.openai.model,
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
      max_tokens: config.ai.openai.maxTokens,
      temperature: config.ai.openai.temperature,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from OpenAI');
    }

    try {
      return JSON.parse(content) as EvidenceReviewResult;
    } catch (parseError) {
      logger.error('Failed to parse OpenAI evidence review response:', content);
      throw new Error('Invalid JSON response from OpenAI');
    }
  }

  /**
   * Store evidence review in database
   */
  private static async storeEvidenceReview(
    evidenceId: string,
    observationId: string,
    result: EvidenceReviewResult,
    userId: string,
    processingTimeMs: number
  ): Promise<void> {
    try {
      // Update evidence with AI review
      await prisma.evidence.update({
        where: { id: evidenceId },
        data: {
          aiReview: result as object,
          aiReviewedAt: new Date(),
          aiReviewedById: userId,
        },
      });
    } catch (error) {
      logger.error('Failed to store evidence review:', error);
    }
  }

  /**
   * Log evidence review request
   */
  private static async logEvidenceReviewRequest(
    evidenceId: string,
    observationId: string,
    userId: string,
    userEmail: string,
    status: string,
    responseTimeMs: number
  ): Promise<void> {
    try {
      await prisma.aIRequestLog.create({
        data: {
          observationId,
          insightType: 'EVIDENCE_GUIDANCE',
          userId,
          userEmail,
          maskedInput: { evidenceId, type: 'EVIDENCE_REVIEW' },
          inputHash: crypto.createHash('sha256').update(evidenceId).digest('hex').substring(0, 16),
          responseStatus: status,
          responseTimeMs,
          cacheHit: false,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      logger.error('Failed to log evidence review request:', error);
    }
  }

  /**
   * Static fallback for evidence review when AI is unavailable
   */
  private static getStaticEvidenceReviewFallback(input: EvidenceReviewInput): EvidenceReviewResult {
    return {
      overallAssessment: 'PARTIAL',
      relevanceScore: 50,
      sufficiencyScore: 50,
      summary: 'AI review service is temporarily unavailable. Please have this evidence manually reviewed by the assigned auditor.',
      strengths: [
        'Evidence has been submitted for review',
        input.description ? 'Description provided with submission' : 'File submitted successfully',
      ],
      weaknesses: [
        'Automated analysis unavailable',
        'Manual review required',
      ],
      missingElements: [
        'AI analysis pending - please request manual review',
      ],
      recommendations: [
        'Request manual review from assigned auditor',
        'Ensure evidence clearly addresses the finding description',
        'Provide additional context in the evidence description if needed',
      ],
      addressesRisk: false, // Cannot determine without AI
      addressesRecommendation: false, // Cannot determine without AI
      suggestedNextSteps: [
        'Wait for manual auditor review',
        'Consider uploading additional supporting evidence',
        'Add detailed description explaining how this evidence addresses the finding',
      ],
      aiConfidence: 0.1,
    };
  }

  /**
   * Get evidence review for a specific evidence item
   */
  static async getEvidenceReview(evidenceId: string) {
    const evidence = await prisma.evidence.findUnique({
      where: { id: evidenceId },
      select: {
        id: true,
        observationId: true,
        aiReview: true,
        aiReviewedAt: true,
        aiReviewedBy: {
          select: { firstName: true, lastName: true, email: true },
        },
      },
    });

    if (!evidence) {
      throw AppError.notFound('Evidence');
    }

    if (!evidence.aiReview) {
      return null;
    }

    return {
      evidenceId: evidence.id,
      observationId: evidence.observationId,
      review: evidence.aiReview as EvidenceReviewResult,
      reviewedAt: evidence.aiReviewedAt,
      reviewedBy: evidence.aiReviewedBy,
    };
  }
}
