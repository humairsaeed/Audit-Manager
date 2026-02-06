'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  ArrowLeftIcon,
  PencilIcon,
  DocumentArrowUpIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  UserIcon,
  CalendarIcon,
  ExclamationTriangleIcon,
  TrashIcon,
  PaperClipIcon,
  ChatBubbleLeftRightIcon,
  ArrowPathIcon,
  PaperAirplaneIcon,
} from '@heroicons/react/24/outline';
import { observationsApi, evidenceApi, aiInsightsApi, auditLogsApi } from '@/lib/api';
import { useAuthStore, ROLES } from '@/stores/auth';
import { AIAssistPanel } from '@/components/observations/AIAssistPanel';
import { SparklesIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import type { EvidenceReviewResult } from '@/types/ai-insights';

const riskColors: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700',
  HIGH: 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-700',
  MEDIUM: 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-700',
  LOW: 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700',
  INFORMATIONAL: 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600',
};

const statusColors: Record<string, string> = {
  OPEN: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  IN_PROGRESS: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  EVIDENCE_SUBMITTED: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
  UNDER_REVIEW: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  REJECTED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  CLOSED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  OVERDUE: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

const statusTransitions: Record<string, { label: string; action: string; color: string }[]> = {
  OPEN: [{ label: 'Start Progress', action: 'IN_PROGRESS', color: 'btn-primary' }],
  IN_PROGRESS: [{ label: 'Submit Evidence', action: 'EVIDENCE_SUBMITTED', color: 'btn-primary' }],
  EVIDENCE_SUBMITTED: [
    { label: 'Start Review', action: 'UNDER_REVIEW', color: 'btn-primary' },
  ],
  UNDER_REVIEW: [
    { label: 'Approve & Close', action: 'CLOSED', color: 'btn-success' },
    { label: 'Reject', action: 'REJECTED', color: 'btn-danger' },
  ],
  REJECTED: [{ label: 'Resubmit Evidence', action: 'EVIDENCE_SUBMITTED', color: 'btn-primary' }],
};

export default function ObservationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, hasAnyRole } = useAuthStore();
  const observationId = params.id as string;

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [comment, setComment] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [evidenceDescription, setEvidenceDescription] = useState('');
  const [previewEvidence, setPreviewEvidence] = useState<{ id: string; url: string; fileName?: string; mimeType?: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [aiReviewModal, setAiReviewModal] = useState<{ evidenceId: string; review: EvidenceReviewResult; fileName: string } | null>(null);
  const [reviewingEvidenceId, setReviewingEvidenceId] = useState<string | null>(null);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [followUpMessage, setFollowUpMessage] = useState('');

  const canEdit = hasAnyRole(ROLES.SYSTEM_ADMIN, ROLES.AUDIT_ADMIN, ROLES.AUDITOR);
  const canReview = hasAnyRole(ROLES.SYSTEM_ADMIN, ROLES.AUDIT_ADMIN, ROLES.COMPLIANCE_MANAGER);
  const canDelete = hasAnyRole(ROLES.SYSTEM_ADMIN);
  const canViewActivityLogs = hasAnyRole(ROLES.SYSTEM_ADMIN);
  const canFollowUp = hasAnyRole(ROLES.SYSTEM_ADMIN, ROLES.AUDIT_ADMIN, ROLES.AUDITOR);

  // Fetch observation details
  const { data: observation, isLoading, error } = useQuery({
    queryKey: ['observation', observationId],
    queryFn: async () => {
      const response = await observationsApi.getById(observationId);
      // Handle both response structures: { observation: {...} } or direct data
      const data = response.data as any;
      return data?.observation || data;
    },
    enabled: !!observationId && observationId !== 'undefined',
  });

  // Fetch evidence for this observation
  const { data: evidenceList } = useQuery({
    queryKey: ['evidence', observationId],
    queryFn: async () => {
      const response = await evidenceApi.list(observationId);
      const data = response.data as any;
      return data?.evidence || data?.data || [];
    },
    enabled: !!observationId && observationId !== 'undefined',
  });

  // Fetch observation activity logs (admin only)
  const { data: activityLogs } = useQuery({
    queryKey: ['observation-activity-logs', observationId],
    queryFn: async () => {
      const response = await auditLogsApi.list({
        resourceId: observationId,
        limit: 50,
      });
      return response.data?.data || [];
    },
    enabled: !!observationId && observationId !== 'undefined' && canViewActivityLogs,
  });

  // Status transition mutation
  const statusMutation = useMutation({
    mutationFn: async ({ status, comment }: { status: string; comment?: string }) => {
      return observationsApi.updateStatus(observationId, status, comment);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['observation', observationId] });
      toast.success('Status updated successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update status');
    },
  });

  // Upload evidence mutation
  const uploadMutation = useMutation({
    mutationFn: async ({ file, description }: { file: File; description: string }) => {
      // Pass file.name as the name parameter and description as optional
      return evidenceApi.upload(observationId, file, file.name, description);
    },
    onSuccess: async (response: any) => {
      queryClient.invalidateQueries({ queryKey: ['evidence', observationId] });
      setShowUploadModal(false);
      setSelectedFile(null);
      setEvidenceDescription('');
      toast.success('Evidence uploaded successfully');

      // Trigger AI review automatically if user has access
      const evidenceId = response?.data?.evidence?.id || response?.data?.id;
      if (evidenceId && canUseAI) {
        toast.loading('Analyzing evidence with AI...', { id: 'ai-review' });
        try {
          await aiInsightsApi.reviewEvidence(evidenceId);
          queryClient.invalidateQueries({ queryKey: ['evidence', observationId] });
          toast.success('AI analysis complete', { id: 'ai-review' });
        } catch {
          toast.error('AI analysis unavailable', { id: 'ai-review' });
        }
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to upload evidence');
    },
  });

  // Add comment mutation
  const commentMutation = useMutation({
    mutationFn: async (content: string) => {
      return observationsApi.addComment(observationId, content);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['observation', observationId] });
      setShowCommentModal(false);
      setComment('');
      toast.success('Comment added successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to add comment');
    },
  });

  const followUpMutation = useMutation({
    mutationFn: async (message: string) => {
      return observationsApi.followUp(observationId, message);
    },
    onSuccess: () => {
      setShowFollowUpModal(false);
      setFollowUpMessage('');
      toast.success('Follow-up sent successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to send follow-up');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return observationsApi.delete(observationId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['observations'] });
      queryClient.invalidateQueries({ queryKey: ['my-observations-owned'] });
      queryClient.invalidateQueries({ queryKey: ['my-observations-reviewing'] });
      queryClient.invalidateQueries({ queryKey: ['my-observations-overdue'] });
      toast.success('Observation deleted successfully');
      router.push('/observations');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to delete observation');
    },
  });

  const deleteEvidenceMutation = useMutation({
    mutationFn: async (evidenceId: string) => {
      return evidenceApi.delete(evidenceId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evidence', observationId] });
      toast.success('Evidence deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to delete evidence');
    },
  });

  // AI Evidence Review mutation
  const aiReviewMutation = useMutation({
    mutationFn: async (evidenceId: string) => {
      setReviewingEvidenceId(evidenceId);
      const response = await aiInsightsApi.reviewEvidence(evidenceId);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['evidence', observationId] });
      toast.success('AI review completed');
      setReviewingEvidenceId(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'AI review failed');
      setReviewingEvidenceId(null);
    },
  });

  // Check if user can access AI features
  const canUseAI = hasAnyRole(ROLES.SYSTEM_ADMIN, ROLES.AUDIT_ADMIN, ROLES.COMPLIANCE_MANAGER, ROLES.AUDITOR);

  const handleStatusChange = (newStatus: string) => {
    if (newStatus === 'REJECTED') {
      const reason = window.prompt('Please provide a reason for rejection:');
      if (!reason) return;
      statusMutation.mutate({ status: newStatus, comment: reason });
    } else {
      statusMutation.mutate({ status: newStatus });
    }
  };

  const handleUpload = () => {
    if (!selectedFile) {
      toast.error('Please select a file');
      return;
    }
    uploadMutation.mutate({ file: selectedFile, description: evidenceDescription });
  };

  const handleAddComment = () => {
    if (!comment.trim()) {
      toast.error('Please enter a comment');
      return;
    }
    commentMutation.mutate(comment);
  };

  const handleSendFollowUp = () => {
    if (!followUpMessage.trim()) {
      toast.error('Please enter a follow-up message');
      return;
    }
    followUpMutation.mutate(followUpMessage.trim());
  };

  const getEvidenceUrl = async (evidenceId: string) => {
    const response = await evidenceApi.getDownloadUrl(evidenceId);
    const payload = (response as any).data || response;
    return {
      url: payload?.url as string | undefined,
      fileName: payload?.fileName as string | undefined,
      mimeType: payload?.mimeType as string | undefined,
    };
  };

  const handleDownloadEvidence = async (evidenceId: string) => {
    try {
      const { url, fileName } = await getEvidenceUrl(evidenceId);
      if (!url) {
        throw new Error('Download URL not available');
      }
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName || 'evidence';
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error: any) {
      toast.error(error.response?.data?.message || error.message || 'Failed to download evidence');
    }
  };

  const handlePreviewEvidence = async (evidenceId: string) => {
    try {
      setPreviewLoading(true);
      const { url, fileName, mimeType } = await getEvidenceUrl(evidenceId);
      if (!url) {
        throw new Error('Preview URL not available');
      }
      setPreviewEvidence({ id: evidenceId, url, fileName, mimeType });
    } catch (error: any) {
      toast.error(error.response?.data?.message || error.message || 'Failed to load preview');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleDelete = () => {
    if (deleteMutation.isPending) return;
    const confirmed = window.confirm('Are you sure you want to delete this observation? This action cannot be undone.');
    if (!confirmed) return;
    deleteMutation.mutate();
  };

  const isOwner = observation?.ownerId === user?.id;
  const isReviewer = observation?.reviewerId === user?.id;
  const isOverdue = observation?.targetDate && new Date(observation.targetDate) < new Date() && observation.status !== 'CLOSED';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error || !observation) {
    return (
      <div className="text-center py-12">
        <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-red-500 dark:text-red-400" />
        <h3 className="mt-2 text-lg font-medium text-slate-900 dark:text-slate-100">Observation not found</h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">The observation you're looking for doesn't exist.</p>
        <Link href="/observations" className="btn btn-primary mt-4">
          Back to Observations
        </Link>
      </div>
    );
  }

  const availableTransitions = statusTransitions[observation.status] || [];
  const canReviewerAct = canReview || isReviewer;
  const canOwnerAct = isOwner || canEdit;
  const filteredTransitions = availableTransitions.filter((transition) => {
    switch (transition.action) {
      case 'IN_PROGRESS':
        return canOwnerAct;
      case 'EVIDENCE_SUBMITTED':
        return canOwnerAct;
      case 'UNDER_REVIEW':
        return canReviewerAct;
      case 'CLOSED':
      case 'REJECTED':
        return canReviewerAct;
      default:
        return false;
    }
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Link href="/observations" className="mt-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            <ArrowLeftIcon className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{observation.title}</h1>
              <span className={clsx('badge', statusColors[observation.status])}>
                {observation.status.replace(/_/g, ' ')}
              </span>
              {isOverdue && (
                <span className="badge bg-red-100 text-red-800 ring-2 ring-red-500 dark:bg-red-900/30 dark:text-red-400">
                  OVERDUE
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {observation.globalSequence}
              {observation.externalReference && ` • ${observation.externalReference}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canEdit &&
            observation.status !== 'CLOSED' && (
            <Link href={`/observations/${observationId}/edit`} className="btn btn-secondary">
              <PencilIcon className="h-4 w-4 mr-2" />
              Edit
            </Link>
          )}
          {canDelete && (
            <button
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="btn btn-danger"
            >
              <TrashIcon className="h-4 w-4 mr-2" />
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Description</h2>
            <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{observation.description}</p>
          </div>

          {/* Analysis & Recommendations */}
          {(observation.impact || observation.recommendation || observation.rootCause) && (
            <div className="card p-6">
              {observation.impact && (
                <div className="mb-6">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">Risk</h2>
                  <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{observation.impact}</p>
                </div>
              )}
              {observation.recommendation && (
                <div className="mb-6">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">Recommendation</h2>
                  <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{observation.recommendation}</p>
                </div>
              )}
              {observation.rootCause && (
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">Root Cause</h2>
                  <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{observation.rootCause}</p>
                </div>
              )}
            </div>
          )}

          {/* Management Response */}
          {observation.managementResponse && (
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">Management Response</h2>
              <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{observation.managementResponse}</p>
            </div>
          )}

          {/* Action Plan */}
          {observation.correctiveActionPlan && (
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">Action Plan</h2>
              <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{observation.correctiveActionPlan}</p>
            </div>
          )}

          {/* AI Assist Panel - Only visible to Auditors/Compliance roles */}
          <AIAssistPanel observationId={observationId} />

          {/* Evidence Section */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                <PaperClipIcon className="inline h-5 w-5 mr-2" />
                Evidence
              </h2>
              {(isOwner || canEdit) && observation.status !== 'CLOSED' && (
                <button onClick={() => setShowUploadModal(true)} className="btn btn-secondary btn-sm">
                  <DocumentArrowUpIcon className="h-4 w-4 mr-2" />
                  Upload Evidence
                </button>
              )}
            </div>

            {evidenceList && evidenceList.length > 0 ? (
              <div className="space-y-3">
                {evidenceList.map((evidence: any) => (
                  <div key={evidence.id} className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <PaperClipIcon className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                        <div>
                          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{evidence.fileName}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {evidence.description} - v{evidence.version} - {new Date(evidence.uploadedAt || evidence.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={clsx('badge text-xs', {
                          'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400': evidence.status === 'PENDING_REVIEW',
                          'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400': evidence.status === 'APPROVED',
                          'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400': evidence.status === 'REJECTED',
                        })}>
                          {evidence.status.replace(/_/g, ' ')}
                        </span>
                        <button
                          onClick={() => handlePreviewEvidence(evidence.id)}
                          disabled={previewLoading}
                          className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 text-sm"
                        >
                          View
                        </button>
                        <button
                          onClick={() => handleDownloadEvidence(evidence.id)}
                          className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 text-sm"
                        >
                          Download
                        </button>
                        {(isOwner || canEdit || evidence.uploadedById === user?.id) && observation.status !== 'CLOSED' && (
                          <button
                            onClick={() => deleteEvidenceMutation.mutate(evidence.id)}
                            className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-sm"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>

                    {/* AI Review Section */}
                    {canUseAI && (
                      <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-600">
                        {evidence.aiReview ? (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 flex-wrap">
                                <SparklesIcon className="h-4 w-4 text-purple-500" />
                                <span className="text-xs text-slate-600 dark:text-slate-400">AI Assessment:</span>
                                <span className={clsx('badge text-xs', {
                                  'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400': evidence.aiReview.overallAssessment === 'SUFFICIENT',
                                  'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400': evidence.aiReview.overallAssessment === 'PARTIAL',
                                  'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400': evidence.aiReview.overallAssessment === 'INSUFFICIENT',
                                })}>
                                  {evidence.aiReview.overallAssessment}
                                </span>
                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                  ({evidence.aiReview.relevanceScore}% relevant)
                                </span>
                              </div>
                              <button
                                onClick={() => setAiReviewModal({ evidenceId: evidence.id, review: evidence.aiReview, fileName: evidence.fileName })}
                                className="text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 text-xs font-medium"
                              >
                                View Full Review
                              </button>
                            </div>
                            {/* Standards Compliance Summary */}
                            {evidence.aiReview.standardsCompliance && evidence.aiReview.standardsCompliance.length > 0 && (
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs text-slate-500 dark:text-slate-400">Standards:</span>
                                {evidence.aiReview.standardsCompliance.slice(0, 3).map((mapping: any, idx: number) => {
                                  const labels: Record<string, string> = { ISO_27001: 'ISO', NIST_CSF: 'NIST', SOC2: 'SOC2', CIS_CONTROLS: 'CIS' };
                                  const colors: Record<string, string> = {
                                    COMPLIANT: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                                    PARTIAL: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
                                    NON_COMPLIANT: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                                    NOT_APPLICABLE: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400',
                                  };
                                  return (
                                    <span key={idx} className={clsx('px-1.5 py-0.5 rounded text-xs font-medium', colors[mapping.complianceStatus])}>
                                      {labels[mapping.standard]} {mapping.controlNumber}
                                    </span>
                                  );
                                })}
                                {evidence.aiReview.standardsCompliance.length > 3 && (
                                  <span className="text-xs text-slate-500 dark:text-slate-400">
                                    +{evidence.aiReview.standardsCompliance.length - 3} more
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              <SparklesIcon className="h-4 w-4 inline mr-1 text-slate-400" />
                              No AI review yet
                            </span>
                            <button
                              onClick={() => aiReviewMutation.mutate(evidence.id)}
                              disabled={reviewingEvidenceId === evidence.id || aiReviewMutation.isPending}
                              className="text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 text-xs font-medium disabled:opacity-50"
                            >
                              {reviewingEvidenceId === evidence.id ? (
                                <>
                                  <ArrowPathIcon className="h-3 w-3 inline mr-1 animate-spin" />
                                  Analyzing...
                                </>
                              ) : (
                                'Review with AI'
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 dark:text-slate-400 text-center py-4">No evidence uploaded yet</p>
            )}
          </div>

          {/* Comments Section */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                <ChatBubbleLeftRightIcon className="inline h-5 w-5 mr-2" />
                Comments
              </h2>
              <button onClick={() => setShowCommentModal(true)} className="btn btn-secondary btn-sm">
                Add Comment
              </button>
            </div>

            {observation.comments && observation.comments.length > 0 ? (
              <div className="space-y-4">
                {observation.comments.map((comment: any) => (
                  <div key={comment.id} className="border-l-2 border-slate-200 dark:border-slate-700 pl-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {comment.user?.displayName || `${comment.user?.firstName} ${comment.user?.lastName}`}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {new Date(comment.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 dark:text-slate-300">{comment.content}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 dark:text-slate-400 text-center py-4">No comments yet</p>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Risk Rating Card */}
          <div className={clsx('card p-6 border-2', riskColors[observation.riskRating])}>
            <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Risk Rating</h3>
            <p className="text-2xl font-bold">{observation.riskRating}</p>
          </div>

          {/* Status Actions */}
            {(filteredTransitions.length > 0 || (canFollowUp && observation.status !== 'CLOSED' && (observation.ownerId || observation.reviewerId))) && (
            <div className="card p-6">
              <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-3">Actions</h3>
              <div className="space-y-2">
                {filteredTransitions.map((transition) => (
                  <button
                    key={transition.action}
                    onClick={() => handleStatusChange(transition.action)}
                    disabled={statusMutation.isPending}
                    className={clsx('w-full btn', transition.color)}
                  >
                    {statusMutation.isPending ? (
                      <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />
                    ) : null}
                    {transition.label}
                  </button>
                ))}
                  {canFollowUp && observation.status !== 'CLOSED' && (observation.ownerId || observation.reviewerId) && (
                  <button
                    onClick={() => setShowFollowUpModal(true)}
                    className="btn btn-secondary w-full"
                  >
                    <PaperAirplaneIcon className="h-4 w-4 mr-2" />
                    Send Follow-up
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Details Card */}
          <div className="card p-6">
            <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-4">Details</h3>
            <dl className="space-y-4">
              <div>
                <dt className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <ClockIcon className="h-4 w-4" />
                  Due Date
                </dt>
                <dd className={clsx('text-sm font-medium', isOverdue ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-slate-100')}>
                  {new Date(observation.targetDate).toLocaleDateString()}
                  {isOverdue && ' (Overdue)'}
                </dd>
              </div>

              <div>
                <dt className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <UserIcon className="h-4 w-4" />
                  Owner
                </dt>
                <dd className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {observation.owner?.displayName || observation.owner?.firstName
                    ? `${observation.owner.firstName} ${observation.owner.lastName}`
                    : 'Unassigned'}
                </dd>
              </div>

              {observation.reviewer && (
                <div>
                  <dt className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
                    <CheckCircleIcon className="h-4 w-4" />
                    Reviewer
                  </dt>
                  <dd className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {observation.reviewer.displayName ||
                      `${observation.reviewer.firstName} ${observation.reviewer.lastName}`}
                  </dd>
                </div>
              )}

              <div>
                <dt className="text-sm text-slate-500 dark:text-slate-400">Audit</dt>
                <dd className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  <Link href={`/audits/${observation.auditId}`} className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300">
                    {observation.audit?.name}
                  </Link>
                </dd>
              </div>

              {observation.entity && (
                <div>
                  <dt className="text-sm text-slate-500 dark:text-slate-400">Entity</dt>
                  <dd className="text-sm font-medium text-slate-900 dark:text-slate-100">{observation.entity.name}</dd>
                </div>
              )}

              {observation.department && (
                <div>
                  <dt className="text-sm text-slate-500 dark:text-slate-400">Department</dt>
                  <dd className="text-sm font-medium text-slate-900 dark:text-slate-100">{observation.department}</dd>
                </div>
              )}

              {observation.category && (
                <div>
                  <dt className="text-sm text-slate-500 dark:text-slate-400">Category</dt>
                  <dd className="text-sm font-medium text-slate-900 dark:text-slate-100">{observation.category}</dd>
                </div>
              )}

              <div>
                <dt className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  Created
                </dt>
                <dd className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {new Date(observation.createdAt).toLocaleDateString()}
                </dd>
              </div>
            </dl>
          </div>

          {/* History */}
          {observation.statusHistory && observation.statusHistory.length > 0 && (
            <div className="card p-6">
              <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-4">Status History</h3>
                <div className="space-y-3">
                  {observation.statusHistory.slice(0, 5).map((history: any, index: number) => (
                    <div key={index} className="flex items-start gap-3">
                      <div className="flex-shrink-0">
                        <div className="w-2 h-2 mt-2 rounded-full bg-slate-400 dark:bg-slate-500" />
                      </div>
                    <div>
                      <p className="text-sm text-slate-900 dark:text-slate-100">
                        {history.fromStatus} → {history.toStatus}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {new Date(history.changedAt).toLocaleString()}
                      </p>
                      {history.changedByName && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          by {history.changedByName}
                        </p>
                      )}
                    </div>
                  </div>
                  ))}
                </div>
            </div>
          )}

          {/* Activity Logs */}
          {canViewActivityLogs && (
            <div className="card p-6">
              <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-4">Activity Logs</h3>
              {activityLogs?.length ? (
                <div className="space-y-3">
                  {activityLogs.slice(0, 8).map((log: any) => (
                    <div key={log.id} className="flex items-start gap-3">
                      <div className="flex-shrink-0">
                        <div className="w-2 h-2 mt-2 rounded-full bg-slate-300 dark:bg-slate-600" />
                      </div>
                      <div>
                        <p className="text-sm text-slate-900 dark:text-slate-100">{log.description}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {new Date(log.timestamp).toLocaleString()}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          by {log.user?.firstName || log.userEmail || 'System'} {log.user?.lastName || ''}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400">No activity logs yet.</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setShowUploadModal(false)} />
            <div className="relative bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Upload Evidence</h3>
              <div className="space-y-4">
                <div>
                  <label className="label">File</label>
                  <input
                    type="file"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Description</label>
                  <textarea
                    value={evidenceDescription}
                    onChange={(e) => setEvidenceDescription(e.target.value)}
                    className="input"
                    rows={3}
                    placeholder="Describe the evidence..."
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setShowUploadModal(false)} className="btn btn-secondary">
                    Cancel
                  </button>
                  <button
                    onClick={handleUpload}
                    disabled={uploadMutation.isPending}
                    className="btn btn-primary"
                  >
                    {uploadMutation.isPending ? 'Uploading...' : 'Upload'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Comment Modal */}
      {showCommentModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setShowCommentModal(false)} />
            <div className="relative bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Add Comment</h3>
              <div className="space-y-4">
                <div>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="input"
                    rows={4}
                    placeholder="Enter your comment..."
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setShowCommentModal(false)} className="btn btn-secondary">
                    Cancel
                  </button>
                  <button
                    onClick={handleAddComment}
                    disabled={commentMutation.isPending}
                    className="btn btn-primary"
                  >
                    {commentMutation.isPending ? 'Adding...' : 'Add Comment'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showFollowUpModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setShowFollowUpModal(false)} />
            <div className="relative bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-lg w-full p-6">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
                Send Follow-up
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                This will notify the observation owner and reviewer.
              </p>
              <div className="mb-4">
                <label className="label">Message *</label>
                <textarea
                  value={followUpMessage}
                  onChange={(e) => setFollowUpMessage(e.target.value)}
                  className="input min-h-[120px]"
                  placeholder="Enter follow-up instructions or request..."
                />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowFollowUpModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button
                  onClick={handleSendFollowUp}
                  disabled={followUpMutation.isPending}
                  className="btn btn-primary"
                >
                  {followUpMutation.isPending ? 'Sending...' : 'Send'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {previewEvidence && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setPreviewEvidence(null)} />
            <div className="relative bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-4xl w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {previewEvidence.fileName || 'Evidence Preview'}
                </h3>
                <button onClick={() => setPreviewEvidence(null)} className="btn btn-secondary btn-sm">
                  Close
                </button>
              </div>
              {previewEvidence.mimeType?.startsWith('image/') ? (
                <div className="flex justify-center">
                  <img
                    src={previewEvidence.url}
                    alt={previewEvidence.fileName || 'Evidence'}
                    className="max-h-[70vh] max-w-full object-contain"
                  />
                </div>
              ) : previewEvidence.mimeType === 'application/pdf' ? (
                <iframe
                  src={previewEvidence.url}
                  title={previewEvidence.fileName || 'Evidence'}
                  className="w-full h-[70vh] border rounded dark:border-slate-700"
                />
              ) : (
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  Preview not available for this file type.
                  <div className="mt-3 flex items-center justify-center gap-2">
                    <button
                      onClick={() => handleDownloadEvidence(previewEvidence.id)}
                      className="btn btn-primary btn-sm"
                    >
                      Download
                    </button>
                    <button
                      onClick={() => window.open(previewEvidence.url, '_blank', 'noopener,noreferrer')}
                      className="btn btn-secondary btn-sm"
                    >
                      Open in new tab
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* AI Review Modal */}
      {aiReviewModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setAiReviewModal(null)} />
            <div className="relative bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <SparklesIcon className="h-5 w-5 text-purple-500" />
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    AI Evidence Review
                  </h3>
                </div>
                <button onClick={() => setAiReviewModal(null)} className="btn btn-secondary btn-sm">
                  Close
                </button>
              </div>

              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                Review for: <span className="font-medium text-slate-700 dark:text-slate-300">{aiReviewModal.fileName}</span>
              </p>

              {/* Overall Assessment */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Overall Assessment</span>
                  <span className={clsx('badge', {
                    'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400': aiReviewModal.review.overallAssessment === 'SUFFICIENT',
                    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400': aiReviewModal.review.overallAssessment === 'PARTIAL',
                    'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400': aiReviewModal.review.overallAssessment === 'INSUFFICIENT',
                  })}>
                    {aiReviewModal.review.overallAssessment}
                  </span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-700 p-3 rounded-lg">
                  {aiReviewModal.review.summary}
                </p>
              </div>

              {/* Scores */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <span className="text-xs text-slate-500 dark:text-slate-400">Relevance Score</span>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                      <div
                        className={clsx('h-2 rounded-full', {
                          'bg-green-500': aiReviewModal.review.relevanceScore >= 70,
                          'bg-yellow-500': aiReviewModal.review.relevanceScore >= 40 && aiReviewModal.review.relevanceScore < 70,
                          'bg-red-500': aiReviewModal.review.relevanceScore < 40,
                        })}
                        style={{ width: `${aiReviewModal.review.relevanceScore}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{aiReviewModal.review.relevanceScore}%</span>
                  </div>
                </div>
                <div>
                  <span className="text-xs text-slate-500 dark:text-slate-400">Sufficiency Score</span>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                      <div
                        className={clsx('h-2 rounded-full', {
                          'bg-green-500': aiReviewModal.review.sufficiencyScore >= 70,
                          'bg-yellow-500': aiReviewModal.review.sufficiencyScore >= 40 && aiReviewModal.review.sufficiencyScore < 70,
                          'bg-red-500': aiReviewModal.review.sufficiencyScore < 40,
                        })}
                        style={{ width: `${aiReviewModal.review.sufficiencyScore}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{aiReviewModal.review.sufficiencyScore}%</span>
                  </div>
                </div>
              </div>

              {/* Addresses Risk & Recommendation */}
              <div className="flex gap-4 mb-6">
                <div className={clsx('flex-1 p-3 rounded-lg', aiReviewModal.review.addressesRisk ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20')}>
                  <div className="flex items-center gap-2">
                    {aiReviewModal.review.addressesRisk ? (
                      <CheckCircleIcon className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircleIcon className="h-5 w-5 text-red-500" />
                    )}
                    <span className={clsx('text-sm font-medium', aiReviewModal.review.addressesRisk ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400')}>
                      {aiReviewModal.review.addressesRisk ? 'Addresses Risk' : 'Does Not Address Risk'}
                    </span>
                  </div>
                </div>
                <div className={clsx('flex-1 p-3 rounded-lg', aiReviewModal.review.addressesRecommendation ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20')}>
                  <div className="flex items-center gap-2">
                    {aiReviewModal.review.addressesRecommendation ? (
                      <CheckCircleIcon className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircleIcon className="h-5 w-5 text-red-500" />
                    )}
                    <span className={clsx('text-sm font-medium', aiReviewModal.review.addressesRecommendation ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400')}>
                      {aiReviewModal.review.addressesRecommendation ? 'Addresses Recommendation' : 'Does Not Address Recommendation'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Strengths */}
              {aiReviewModal.review.strengths && aiReviewModal.review.strengths.length > 0 && (
                <div className="mb-4">
                  <span className="text-sm font-medium text-green-700 dark:text-green-400">Strengths</span>
                  <ul className="mt-2 space-y-1">
                    {aiReviewModal.review.strengths.map((strength: string, index: number) => (
                      <li key={index} className="text-sm text-slate-600 dark:text-slate-400 flex items-start gap-2">
                        <CheckCircleIcon className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>{strength}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Weaknesses */}
              {aiReviewModal.review.weaknesses && aiReviewModal.review.weaknesses.length > 0 && (
                <div className="mb-4">
                  <span className="text-sm font-medium text-red-700 dark:text-red-400">Weaknesses</span>
                  <ul className="mt-2 space-y-1">
                    {aiReviewModal.review.weaknesses.map((weakness: string, index: number) => (
                      <li key={index} className="text-sm text-slate-600 dark:text-slate-400 flex items-start gap-2">
                        <XCircleIcon className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                        <span>{weakness}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Missing Elements */}
              {aiReviewModal.review.missingElements && aiReviewModal.review.missingElements.length > 0 && (
                <div className="mb-4">
                  <span className="text-sm font-medium text-yellow-700 dark:text-yellow-400">Missing Elements</span>
                  <ul className="mt-2 space-y-1">
                    {aiReviewModal.review.missingElements.map((element: string, index: number) => (
                      <li key={index} className="text-sm text-slate-600 dark:text-slate-400 flex items-start gap-2">
                        <ExclamationTriangleIcon className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                        <span>{element}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recommendations */}
              {aiReviewModal.review.recommendations && aiReviewModal.review.recommendations.length > 0 && (
                <div className="mb-4">
                  <span className="text-sm font-medium text-purple-700 dark:text-purple-400">AI Recommendations</span>
                  <ul className="mt-2 space-y-1">
                    {aiReviewModal.review.recommendations.map((rec: string, index: number) => (
                      <li key={index} className="text-sm text-slate-600 dark:text-slate-400 flex items-start gap-2">
                        <SparklesIcon className="h-4 w-4 text-purple-500 mt-0.5 flex-shrink-0" />
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Suggested Next Steps */}
              {aiReviewModal.review.suggestedNextSteps && aiReviewModal.review.suggestedNextSteps.length > 0 && (
                <div className="mb-4">
                  <span className="text-sm font-medium text-blue-700 dark:text-blue-400">Suggested Next Steps</span>
                  <ol className="mt-2 space-y-1 list-decimal list-inside">
                    {aiReviewModal.review.suggestedNextSteps.map((step: string, index: number) => (
                      <li key={index} className="text-sm text-slate-600 dark:text-slate-400">
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Scope Validation */}
              {aiReviewModal.review.scopeValidation && (
                <div className="mb-6 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-800">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-medium text-indigo-700 dark:text-indigo-400">Audit Scope Validation</span>
                    <span className={clsx('badge text-xs', aiReviewModal.review.scopeValidation.withinScope ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400')}>
                      {aiReviewModal.review.scopeValidation.withinScope ? 'Within Scope' : 'Review Required'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                    {aiReviewModal.review.scopeValidation.scopeAlignment}
                  </p>
                  {aiReviewModal.review.scopeValidation.relevantDomains && aiReviewModal.review.scopeValidation.relevantDomains.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      <span className="text-xs text-slate-500 dark:text-slate-400">Relevant Domains:</span>
                      {aiReviewModal.review.scopeValidation.relevantDomains.map((domain: string, index: number) => (
                        <span key={index} className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-800/50 text-indigo-700 dark:text-indigo-300 rounded text-xs">
                          {domain}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Standards Compliance */}
              {aiReviewModal.review.standardsCompliance && aiReviewModal.review.standardsCompliance.length > 0 && (
                <div className="mb-6">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3 block">Standards Compliance Mapping</span>
                  <div className="space-y-3">
                    {aiReviewModal.review.standardsCompliance.map((mapping: any, index: number) => {
                      const standardLabels: Record<string, string> = {
                        ISO_27001: 'ISO 27001',
                        NIST_CSF: 'NIST CSF',
                        SOC2: 'SOC 2',
                        CIS_CONTROLS: 'CIS Controls',
                      };
                      const statusColors: Record<string, string> = {
                        COMPLIANT: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
                        PARTIAL: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
                        NON_COMPLIANT: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
                        NOT_APPLICABLE: 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300',
                      };
                      return (
                        <div key={index} className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded text-xs font-medium">
                                {standardLabels[mapping.standard] || mapping.standard}
                              </span>
                              <span className="text-sm font-mono text-slate-700 dark:text-slate-300">
                                {mapping.controlNumber}
                              </span>
                            </div>
                            <span className={clsx('badge text-xs', statusColors[mapping.complianceStatus])}>
                              {mapping.complianceStatus.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-200 mb-1">
                            {mapping.controlName}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                            <span className="font-medium">Domain:</span> {mapping.domain}
                          </p>
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            {mapping.evidenceAlignment}
                          </p>
                          {mapping.gaps && (
                            <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded">
                              <span className="font-medium">Gap:</span> {mapping.gaps}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Compliance Summary */}
              {aiReviewModal.review.complianceSummary && (
                <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Compliance Summary</span>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    {aiReviewModal.review.complianceSummary}
                  </p>
                </div>
              )}

              {/* Disclaimer */}
              <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  AI Confidence: {Math.round(aiReviewModal.review.aiConfidence * 100)}% • This is an AI-generated assessment and should be reviewed by a qualified auditor.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

