'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api-client';

const FREE_FEATURES = [
  '3 email aliases',
  'Tracker blocking',
  'Leak detection',
  'GDPR request templates',
  'Privacy scores',
  'Data export',
];

const PRO_FEATURES = [
  '15 email aliases',
  '2 burner phone numbers',
  'AI email summaries',
  'Honeypot aliases',
  'Privacy autopilot',
  'Emergency nuke',
  'Priority support',
];

const ADDONS = [
  {
    id: 'extra_phone' as const,
    name: 'Extra Phone Number',
    price: '$2.99/mo',
    description: 'Add another burner phone number for receiving SMS & OTPs',
  },
  {
    id: 'extra_aliases' as const,
    name: 'Extra 10 Email Aliases',
    price: '$1.99/mo',
    description: 'Expand your alias limit by 10 additional aliases',
  },
];

export default function UpgradePage() {
  const { planTier } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);

  const handleCheckout = async () => {
    setLoading('pro');
    try {
      const res = await apiFetch('/api/stripe/checkout', { method: 'POST' });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || 'Failed to create checkout session');
      }
    } catch {
      alert('Something went wrong. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  const handleAddon = async (addonType: 'extra_phone' | 'extra_aliases') => {
    setLoading(addonType);
    try {
      const res = await apiFetch('/api/stripe/addon', {
        method: 'POST',
        body: JSON.stringify({ addon_type: addonType }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || 'Failed to create checkout session');
      }
    } catch {
      alert('Something went wrong. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[#E0E7FF]">Upgrade Your Plan</h1>

      {/* Plan comparison */}
      <div className="grid gap-4">
        {/* Free plan */}
        <div className={`rounded-2xl p-5 border ${
          planTier === 'free'
            ? 'bg-[#1E1B4B] border-indigo-500'
            : 'bg-[#1E1B4B]/50 border-[#312E81]'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-[#E0E7FF]">Free</h2>
            <span className="text-2xl font-bold text-[#A5B4FC]">$0</span>
          </div>
          <ul className="space-y-2">
            {FREE_FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm text-[#A5B4FC]">
                <span className="text-emerald-400">&#10003;</span>
                {f}
              </li>
            ))}
          </ul>
          {planTier === 'free' && (
            <div className="mt-4 text-center text-sm text-[#818CF8] font-medium">
              Current plan
            </div>
          )}
        </div>

        {/* Pro plan */}
        <div className={`rounded-2xl p-5 border relative overflow-hidden ${
          planTier === 'pro'
            ? 'bg-[#1E1B4B] border-indigo-500'
            : 'bg-gradient-to-br from-[#1E1B4B] to-[#312E81] border-indigo-500/50'
        }`}>
          {planTier !== 'pro' && (
            <div className="absolute top-3 right-3 text-xs px-2 py-1 rounded-full bg-indigo-500 text-white font-bold">
              RECOMMENDED
            </div>
          )}
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-[#E0E7FF]">Pro</h2>
            <div className="text-right">
              <span className="text-2xl font-bold text-[#E0E7FF]">$9.99</span>
              <span className="text-sm text-[#818CF8]">/mo</span>
            </div>
          </div>
          <ul className="space-y-2">
            {PRO_FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm text-[#E0E7FF]">
                <span className="text-indigo-400">&#10003;</span>
                {f}
              </li>
            ))}
          </ul>
          {planTier === 'pro' ? (
            <div className="mt-4 text-center text-sm text-indigo-400 font-medium">
              Current plan
            </div>
          ) : (
            <button
              onClick={handleCheckout}
              disabled={loading === 'pro'}
              className="mt-5 w-full py-3 rounded-xl bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white font-bold text-base transition"
            >
              {loading === 'pro' ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Loading...
                </span>
              ) : (
                'Upgrade to Pro'
              )}
            </button>
          )}
        </div>
      </div>

      {/* Add-ons (Pro only) */}
      {planTier === 'pro' && (
        <div>
          <h2 className="text-lg font-bold text-[#E0E7FF] mb-3">Add-ons</h2>
          <div className="space-y-3">
            {ADDONS.map((addon) => (
              <div
                key={addon.id}
                className="bg-[#1E1B4B] rounded-xl p-4 border border-[#312E81]"
              >
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-semibold text-[#E0E7FF]">{addon.name}</h3>
                  <span className="text-sm font-bold text-indigo-400">
                    {addon.price}
                  </span>
                </div>
                <p className="text-sm text-[#A5B4FC] mb-3">{addon.description}</p>
                <button
                  onClick={() => handleAddon(addon.id)}
                  disabled={loading === addon.id}
                  className="w-full py-2.5 rounded-lg bg-[#312E81] hover:bg-[#3730A3] disabled:opacity-50 text-indigo-300 font-semibold text-sm transition"
                >
                  {loading === addon.id ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-3 h-3 border-2 border-indigo-300/30 border-t-indigo-300 rounded-full animate-spin" />
                      Loading...
                    </span>
                  ) : (
                    `Add ${addon.name}`
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FAQ-style note */}
      <div className="bg-[#1E1B4B]/50 rounded-xl p-4 border border-[#312E81]">
        <p className="text-sm text-[#818CF8]">
          Subscriptions are managed through Stripe. You can cancel anytime from
          your Stripe billing portal. Your data is never shared with third parties.
        </p>
      </div>
    </div>
  );
}
