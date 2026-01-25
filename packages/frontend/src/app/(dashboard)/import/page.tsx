'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  CloudArrowUpIcon,
  DocumentArrowUpIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  TableCellsIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { importApi, auditsApi } from '@/lib/api';
import clsx from 'clsx';

type Step = 'upload' | 'mapping' | 'preview' | 'importing' | 'complete';

interface ColumnMapping {
  sourceColumn: string;
  targetField: string;
  sampleData: string[];
}

interface ImportResult {
  success: boolean;
  imported: number;
  failed: number;
  errors: Array<{ row: number; error: string }>;
}

const TARGET_FIELDS = [
  { value: '', label: 'Skip this column' },
  { value: 'externalReference', label: 'External Reference' },
  { value: 'title', label: 'Title' },
  { value: 'description', label: 'Description' },
  { value: 'riskRating', label: 'Risk Rating' },
  { value: 'recommendation', label: 'Recommendation' },
  { value: 'rootCause', label: 'Root Cause' },
  { value: 'managementResponse', label: 'Management Response' },
  { value: 'actionPlan', label: 'Action Plan' },
  { value: 'ownerEmail', label: 'Owner (Email)' },
  { value: 'targetDate', label: 'Target Date' },
  { value: 'department', label: 'Department' },
  { value: 'category', label: 'Category' },
  { value: 'complianceReference', label: 'Compliance Reference' },
  { value: 'entityName', label: 'Entity Name' },
];

