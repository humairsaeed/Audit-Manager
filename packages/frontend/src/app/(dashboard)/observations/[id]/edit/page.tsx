'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { observationsApi, entitiesApi, usersApi } from '@/lib/api';

const observationSchema = z.object({
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
  targetDate: z.string().min(1, 'Target date is required'),
});

type ObservationFormData = z.infer<typeof observationSchema>;

export default function EditObservationPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const observationId = params.id as string;

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ObservationFormData>({
    resolver: zodResolver(observationSchema),
  });

  const toDateInput = (value?: string | Date | null) => {
    if (!value) return '';
    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toISOString().split('T')[0];
  };

  // Fetch observation details
  const { data: observation, isLoading } = useQuery({
    queryKey: ['observation', observationId],
    queryFn: async () => {
      const response = await observationsApi.getById(observationId);
      const data = response.data as any;
      return data?.observation || data;
    },
    enabled: !!observationId && observationId !== 'undefined',
  });

  // Fetch entities
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

  // Update observation mutation
  const updateMutation = useMutation({
    mutationFn: async (data: ObservationFormData) => {
      const targetDate = toDateInput(data.targetDate);
      if (!targetDate) {
        throw new Error('Target date is invalid');
      }
      const payload = {
        ...data,
        targetDate: new Date(targetDate).toISOString(),
        entityId: data.entityId || undefined,
        ownerId: data.ownerId || undefined,
        reviewerId: data.reviewerId || undefined,
      };
      return observationsApi.update(observationId, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['observation', observationId] });
      toast.success('Observation updated successfully');
      router.push(`/observations/${observationId}`);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update observation');
    },
  });

  // Populate form when observation loads
  useEffect(() => {
    if (observation) {
      reset({
        entityId: observation.entityId || '',
        title: observation.title,
        description: observation.description,
        riskRating: observation.riskRating,
        externalReference: observation.externalReference || '',
        recommendation: observation.recommendation || '',
        rootCause: observation.rootCause || '',
        impact: observation.impact || '',
        managementResponse: observation.managementResponse || '',
        correctiveActionPlan: observation.correctiveActionPlan || '',
        ownerId: observation.ownerId || '',
        reviewerId: observation.reviewerId || '',
        targetDate: toDateInput(observation.targetDate),
      });
    }
  }, [observation, reset]);

  const onSubmit = (data: ObservationFormData) => {
    updateMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!observation) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Observation not found</h3>
        <Link href="/observations" className="btn btn-primary mt-4">
          Back to Observations
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href={`/observations/${observationId}`} className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300">
          <ArrowLeftIcon className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Edit Observation</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{observation.globalSequence}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Information */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Basic Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="label">Audit</label>
              <input
                type="text"
                value={observation.audit?.name || ''}
                disabled
                className="input bg-gray-50 dark:bg-gray-700"
              />
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
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Risk & Classification</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Analysis & Recommendations</h2>
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
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Management Response</h2>
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
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Assignment & Timeline</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
          <Link href={`/observations/${observationId}`} className="btn btn-secondary">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="btn btn-primary"
          >
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
