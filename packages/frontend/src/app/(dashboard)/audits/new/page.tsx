'use client';

import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { auditsApi, entitiesApi, usersApi } from '@/lib/api';

const auditSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name too long'),
  type: z.enum(['INTERNAL', 'EXTERNAL', 'ISO', 'SOC', 'ISR', 'FINANCIAL', 'IT', 'REGULATORY', 'CUSTOM']),
  description: z.string().optional(),
  scope: z.string().optional(),
  objectives: z.string().optional(),
  framework: z.string().optional(),
  entityId: z.string().optional(),
  year: z.number().min(2000).max(2100),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  leadAuditorId: z.string().optional(),
  teamMemberIds: z.array(z.string()).optional(),
});

type AuditFormData = z.infer<typeof auditSchema>;

export default function NewAuditPage() {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<AuditFormData>({
    resolver: zodResolver(auditSchema),
    defaultValues: {
      type: 'INTERNAL',
      year: new Date().getFullYear(),
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      teamMemberIds: [],
    },
  });

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

  // Create audit mutation
  const createMutation = useMutation({
    mutationFn: async (data: AuditFormData) => {
      const payload = {
        ...data,
        startDate: new Date(data.startDate).toISOString(),
        endDate: new Date(data.endDate).toISOString(),
        entityId: data.entityId || undefined,
        leadAuditorId: data.leadAuditorId || undefined,
        teamMemberIds: data.teamMemberIds?.filter(Boolean) || [],
      };
      return auditsApi.create(payload);
    },
    onSuccess: (response) => {
      toast.success('Audit created successfully');
      router.push(`/audits/${response.data?.audit?.id || response.data?.id}`);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create audit');
    },
  });

  const onSubmit = (data: AuditFormData) => {
    createMutation.mutate(data);
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear + i - 2);

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/audits" className="text-gray-400 hover:text-gray-600">
          <ArrowLeftIcon className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">New Audit</h1>
          <p className="text-sm text-gray-500">Create a new audit engagement</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Information */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h2>
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
              <label className="label">Year *</label>
              <select {...register('year', { valueAsNumber: true })} className="input">
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
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
              <label className="label">Framework</label>
              <input
                type="text"
                {...register('framework')}
                className="input"
                placeholder="e.g., ISO 27001:2022"
              />
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
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Scope & Objectives</h2>
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

        {/* Timeline */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Timeline</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Start Date *</label>
              <input
                type="date"
                {...register('startDate')}
                className="input"
              />
              {errors.startDate && (
                <p className="mt-1 text-sm text-red-600">{errors.startDate.message}</p>
              )}
            </div>

            <div>
              <label className="label">End Date *</label>
              <input
                type="date"
                {...register('endDate')}
                className="input"
              />
              {errors.endDate && (
                <p className="mt-1 text-sm text-red-600">{errors.endDate.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* Team Assignment */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Team Assignment</h2>
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
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Link href="/audits" className="btn btn-secondary">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="btn btn-primary"
          >
            {createMutation.isPending ? 'Creating...' : 'Create Audit'}
          </button>
        </div>
      </form>
    </div>
  );
}