export default function ImportPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('upload');
  const [selectedAuditId, setSelectedAuditId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  // Fetch audits for selection
  const { data: audits } = useQuery({
    queryKey: ['audits-import'],
    queryFn: async () => {
      const response = await auditsApi.list({ limit: 100, status: 'IN_PROGRESS' });
      return response.data?.data || [];
    },
  });

  // Analyze file mutation
  const analyzeMutation = useMutation({
    mutationFn: async (file: File) => {
      return importApi.analyze(file);
    },
    onSuccess: (response) => {
      const { headers, suggestedMappings, sampleData } = response.data;

      // Create column mappings with suggestions
      const mappings: ColumnMapping[] = headers.map((header: string, index: number) => ({
        sourceColumn: header,
        targetField: suggestedMappings[header] || '',
        sampleData: sampleData.map((row: any[]) => row[index]?.toString() || ''),
      }));

      setColumnMappings(mappings);
      setStep('mapping');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to analyze file');
    },
  });

  // Validate and preview mutation
  const previewMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('No file selected');

      const mappings = columnMappings.reduce((acc, m) => {
        if (m.targetField) {
          acc[m.sourceColumn] = m.targetField;
        }
        return acc;
      }, {} as Record<string, string>);

      return importApi.preview(file, selectedAuditId, mappings);
    },
    onSuccess: (response) => {
      setPreviewData(response.data.preview || []);
      setStep('preview');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to preview data');
    },
  });

  // Import mutation
  const importMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('No file selected');

      const mappings = columnMappings.reduce((acc, m) => {
        if (m.targetField) {
          acc[m.sourceColumn] = m.targetField;
        }
        return acc;
      }, {} as Record<string, string>);

      return importApi.execute(file, selectedAuditId, mappings);
    },
    onSuccess: (response) => {
      setImportResult(response.data);
      setStep('complete');
      toast.success(`Successfully imported ${response.data.imported} observations`);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Import failed');
    },
  });

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Validate file type
      const validTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'text/csv',
      ];
      if (!validTypes.includes(selectedFile.type) && !selectedFile.name.endsWith('.xlsx') && !selectedFile.name.endsWith('.csv')) {
        toast.error('Please upload an Excel (.xlsx) or CSV file');
        return;
      }
      setFile(selectedFile);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setFile(droppedFile);
    }
  }, []);

  const handleAnalyze = () => {
    if (!file) {
      toast.error('Please select a file');
      return;
    }
    if (!selectedAuditId) {
      toast.error('Please select an audit');
      return;
    }
    analyzeMutation.mutate(file);
  };

  const handleMappingChange = (index: number, targetField: string) => {
    const newMappings = [...columnMappings];
    newMappings[index].targetField = targetField;
    setColumnMappings(newMappings);
  };

  const handlePreview = () => {
    // Validate required fields are mapped
    const hasTitle = columnMappings.some(m => m.targetField === 'title');
    const hasDescription = columnMappings.some(m => m.targetField === 'description');

    if (!hasTitle || !hasDescription) {
      toast.error('Title and Description fields must be mapped');
      return;
    }

    previewMutation.mutate();
  };

  const handleImport = () => {
    setStep('importing');
    importMutation.mutate();
  };

  const handleReset = () => {
    setStep('upload');
    setFile(null);
    setColumnMappings([]);
    setPreviewData([]);
    setImportResult(null);
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Import Observations</h1>
        <p className="mt-1 text-sm text-gray-500">
          Import observations from Excel or CSV files with intelligent column mapping
        </p>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {['upload', 'mapping', 'preview', 'complete'].map((s, index) => (
            <div key={s} className="flex items-center">
              <div
                className={clsx(
                  'w-10 h-10 rounded-full flex items-center justify-center font-medium',
                  step === s || ['mapping', 'preview', 'complete'].indexOf(step) > ['upload', 'mapping', 'preview', 'complete'].indexOf(s)
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-200 text-gray-500'
                )}
              >
                {index + 1}
              </div>
              <span className="ml-2 text-sm font-medium text-gray-900 hidden sm:block">
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </span>
              {index < 3 && (
                <div className="hidden sm:block w-16 h-0.5 mx-4 bg-gray-200" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <div className="card p-8">
          <div className="mb-6">
            <label className="label">Select Audit *</label>
            <select
              value={selectedAuditId}
              onChange={(e) => setSelectedAuditId(e.target.value)}
              className="input max-w-md"
            >
              <option value="">Choose an audit...</option>
              {audits?.map((audit: any) => (
                <option key={audit.id} value={audit.id}>
                  {audit.name} ({audit.type})
                </option>
              ))}
            </select>
          </div>

          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className={clsx(
              'border-2 border-dashed rounded-lg p-12 text-center transition-colors',
              file ? 'border-primary-300 bg-primary-50' : 'border-gray-300 hover:border-gray-400'
            )}
          >
            {file ? (
              <div>
                <CheckCircleIcon className="mx-auto h-12 w-12 text-primary-600" />
                <p className="mt-4 text-lg font-medium text-gray-900">{file.name}</p>
                <p className="text-sm text-gray-500">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
                <button
                  onClick={() => setFile(null)}
                  className="mt-4 text-sm text-red-600 hover:text-red-700"
                >
                  Remove file
                </button>
              </div>
            ) : (
              <div>
                <CloudArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
                <div className="mt-4">
                  <label className="cursor-pointer">
                    <span className="text-primary-600 hover:text-primary-700 font-medium">
                      Upload a file
                    </span>
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </label>
                  <span className="text-gray-500"> or drag and drop</span>
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Excel (.xlsx) or CSV files up to 10MB
                </p>
              </div>
            )}
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={handleAnalyze}
              disabled={!file || !selectedAuditId || analyzeMutation.isPending}
              className="btn btn-primary"
            >
              {analyzeMutation.isPending ? (
                <>
                  <ArrowPathIcon className="h-5 w-5 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  Analyze File
                  <ArrowRightIcon className="h-5 w-5 ml-2" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Column Mapping */}
      {step === 'mapping' && (
        <div className="card p-6">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Map Columns</h2>
            <p className="text-sm text-gray-500">
              Match your file columns to observation fields. We've suggested mappings based on column names.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Source Column
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Maps To
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Sample Data
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {columnMappings.map((mapping, index) => (
                  <tr key={index}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <TableCellsIcon className="h-5 w-5 text-gray-400" />
                        <span className="font-medium text-gray-900">{mapping.sourceColumn}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={mapping.targetField}
                        onChange={(e) => handleMappingChange(index, e.target.value)}
                        className={clsx(
                          'input text-sm',
                          mapping.targetField ? 'border-primary-300' : ''
                        )}
                      >
                        {TARGET_FIELDS.map((field) => (
                          <option key={field.value} value={field.value}>
                            {field.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      <div className="max-w-xs truncate">
                        {mapping.sampleData.slice(0, 2).join(', ')}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex justify-between">
            <button onClick={() => setStep('upload')} className="btn btn-secondary">
              <ArrowLeftIcon className="h-5 w-5 mr-2" />
              Back
            </button>
            <button
              onClick={handlePreview}
              disabled={previewMutation.isPending}
              className="btn btn-primary"
            >
              {previewMutation.isPending ? (
                <>
                  <ArrowPathIcon className="h-5 w-5 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  Preview Data
                  <ArrowRightIcon className="h-5 w-5 ml-2" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Preview */}
      {step === 'preview' && (
        <div className="card p-6">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Preview Import</h2>
            <p className="text-sm text-gray-500">
              Review the data before importing. Showing first 10 rows.
            </p>
          </div>

          <div className="overflow-x-auto mb-6">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">#</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">Title</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">Risk</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">Target Date</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {previewData.slice(0, 10).map((row, index) => (
                  <tr key={index}>
                    <td className="px-3 py-2 text-gray-500">{index + 1}</td>
                    <td className="px-3 py-2 font-medium text-gray-900 max-w-xs truncate">
                      {row.title}
                    </td>
                    <td className="px-3 py-2">{row.riskRating || 'MEDIUM'}</td>
                    <td className="px-3 py-2">{row.targetDate || 'Auto-calculated'}</td>
                    <td className="px-3 py-2">
                      {row.isValid ? (
                        <span className="text-green-600 flex items-center gap-1">
                          <CheckCircleIcon className="h-4 w-4" />
                          Valid
                        </span>
                      ) : (
                        <span className="text-red-600 flex items-center gap-1">
                          <XCircleIcon className="h-4 w-4" />
                          {row.validationError}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-700">
              <strong>{previewData.length}</strong> total rows found.{' '}
              <strong className="text-green-600">
                {previewData.filter((r) => r.isValid !== false).length}
              </strong>{' '}
              valid,{' '}
              <strong className="text-red-600">
                {previewData.filter((r) => r.isValid === false).length}
              </strong>{' '}
              with errors.
            </p>
          </div>

          <div className="flex justify-between">
            <button onClick={() => setStep('mapping')} className="btn btn-secondary">
              <ArrowLeftIcon className="h-5 w-5 mr-2" />
              Back
            </button>
            <button
              onClick={handleImport}
              disabled={previewData.filter((r) => r.isValid !== false).length === 0}
              className="btn btn-primary"
            >
              <DocumentArrowUpIcon className="h-5 w-5 mr-2" />
              Import {previewData.filter((r) => r.isValid !== false).length} Observations
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Importing */}
      {step === 'importing' && (
        <div className="card p-12 text-center">
          <ArrowPathIcon className="mx-auto h-12 w-12 text-primary-600 animate-spin" />
          <h2 className="mt-4 text-lg font-semibold text-gray-900">Importing Observations</h2>
          <p className="mt-2 text-sm text-gray-500">Please wait while we import your data...</p>
        </div>
      )}

      {/* Step 5: Complete */}
      {step === 'complete' && importResult && (
        <div className="card p-8">
          <div className="text-center mb-8">
            {importResult.failed === 0 ? (
              <CheckCircleIcon className="mx-auto h-16 w-16 text-green-500" />
            ) : (
              <ExclamationTriangleIcon className="mx-auto h-16 w-16 text-yellow-500" />
            )}
            <h2 className="mt-4 text-xl font-semibold text-gray-900">Import Complete</h2>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-green-600">{importResult.imported}</p>
              <p className="text-sm text-green-700">Successfully Imported</p>
            </div>
            <div className="bg-red-50 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-red-600">{importResult.failed}</p>
              <p className="text-sm text-red-700">Failed</p>
            </div>
          </div>

          {importResult.errors && importResult.errors.length > 0 && (
            <div className="mb-8">
              <h3 className="font-medium text-gray-900 mb-3">Errors</h3>
              <div className="bg-red-50 rounded-lg p-4 max-h-48 overflow-y-auto">
                {importResult.errors.map((err, index) => (
                  <p key={index} className="text-sm text-red-700">
                    Row {err.row}: {err.error}
                  </p>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-center gap-4">
            <button onClick={handleReset} className="btn btn-secondary">
              Import More
            </button>
            <button onClick={() => router.push('/observations')} className="btn btn-primary">
              View Observations
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
