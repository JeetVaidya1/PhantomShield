'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/api-client';

type ExportFormat = 'json' | 'csv';

export default function ExportPage() {
  const [loading, setLoading] = useState<ExportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleExport = async (format: ExportFormat) => {
    setLoading(format);
    setError(null);
    setSuccess(null);

    try {
      const res = await apiFetch(`/api/v2/export?format=${format}`);

      if (!res.ok) {
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
      <h1 className="text-xl font-bold text-[#E0E7FF]">Settings</h1>

      <div className="bg-[#1E1B4B] rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-[#E0E7FF] mb-2">
          Export My Data
        </h2>
        <p className="text-sm text-[#A5B4FC] leading-relaxed mb-6">
          Download all your data including identities, tracker stats, leak
          detections, and GDPR request history. Your export will contain
          everything stored on your account.
        </p>

        {error && (
          <div className="bg-red-900/30 border border-red-800 rounded-xl p-3 mb-4">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        {success && (
          <div className="bg-emerald-900/30 border border-emerald-800 rounded-xl p-3 mb-4">
            <p className="text-emerald-300 text-sm">{success}</p>
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={() => handleExport('json')}
            disabled={loading !== null}
            className="w-full flex items-center justify-center gap-2 bg-[#312E81] hover:bg-[#3730A3] disabled:opacity-50 disabled:cursor-not-allowed text-[#E0E7FF] font-semibold py-4 px-4 rounded-xl transition-colors"
          >
            {loading === 'json' ? (
              <div className="w-5 h-5 border-2 border-[#E0E7FF] border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                Export as JSON
              </>
            )}
          </button>

          <button
            onClick={() => handleExport('csv')}
            disabled={loading !== null}
            className="w-full flex items-center justify-center gap-2 bg-[#312E81] hover:bg-[#3730A3] disabled:opacity-50 disabled:cursor-not-allowed text-[#E0E7FF] font-semibold py-4 px-4 rounded-xl transition-colors"
          >
            {loading === 'csv' ? (
              <div className="w-5 h-5 border-2 border-[#E0E7FF] border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                Export as CSV
              </>
            )}
          </button>
        </div>
      </div>

      <div className="bg-[#1E1B4B] rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-[#A5B4FC] mb-2">
          What is included?
        </h3>
        <ul className="space-y-1.5 text-sm text-[#818CF8]">
          <li className="flex items-start gap-2">
            <span className="text-indigo-400 mt-0.5">&#8226;</span>
            All email aliases and phone identities
          </li>
          <li className="flex items-start gap-2">
            <span className="text-indigo-400 mt-0.5">&#8226;</span>
            Tracker detection statistics
          </li>
          <li className="flex items-start gap-2">
            <span className="text-indigo-400 mt-0.5">&#8226;</span>
            Data leak detection results
          </li>
          <li className="flex items-start gap-2">
            <span className="text-indigo-400 mt-0.5">&#8226;</span>
            GDPR deletion request history
          </li>
          <li className="flex items-start gap-2">
            <span className="text-indigo-400 mt-0.5">&#8226;</span>
            Honeypot trap triggers
          </li>
        </ul>
      </div>

      {/* Danger Zone */}
      <div className="bg-[#2D0A0A] border border-red-900 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-red-400 mb-2">
          Danger Zone
        </h3>
        <p className="text-sm text-red-300/70 mb-3">
          Need to destroy all your data immediately?
        </p>
        <a
          href="/dashboard/nuke"
          className="inline-block text-sm text-red-400 hover:text-red-300 font-medium underline underline-offset-2 transition-colors"
        >
          Go to Emergency Nuke
        </a>
      </div>
    </div>
  );
}
