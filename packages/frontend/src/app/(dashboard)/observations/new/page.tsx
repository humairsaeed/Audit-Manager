'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { observationsApi, auditsApi, entitiesApi, usersApi } from '@/lib/api';

const observationSchema = z.object({
  auditId: z.string().min(1, 'Audit is required'),
  entityId: z.string().optional(),
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  description: z.string().min(1, 'Description is required'),
  riskRating: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFORMATIONAL']),
  externalReference: z.string().optional(),
  impact: z.string().optional(),
  recommendation: z.string().optional(),
  rootCause: z.string().optional(),
  managementResponse: z.string().optional(),
  correctiveActionPlan: z.string().optional(),
  ownerId: z.string().optional(),
  reviewerId: z.string().optional(),
  openDate: z.string().min(1, 'Open date is required'),
  targetDate: z.string().min(1, 'Target date is required'),
});

type ObservationFormData = z.infer<typeof observationSchema>;

export default function NewObservationPage() {
  const router = useRouter();
  const [selectedAuditId, setSelectedAuditId] = useState('');

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    watch,
    setValue,
  } = useForm<ObservationFormData>({
    resolver: zodResolver(observationSchema),
    defaultValues: {
      riskRating: 'MEDIUM',
      openDate: new Date().toISOString().split('T')[0],
      targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    },
  });

  const watchAuditId = watch('auditId');

  // Fetch audits (include PLANNED and IN_PROGRESS audits for observation creation)
  const { data: audits } = useQuery({
    queryKey: ['audits-select'],
    queryFn: async () => {
      const response = await auditsApi.list({ limit: 100 });
      // Filter out CLOSED and CANCELLED audits on the client side
      const allAudits = response.data?.data || [];
      return allAudits.filter((audit: any) =>
        audit.status !== 'CLOSED' && audit.status !== 'CANCELLED'
      );
    },
  });

  // Fetch entities based on selected audit
  const { data: entities } = useQuery({
    queryKey: ['entities'],
    queryFn: async () => {
      const response = await entitiesApi.list(true);
      return response.data?.entities || [];
    },
  });

  // Fetch users for owner/reviewer selection
  const { data: users } = useQuery({
    queryKey: ['users-select'],
    queryFn: async () => {
      const response = await usersApi.list({ limit: 100, status: 'ACTIVE' });
      return response.data?.data || [];
    },
  });

  // Create observation mutation
  const createMutation = useMutation({
    mutationFn: async (data: ObservationFormData) => {
      const payload = {
        ...data,
        openDate: new Date(data.openDate).toISOString(),
        targetDate: new Date(data.targetDate).toISOString(),
        entityId: data.entityId || undefined,
        ownerId: data.ownerId || undefined,
        reviewerId: data.reviewerId || undefined,
        correctiveActionPlan: data.correctiveActionPlan || undefined,
      };
      return observationsApi.create(payload);
    },
    onSuccess: (response: any) => {
      toast.success('Observation created successfully');
      const observationId = response.data?.observation?.id || response.data?.id;
      router.push(`/observations/${observationId}`);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create observation');
    },
  });

  const onSubmit = (data: ObservationFormData) => {
    createMutation.mutate(data);
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/observations" className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300">
          <ArrowLeftIcon className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">New Observation</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Create a new audit observation</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Information */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Basic Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="label">Audit *</label>
              <select {...register('auditId')} className="input">
                <option value="">Select an audit</option>
                {audits?.map((audit: any) => (
                  <option key={audit.id} value={audit.id}>
                    {audit.name} ({audit.type})
                  </option>
                ))}
              </select>
              {errors.auditId && (
                <p className="mt-1 text-sm text-red-600">{errors.auditId.message}</p>
              )}
            </div>

            <div>
              <label className="label">Entity</label>
              <select {...register('entityId')} className="input">
                <option value="">Select entity (optional)</option>
                {entities?.map((entity: any) => (
                  <option key={entity.id} value={entity.id}>
                    {entity.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">External Reference</label>
              <input
                type="text"
                {...register('externalReference')}
                className="input"
                placeholder="e.g., NC-2024-001"
              />
            </div>

            <div className="md:col-span-2">
              <label className="label">Title *</label>
              <input
                type="text"
                {...register('title')}
                className="input"
                placeholder="Brief title describing the observation"
              />
              {errors.title && (
                <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="label">Description *</label>
              <textarea
                {...register('description')}
                className="input"
                rows={4}
                placeholder="Detailed description of the observation..."
              />
              {errors.description && (
                <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* Risk & Classification */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Risk & Classification</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Risk Rating *</label>
              <select {...register('riskRating')} className="input">
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
                <option value="INFORMATIONAL">Informational</option>
              </select>
            </div>
          </div>
        </div>

        {/* Root Cause & Recommendation */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Analysis & Recommendations</h2>
          <div className="space-y-4">
            <div>
              <label className="label">Risk</label>
              <textarea
                {...register('impact')}
                className="input"
                rows={3}
                placeholder="Describe the risk associated with the observation..."
              />
            </div>

            <div>
              <label className="label">Root Cause</label>
              <textarea
                {...register('rootCause')}
                className="input"
                rows={3}
                placeholder="Underlying cause of the observation..."
              />
            </div>

            <div>
              <label className="label">Recommendation</label>
              <textarea
                {...register('recommendation')}
                className="input"
                rows={3}
                placeholder="Recommended actions to address the observation..."
              />
            </div>
          </div>
        </div>

        {/* Management Response */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Management Response</h2>
          <div className="space-y-4">
            <div>
              <label className="label">Management Response</label>
              <textarea
                {...register('managementResponse')}
                className="input"
                rows={3}
                placeholder="Management's response to the observation..."
              />
            </div>

            <div>
              <label className="label">Corrective Action Plan</label>
              <textarea
                {...register('correctiveActionPlan')}
                className="input"
                rows={3}
                placeholder="Planned actions to remediate the observation..."
              />
            </div>
          </div>
        </div>

        {/* Assignment */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Assignment & Timeline</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Owner</label>
              <select {...register('ownerId')} className="input">
                <option value="">Select owner</option>
                {users?.map((user: any) => (
                  <option key={user.id} value={user.id}>
                    {user.displayName || `${user.firstName} ${user.lastName}`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Reviewer</label>
              <select {...register('reviewerId')} className="input">
                <option value="">Select reviewer</option>
                {users?.map((user: any) => (
                  <option key={user.id} value={user.id}>
                    {user.displayName || `${user.firstName} ${user.lastName}`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Open Date *</label>
              <input
                type="date"
                {...register('openDate')}
                className="input"
              />
              {errors.openDate && (
                <p className="mt-1 text-sm text-red-600">{errors.openDate.message}</p>
              )}
            </div>

            <div>
              <label className="label">Target Date *</label>
              <input
                type="date"
                {...register('targetDate')}
                className="input"
              />
              {errors.targetDate && (
                <p className="mt-1 text-sm text-red-600">{errors.targetDate.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Link href="/observations" className="btn btn-secondary">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="btn btn-primary"
          >
            {createMutation.isPending ? 'Creating...' : 'Create Observation'}
          </button>
        </div>
      </form>
    </div>
  );
}

