'use client';

import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { auditsApi, entitiesApi, usersApi } from '@/lib/api';
import { useEffect } from 'react';

const auditSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name too long'),
  type: z.enum(['INTERNAL', 'EXTERNAL', 'ISO', 'SOC', 'ISR', 'FINANCIAL', 'IT', 'REGULATORY', 'CUSTOM']),
  description: z.string().optional(),
  scope: z.string().optional(),
  objectives: z.string().optional(),
  entityId: z.string().min(1, 'Entity is required'),
  periodStart: z.string().min(1, 'Period start date is required'),
  periodEnd: z.string().min(1, 'Period end date is required'),
  plannedStartDate: z.string().optional(),
  plannedEndDate: z.string().optional(),
  leadAuditorId: z.string().optional(),
  externalAuditorName: z.string().optional(),
  externalAuditorFirm: z.string().optional(),
  riskAssessment: z.string().optional(),
  executiveSummary: z.string().optional(),
});

type AuditFormData = z.infer<typeof auditSchema>;

export default function EditAuditPage() {
  const router = useRouter();
  const params = useParams();
  const queryClient = useQueryClient();
  const auditId = params.id as string;

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<AuditFormData>({
    resolver: zodResolver(auditSchema),
  });

  // Fetch audit details
  const { data: audit, isLoading: auditLoading } = useQuery({
    queryKey: ['audit', auditId],
    queryFn: async () => {
      const response = await auditsApi.getById(auditId);
      return response.data?.audit || response.data;
    },
  });

  // Populate form when audit data is loaded
  useEffect(() => {
    if (audit) {
      reset({
        name: audit.name || '',
        type: audit.type || 'INTERNAL',
        description: audit.description || '',
        scope: audit.scope || '',
        objectives: audit.objectives || '',
        entityId: audit.entityId || audit.entity?.id || '',
        periodStart: audit.periodStart ? new Date(audit.periodStart).toISOString().split('T')[0] : '',
        periodEnd: audit.periodEnd ? new Date(audit.periodEnd).toISOString().split('T')[0] : '',
        plannedStartDate: audit.plannedStartDate ? new Date(audit.plannedStartDate).toISOString().split('T')[0] : '',
        plannedEndDate: audit.plannedEndDate ? new Date(audit.plannedEndDate).toISOString().split('T')[0] : '',
        leadAuditorId: audit.leadAuditorId || audit.leadAuditor?.id || '',
        externalAuditorName: audit.externalAuditorName || '',
        externalAuditorFirm: audit.externalAuditorFirm || '',
        riskAssessment: audit.riskAssessment || '',
        executiveSummary: audit.executiveSummary || '',
      });
    }
  }, [audit, reset]);

  // Fetch entities
  const { data: entities } = useQuery({
    queryKey: ['entities'],
    queryFn: async () => {
      const response = await entitiesApi.list(true);
      return response.data?.entities || [];
    },
  });

  // Fetch users for lead auditor selection
  const { data: users } = useQuery({
    queryKey: ['users-select'],
    queryFn: async () => {
      const response = await usersApi.list({ limit: 100, status: 'ACTIVE' });
      return response.data?.data || [];
    },
  });

  // Update audit mutation
  const updateMutation = useMutation({
    mutationFn: async (data: AuditFormData) => {
      const payload = {
        ...data,
        periodStart: new Date(data.periodStart).toISOString(),
        periodEnd: new Date(data.periodEnd).toISOString(),
        plannedStartDate: data.plannedStartDate ? new Date(data.plannedStartDate).toISOString() : undefined,
        plannedEndDate: data.plannedEndDate ? new Date(data.plannedEndDate).toISOString() : undefined,
        leadAuditorId: data.leadAuditorId || undefined,
      };
      return auditsApi.update(auditId, payload);
    },
    onSuccess: () => {
      toast.success('Audit updated successfully');
      queryClient.invalidateQueries({ queryKey: ['audit', auditId] });
      router.push(`/audits/${auditId}`);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update audit');
    },
  });

  const onSubmit = (data: AuditFormData) => {
    updateMutation.mutate(data);
  };

  if (auditLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href={`/audits/${auditId}`} className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300">
          <ArrowLeftIcon className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Edit Audit</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{audit?.name}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Information */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Basic Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="label">Audit Name *</label>
              <input
                type="text"
                {...register('name')}
                className="input"
                placeholder="e.g., ISO 27001 Certification Audit 2024"
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
              )}
            </div>

            <div>
              <label className="label">Audit Type *</label>
              <select {...register('type')} className="input">
                <option value="INTERNAL">Internal</option>
                <option value="EXTERNAL">External</option>
                <option value="ISO">ISO</option>
                <option value="SOC">SOC</option>
                <option value="ISR">ISR</option>
                <option value="FINANCIAL">Financial</option>
                <option value="IT">IT</option>
                <option value="REGULATORY">Regulatory</option>
                <option value="CUSTOM">Custom</option>
              </select>
            </div>

            <div>
              <label className="label">Entity *</label>
              <select {...register('entityId')} className="input">
                <option value="">Select entity</option>
                {entities?.map((entity: any) => (
                  <option key={entity.id} value={entity.id}>
                    {entity.name}
                  </option>
                ))}
              </select>
              {errors.entityId && (
                <p className="mt-1 text-sm text-red-600">{errors.entityId.message}</p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="label">Description</label>
              <textarea
                {...register('description')}
                className="input"
                rows={3}
                placeholder="Brief description of the audit..."
              />
            </div>
          </div>
        </div>

        {/* Scope & Objectives */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Scope & Objectives</h2>
          <div className="space-y-4">
            <div>
              <label className="label">Scope</label>
              <textarea
                {...register('scope')}
                className="input"
                rows={4}
                placeholder="Define the scope of the audit..."
              />
            </div>

            <div>
              <label className="label">Objectives</label>
              <textarea
                {...register('objectives')}
                className="input"
                rows={4}
                placeholder="Define the objectives of the audit..."
              />
            </div>
          </div>
        </div>

        {/* Audit Period */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Audit Period</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Period Start *</label>
              <input
                type="date"
                {...register('periodStart')}
                className="input"
              />
              {errors.periodStart && (
                <p className="mt-1 text-sm text-red-600">{errors.periodStart.message}</p>
              )}
            </div>

            <div>
              <label className="label">Period End *</label>
              <input
                type="date"
                {...register('periodEnd')}
                className="input"
              />
              {errors.periodEnd && (
                <p className="mt-1 text-sm text-red-600">{errors.periodEnd.message}</p>
              )}
            </div>

            <div>
              <label className="label">Planned Start Date</label>
              <input
                type="date"
                {...register('plannedStartDate')}
                className="input"
              />
            </div>

            <div>
              <label className="label">Planned End Date</label>
              <input
                type="date"
                {...register('plannedEndDate')}
                className="input"
              />
            </div>
          </div>
        </div>

        {/* Team Assignment */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Team Assignment</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Lead Auditor</label>
              <select {...register('leadAuditorId')} className="input">
                <option value="">Select lead auditor</option>
                {users?.map((user: any) => (
                  <option key={user.id} value={user.id}>
                    {user.displayName || `${user.firstName} ${user.lastName}`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">External Auditor Name</label>
              <input
                type="text"
                {...register('externalAuditorName')}
                className="input"
                placeholder="External auditor name (if applicable)"
              />
            </div>

            <div>
              <label className="label">External Auditor Firm</label>
              <input
                type="text"
                {...register('externalAuditorFirm')}
                className="input"
                placeholder="External audit firm (if applicable)"
              />
            </div>
          </div>
        </div>

        {/* Reporting */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Reporting</h2>
          <div className="space-y-4">
            <div>
              <label className="label">Risk Assessment</label>
              <textarea
                {...register('riskAssessment')}
                className="input"
                rows={4}
                placeholder="Document the risk assessment..."
              />
            </div>

            <div>
              <label className="label">Executive Summary</label>
              <textarea
                {...register('executiveSummary')}
                className="input"
                rows={4}
                placeholder="Provide an executive summary..."
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Link href={`/audits/${auditId}`} className="btn btn-secondary">
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
