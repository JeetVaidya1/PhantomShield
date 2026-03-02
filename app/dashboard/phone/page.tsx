'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api-client';
import Link from 'next/link';

interface PhoneNumber {
  id: string;
  phone_number: string;
  status: 'active' | 'released';
  created_at: string;
}

interface SMSMessage {
  id: string;
  from: string;
  body: string;
  received_at: string;
  extracted_code: string | null;
}

function extractOTPCode(body: string): string | null {
  const match = body.match(/\b(\d{4,8})\b/);
  return match ? match[1] : null;
}

function ProGate() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-16 h-16 rounded-full bg-[#312E81] flex items-center justify-center mb-4">
        <svg className="w-8 h-8 text-[#818CF8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </div>
      <h2 className="text-xl font-bold text-[#E0E7FF] mb-2">Pro Feature</h2>
      <p className="text-[#A5B4FC] mb-6 max-w-xs">
        Burner phone numbers are available on the Pro plan. Receive SMS and OTPs
        without revealing your real number.
      </p>
      <Link
        href="/dashboard/upgrade"
        className="px-6 py-3 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-bold transition"
      >
        Upgrade to Pro
      </Link>
    </div>
  );
}

export default function PhonePage() {
  const { planTier } = useAuth();
  const [phones, setPhones] = useState<PhoneNumber[]>([]);
  const [messages, setMessages] = useState<SMSMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const [releasing, setReleasing] = useState<string | null>(null);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const fetchPhones = useCallback(async () => {
    try {
      const res = await apiFetch('/api/v2/phones');
      if (res.ok) {
        const data = await res.json();
        setPhones(data.phones || []);
        if (data.phones?.length > 0 && !selectedPhone) {
          setSelectedPhone(data.phones[0].id);
        }
      }
    } catch {}
  }, [selectedPhone]);

  const fetchMessages = useCallback(async (phoneId: string) => {
    try {
      const res = await apiFetch(`/api/v2/phones/${phoneId}/messages`);
      if (res.ok) {
        const data = await res.json();
        const msgs = (data.messages || []).map((m: SMSMessage) => ({
          ...m,
          extracted_code: m.extracted_code || extractOTPCode(m.body),
        }));
        setMessages(msgs);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (planTier !== 'pro') {
      setLoading(false);
      return;
    }
    fetchPhones().finally(() => setLoading(false));
  }, [planTier, fetchPhones]);

  useEffect(() => {
    if (selectedPhone) {
      fetchMessages(selectedPhone);
    }
  }, [selectedPhone, fetchMessages]);

  const handleBuyNumber = async () => {
    setBuying(true);
    try {
      const res = await apiFetch('/api/v2/phones', { method: 'POST' });
      if (res.ok) {
        await fetchPhones();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to buy number');
      }
    } catch {
      alert('Something went wrong');
    } finally {
      setBuying(false);
    }
  };

  const handleReleaseNumber = async (phoneId: string) => {
    if (!confirm('Are you sure you want to release this number? You will stop receiving messages.')) {
      return;
    }
    setReleasing(phoneId);
    try {
      const res = await apiFetch(`/api/v2/phones/${phoneId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setPhones((prev) => prev.filter((p) => p.id !== phoneId));
        if (selectedPhone === phoneId) {
          setSelectedPhone(phones.find((p) => p.id !== phoneId)?.id || null);
        }
      }
    } catch {} finally {
      setReleasing(null);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  if (planTier !== 'pro') {
    return <ProGate />;
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-[#1E1B4B] rounded animate-pulse" />
        <div className="h-24 bg-[#1E1B4B] rounded-xl animate-pulse" />
        <div className="h-24 bg-[#1E1B4B] rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#E0E7FF]">Phone Numbers</h1>
        <span className="text-xs text-[#818CF8]">Receive-only</span>
      </div>

      {/* Phone number list */}
      {phones.length === 0 ? (
        <div className="bg-[#1E1B4B] rounded-2xl p-8 text-center">
          <div className="text-4xl mb-3">📱</div>
          <p className="text-[#A5B4FC] mb-4">
            No burner phone numbers yet. Buy one to start receiving SMS and OTPs.
          </p>
          <button
            onClick={handleBuyNumber}
            disabled={buying}
            className="px-6 py-3 rounded-xl bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white font-bold transition"
          >
            {buying ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Provisioning...
              </span>
            ) : (
              'Buy Phone Number'
            )}
          </button>
        </div>
      ) : (
        <>
          {/* Phone selector tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {phones.map((phone) => (
              <button
                key={phone.id}
                onClick={() => setSelectedPhone(phone.id)}
                className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition ${
                  selectedPhone === phone.id
                    ? 'bg-indigo-500 text-white'
                    : 'bg-[#1E1B4B] text-[#A5B4FC] hover:bg-[#272463]'
                }`}
              >
                {phone.phone_number}
              </button>
            ))}
            {phones.length < 2 && (
              <button
                onClick={handleBuyNumber}
                disabled={buying}
                className="flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium bg-[#1E1B4B] text-[#818CF8] border border-dashed border-[#312E81] hover:border-indigo-500 transition"
              >
                {buying ? '...' : '+ Add Number'}
              </button>
            )}
          </div>

          {/* Selected phone actions */}
          {selectedPhone && (
            <div className="flex items-center justify-between bg-[#1E1B4B] rounded-xl px-4 py-3">
              <div>
                <div className="text-sm text-[#A5B4FC]">Active number</div>
                <div className="text-lg font-mono font-bold text-[#E0E7FF]">
                  {phones.find((p) => p.id === selectedPhone)?.phone_number}
                </div>
              </div>
              <button
                onClick={() => handleReleaseNumber(selectedPhone)}
                disabled={releasing === selectedPhone}
                className="px-4 py-2 rounded-lg bg-[#7F1D1D] hover:bg-red-800 disabled:opacity-50 text-red-300 text-sm font-semibold transition"
              >
                {releasing === selectedPhone ? 'Releasing...' : 'Release'}
              </button>
            </div>
          )}

          {/* SMS feed */}
          <div>
            <h2 className="text-lg font-semibold text-[#E0E7FF] mb-3">
              Incoming Messages
            </h2>
            {messages.length === 0 ? (
              <div className="bg-[#1E1B4B] rounded-xl p-6 text-center">
                <p className="text-[#818CF8]">
                  No messages yet. Give this number to a service to start receiving SMS.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className="bg-[#1E1B4B] rounded-xl p-4 border border-[#312E81]"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-[#A5B4FC]">
                        {msg.from}
                      </span>
                      <span className="text-xs text-[#818CF8]">
                        {new Date(msg.received_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-[#E0E7FF] mb-2">{msg.body}</p>
                    {msg.extracted_code && (
                      <button
                        onClick={() => copyCode(msg.extracted_code!)}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-900/40 hover:bg-emerald-900/60 border border-emerald-700/30 transition"
                      >
                        <span className="font-mono text-lg font-bold text-emerald-400">
                          {msg.extracted_code}
                        </span>
                        <span className="text-xs text-emerald-500">
                          {copiedCode === msg.extracted_code ? 'Copied!' : 'Copy code'}
                        </span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Refresh */}
          <button
            onClick={() => selectedPhone && fetchMessages(selectedPhone)}
            className="w-full py-3 rounded-xl bg-[#1E1B4B] hover:bg-[#272463] text-[#818CF8] text-sm font-medium transition"
          >
            Refresh Messages
          </button>
        </>
      )}

      <p className="text-xs text-[#818CF8] text-center">
        Phone numbers are receive-only. No outbound SMS or calls.
      </p>
    </div>
  );
}
