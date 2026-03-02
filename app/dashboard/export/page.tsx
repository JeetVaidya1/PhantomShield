'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';

type ExportFormat = 'json' | 'csv';

const DATA_CATEGORIES = [
  { id: 'aliases', label: 'Email Aliases', description: 'All alias addresses, statuses, and metadata' },
  { id: 'trackers', label: 'Tracker Stats', description: 'Blocked trackers, cleaned links, daily trends' },
  { id: 'leaks', label: 'Leak Detections', description: 'Suspicious sender alerts and dismissed items' },
  { id: 'gdpr', label: 'GDPR History', description: 'Deletion requests, statuses, and company contacts' },
  { id: 'honeypots', label: 'Honeypots', description: 'Planted aliases and trigger history' },
];

export default function ExportPage() {
  const router = useRouter();
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('json');
  const [loading, setLoading] = useState<ExportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lastExport, setLastExport] = useState<string | null>(null);

  const handleExport = async () => {
    const format = selectedFormat;
    setLoading(format);
    setError(null);
    setSuccess(null);

    try {
      const res = await apiFetch(`/api/v2/export?format=${format}`);

      if (!res.ok) {
        if (res.status === 401) {
          router.push('/');
          return;
        }
        const err = await res.json();
        throw new Error(err.error || 'Export failed');
      }

      const content = await res.text();
      const mimeType = format === 'json' ? 'application/json' : 'text/csv';
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `phantom-defender-export.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const now = new Date().toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
      setLastExport(now);
      setSuccess(`${format.toUpperCase()} export downloaded successfully.`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not generate export. Please try again.'
      );
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#e2e8f0]">Export Data</h1>
          <p className="text-sm text-[#64748b] mt-0.5">Download a portable copy of your data</p>
        </div>
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-[#6366f1]/10 text-[#6366f1] border border-[#6366f1]/20">
          GDPR
        </span>
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-[#ef4444]/5 border border-[#ef4444]/20 rounded-xl p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-[#ef4444] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-[#ef4444]">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-[#ef4444]/50 hover:text-[#ef4444] transition-colors shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      {success && (
        <div className="bg-[#22c55e]/5 border border-[#22c55e]/20 rounded-xl p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-[#22c55e] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-sm text-[#22c55e]">{success}</p>
          </div>
          <button onClick={() => setSuccess(null)} className="text-[#22c55e]/50 hover:text-[#22c55e] transition-colors shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      {/* Format Selector */}
      <div className="bg-[#111827] border border-[#1f2937] rounded-2xl p-6 card-glow">
        <h2 className="text-sm font-semibold text-[#94a3b8] uppercase tracking-wider mb-4">
          Export Format
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <FormatCard
            format="json"
            label="JSON"
            description="Structured data, machine-readable"
            icon={
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
              </svg>
            }
            selected={selectedFormat === 'json'}
            onClick={() => setSelectedFormat('json')}
          />
          <FormatCard
            format="csv"
            label="CSV"
            description="Spreadsheet-compatible, tabular"
            icon={
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M12 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M21.375 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125M12 13.125v-1.5m0 1.5c0 .621.504 1.125 1.125 1.125M12 13.125c0 .621-.504 1.125-1.125 1.125m1.125 0c-.621 0-1.125.504-1.125 1.125" />
              </svg>
            }
            selected={selectedFormat === 'csv'}
            onClick={() => setSelectedFormat('csv')}
          />
        </div>
      </div>

      {/* Data Preview */}
      <div className="bg-[#111827] border border-[#1f2937] rounded-2xl p-6 card-glow">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-[#94a3b8] uppercase tracking-wider">
            Included Data
          </h2>
          <span className="text-xs font-mono tabular-nums text-[#64748b]">~12 KB</span>
        </div>

        <div className="space-y-1">
          {DATA_CATEGORIES.map((cat) => (
            <div
              key={cat.id}
              className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-[#0a0e17] transition-colors"
            >
              <div className="w-5 h-5 rounded border-2 border-[#6366f1] bg-[#6366f1]/10 flex items-center justify-center shrink-0">
                <svg className="w-3 h-3 text-[#6366f1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#e2e8f0]">{cat.label}</p>
                <p className="text-xs text-[#64748b] truncate">{cat.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Download Button */}
      <button
        onClick={handleExport}
        disabled={loading !== null}
        className="w-full flex items-center justify-center gap-3 bg-[#6366f1] hover:bg-[#5558e6] disabled:bg-[#6366f1]/20 disabled:text-[#6366f1]/40 text-white font-semibold py-4 px-6 rounded-xl transition-all disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <span>Generating {loading.toUpperCase()} export...</span>
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>Download as {selectedFormat.toUpperCase()}</span>
          </>
        )}
      </button>

      {/* Last Export / Footer */}
      <div className="flex items-center justify-between px-1">
        <p className="text-xs text-[#64748b]">
          Last export: <span className="font-mono tabular-nums">{lastExport || 'Never'}</span>
        </p>
        <p className="text-xs text-[#64748b]">
          Compliant with GDPR Art. 20
        </p>
      </div>

      {/* Danger Zone */}
      <div className="bg-[#1c1117] border border-[#ef4444]/10 rounded-2xl p-5 card-glow">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[#ef4444]">Danger Zone</h3>
            <p className="text-xs text-[#64748b] mt-0.5">Need to destroy all data immediately?</p>
          </div>
          <button
            onClick={() => router.push('/dashboard/nuke')}
            className="text-xs font-medium text-[#ef4444]/70 hover:text-[#ef4444] border border-[#ef4444]/20 hover:border-[#ef4444]/40 px-3 py-1.5 rounded-lg transition-colors"
          >
            Emergency Nuke
          </button>
        </div>
      </div>
    </div>
  );
}

function FormatCard({
  format,
  label,
  description,
  icon,
  selected,
  onClick,
}: {
  format: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col items-center gap-2 p-5 rounded-xl border-2 transition-all text-center ${
        selected
          ? 'border-[#6366f1] bg-[#6366f1]/5'
          : 'border-[#1f2937] bg-[#0a0e17] hover:border-[#374151]'
      }`}
    >
      {selected && (
        <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-[#6366f1] flex items-center justify-center">
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}
      <div className={selected ? 'text-[#6366f1]' : 'text-[#64748b]'}>
        {icon}
      </div>
      <div>
        <p className={`text-base font-bold ${selected ? 'text-[#e2e8f0]' : 'text-[#94a3b8]'}`}>
          {label}
        </p>
        <p className="text-xs text-[#64748b] mt-0.5">{description}</p>
      </div>
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider ${
        selected
          ? 'bg-[#6366f1]/10 text-[#6366f1]'
          : 'bg-[#1f2937] text-[#64748b]'
      }`}>
        .{format}
      </span>
    </button>
  );
}
