'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

// --- Scroll-based fade-in hook ---
function useFadeIn() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, className: `transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}` };
}

// --- Colors matching the hero image ---
// Primary: cyan/teal neon (#0ea5e9 / #22d3ee)
// Secondary: amber/orange (#f59e0b / #ea580c) matching the sunset
// Backgrounds: deep dark blacks with subtle blue tint

const CYAN = '#22d3ee';
const CYAN_DIM = '#0ea5e9';
const AMBER = '#f59e0b';
const AMBER_DIM = '#ea580c';

// --- Feature tags ---
const FEATURE_TAGS = [
  'Tracker Warfare',
  'Leak Detection',
  'Honeypot Traps',
  'GDPR Automation',
  'Privacy Scores',
  'Emergency Nuke',
];

// --- How it works steps ---
const STEPS = [
  {
    num: '01',
    title: 'Create an Alias',
    desc: 'Generate a disposable email in one click. Give it to any service instead of your real address.',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke={CYAN} strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
      </svg>
    ),
  },
  {
    num: '02',
    title: 'We Monitor Everything',
    desc: 'Every email is scanned for trackers, analyzed for leaks, and classified by AI. You see it all.',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke={CYAN} strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    num: '03',
    title: 'We Fight Back',
    desc: 'One-tap GDPR requests, honeypot evidence, privacy scores. Your data, your rules.',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke={CYAN} strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
  },
];

// --- Feature grid cards ---
const FEATURES = [
  {
    title: 'Tracker Warfare',
    stat: '847',
    statLabel: 'trackers blocked',
    desc: 'Every spy pixel from Mailchimp, HubSpot, and Facebook is stripped before email reaches your inbox. See exactly who\'s spying.',
    color: CYAN,
  },
  {
    title: 'Leak Detection',
    stat: '3',
    statLabel: 'leaks caught',
    desc: 'Instant alerts when companies sell or share your data. Definitive proof, pushed to your phone.',
    color: '#ef4444',
  },
  {
    title: 'Honeypot Traps',
    stat: '12',
    statLabel: 'traps deployed',
    desc: 'Plant decoy aliases at services you don\'t trust. If the alias receives email, you have irrefutable evidence.',
    color: AMBER,
  },
  {
    title: 'GDPR Automation',
    stat: '30d',
    statLabel: 'countdown',
    desc: 'One tap sends a legally valid data deletion request. Track the 30-day deadline. Escalate if they ignore you.',
    color: '#22c55e',
  },
  {
    title: 'Privacy Scores',
    stat: '78',
    statLabel: '/ 100 avg',
    desc: 'Every company gets a crowdsourced privacy score based on real leak data, GDPR response times, and tracker behavior.',
    color: CYAN_DIM,
  },
  {
    title: 'Emergency Nuke',
    stat: '1',
    statLabel: 'button',
    desc: 'Kill every alias, release every phone number, fire GDPR requests to every service, and vanish. 30-day recovery window.',
    color: AMBER_DIM,
  },
];

// --- Pricing data ---
const FREE_FEATURES = [
  { name: '3 email aliases', included: true },
  { name: 'Tracker stripping', included: true },
  { name: 'Leak detection alerts', included: true },
  { name: 'Honeypot aliases', included: true },
  { name: 'GDPR deletion requests', included: true },
  { name: 'Privacy score browsing', included: true },
  { name: 'Emergency nuke', included: true },
  { name: 'Data export (JSON/CSV)', included: true },
  { name: 'Burner phone numbers', included: false },
  { name: 'AI email summaries', included: false },
  { name: 'Privacy autopilot', included: false },
];

const PRO_FEATURES = [
  { name: '15 email aliases', included: true },
  { name: 'Tracker stripping', included: true },
  { name: 'Leak detection alerts', included: true },
  { name: 'Honeypot aliases', included: true },
  { name: 'GDPR deletion requests', included: true },
  { name: 'Privacy score browsing', included: true },
  { name: 'Emergency nuke', included: true },
  { name: 'Data export (JSON/CSV)', included: true },
  { name: '1 burner phone number', included: true },
  { name: 'AI email summaries', included: true },
  { name: 'Privacy autopilot', included: true },
];

// --- Comparison data ---
const COMPETITORS = ['Phantom Defender', 'SimpleLogin', 'Hide My Email', 'Cloaked', 'Firefox Relay'];
const COMP_FEATURES = [
  { name: 'Email aliases', vals: [true, true, true, true, true] },
  { name: 'Phone numbers', vals: [true, false, false, true, false] },
  { name: 'Tracker stripping', vals: [true, false, false, false, false] },
  { name: 'Leak detection', vals: [true, false, false, false, false] },
  { name: 'Honeypot traps', vals: [true, false, false, false, false] },
  { name: 'GDPR automation', vals: [true, false, false, false, false] },
  { name: 'Privacy scores', vals: [true, false, false, false, false] },
  { name: 'Emergency nuke', vals: [true, false, false, false, false] },
  { name: 'AI summaries', vals: [true, false, false, false, false] },
  { name: 'Zero-knowledge encryption', vals: [true, false, false, true, false] },
  { name: 'No email to sign up', vals: [true, false, false, false, false] },
];

// --- Nav items for smooth scroll ---
const NAV_LINKS = [
  { label: 'HOME', href: '#hero' },
  { label: 'SOLUTIONS', href: '#features' },
  { label: 'SERVICES', href: '#how-it-works' },
  { label: 'ABOUT', href: '#pricing' },
  { label: 'CONTACT', href: '#footer' },
];

// --- Persistent tech lines running down both sides of the page ---
function TechLines() {
  return (
    <div className="fixed inset-0 pointer-events-none z-[1] overflow-hidden">
      {/* Left side lines */}
      <svg className="absolute left-4 sm:left-8 lg:left-16 top-0 w-[60px] h-full opacity-[0.45]" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
        {/* Main vertical line */}
        <line x1="20" y1="0" x2="20" y2="100%" stroke={CYAN} strokeWidth="0.5" />
        {/* Secondary vertical line */}
        <line x1="40" y1="0" x2="40" y2="100%" stroke={CYAN} strokeWidth="0.3" strokeDasharray="8 20" />
        {/* Horizontal branches every ~200px */}
        {Array.from({ length: 30 }).map((_, i) => (
          <g key={`l${i}`}>
            <line x1="20" y1={i * 200 + 80} x2="55" y2={i * 200 + 80} stroke={CYAN} strokeWidth="0.5" />
            <circle cx="20" cy={i * 200 + 80} r="2" fill={CYAN} />
            <circle cx="55" cy={i * 200 + 80} r="1.5" fill={CYAN} />
            {i % 2 === 0 && (
              <>
                <line x1="20" y1={i * 200 + 140} x2="10" y2={i * 200 + 140} stroke={CYAN} strokeWidth="0.5" />
                <line x1="10" y1={i * 200 + 140} x2="10" y2={i * 200 + 180} stroke={CYAN} strokeWidth="0.5" />
                <circle cx="10" cy={i * 200 + 180} r="1.5" fill={CYAN} />
              </>
            )}
            {i % 3 === 0 && (
              <>
                <line x1="40" y1={i * 200 + 50} x2="55" y2={i * 200 + 50} stroke={CYAN} strokeWidth="0.3" />
                <rect x="52" y={i * 200 + 47} width="6" height="6" fill="none" stroke={CYAN} strokeWidth="0.5" />
              </>
            )}
          </g>
        ))}
      </svg>

      {/* Right side lines */}
      <svg className="absolute right-4 sm:right-8 lg:right-16 top-0 w-[60px] h-full opacity-[0.45]" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
        {/* Main vertical line */}
        <line x1="40" y1="0" x2="40" y2="100%" stroke={CYAN} strokeWidth="0.5" />
        {/* Secondary vertical line */}
        <line x1="20" y1="0" x2="20" y2="100%" stroke={CYAN} strokeWidth="0.3" strokeDasharray="12 25" />
        {/* Horizontal branches offset from left */}
        {Array.from({ length: 30 }).map((_, i) => (
          <g key={`r${i}`}>
            <line x1="5" y1={i * 200 + 120} x2="40" y2={i * 200 + 120} stroke={CYAN} strokeWidth="0.5" />
            <circle cx="40" cy={i * 200 + 120} r="2" fill={CYAN} />
            <circle cx="5" cy={i * 200 + 120} r="1.5" fill={CYAN} />
            {i % 2 === 1 && (
              <>
                <line x1="40" y1={i * 200 + 60} x2="50" y2={i * 200 + 60} stroke={CYAN} strokeWidth="0.5" />
                <line x1="50" y1={i * 200 + 60} x2="50" y2={i * 200 + 20} stroke={CYAN} strokeWidth="0.5" />
                <circle cx="50" cy={i * 200 + 20} r="1.5" fill={CYAN} />
              </>
            )}
            {i % 3 === 1 && (
              <>
                <line x1="20" y1={i * 200 + 170} x2="5" y2={i * 200 + 170} stroke={CYAN} strokeWidth="0.3" />
                <rect x="1" y={i * 200 + 167} width="6" height="6" fill="none" stroke={CYAN} strokeWidth="0.5" />
              </>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

// ============================================================
// MAIN LANDING PAGE
// ============================================================
export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Fade-in refs
  const howFade = useFadeIn();
  const featureFade = useFadeIn();
  const pricingFade = useFadeIn();
  const compFade = useFadeIn();

  return (
    <div className="min-h-screen bg-[#0a0e17] text-[#e2e8f0] relative">
      <TechLines />
      {/* ========== NAVIGATION ========== */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled ? 'bg-[#0a0e17]/95 backdrop-blur-md border-b border-[#22d3ee]/10' : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="hidden sm:block text-xs font-semibold tracking-[0.15em] text-[#94a3b8] hover:text-[#22d3ee] transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>
          <Link
            href="/auth"
            className="text-xs font-semibold tracking-wider px-4 py-2 rounded border border-[#22d3ee]/30 text-[#22d3ee] hover:bg-[#22d3ee]/10 hover:border-[#22d3ee]/50 transition-all"
          >
            LOG IN
          </Link>
        </div>
      </nav>

      {/* ========== HERO SECTION ========== */}
      <section id="hero" className="relative min-h-screen flex items-end justify-center overflow-hidden">
        {/* Background image */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: 'url(/hero-bg.png)' }}
        />
        {/* Gradient overlay — smooth fade into page bg */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0e17] via-[#0a0e17]/40 to-[#0a0e17]/10" />

        {/* Hero content — lower third */}
        <div className="relative z-10 max-w-4xl mx-auto px-4 pb-16 sm:pb-24 text-center">
          <h1 className="text-5xl sm:text-7xl lg:text-8xl font-extrabold tracking-tight leading-none">
            <span className="bg-gradient-to-b from-[#e2e8f0] via-[#94a3b8] to-[#64748b] bg-clip-text text-transparent drop-shadow-2xl">
              PHANTOM
            </span>
            <br />
            <span className="bg-gradient-to-b from-[#e2e8f0] via-[#94a3b8] to-[#64748b] bg-clip-text text-transparent drop-shadow-2xl">
              DEFENDER
            </span>
          </h1>

          <p className="mt-6 text-sm sm:text-base font-semibold tracking-[0.2em] text-[#22d3ee]/80 uppercase">
            The Only Privacy App That Fights Back
          </p>

          <p className="mt-4 text-sm sm:text-base text-[#94a3b8] max-w-2xl mx-auto leading-relaxed">
            A privacy command center that creates disposable email aliases and burner phone numbers
            — then actively monitors, detects, and responds to privacy violations on your behalf.
          </p>

          {/* Feature tags with cyan glow border */}
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {FEATURE_TAGS.map((tag) => (
              <span
                key={tag}
                className="text-[11px] sm:text-xs font-semibold tracking-wider text-[#22d3ee]/70 border border-[#22d3ee]/20 rounded px-3 py-1.5 bg-[#0a0e17]/60 backdrop-blur-sm hover:border-[#22d3ee]/40 hover:text-[#22d3ee] transition-all"
              >
                {tag}
              </span>
            ))}
          </div>

          {/* CTA with cyan glow */}
          <div className="mt-10">
            <Link
              href="/auth"
              className="inline-block text-sm sm:text-base font-bold tracking-[0.15em] uppercase px-8 py-4 border-2 border-[#22d3ee]/40 text-[#e2e8f0] hover:bg-[#22d3ee]/10 hover:border-[#22d3ee]/70 hover:shadow-[0_0_30px_rgba(34,211,238,0.15)] transition-all duration-300 rounded"
            >
              Secure Your Assets (Zero-Knowledge)
            </Link>
          </div>
        </div>
      </section>

      {/* ========== HOW IT WORKS ========== */}
      <section id="how-it-works" className="relative py-24 sm:py-32 overflow-hidden">
        <div ref={howFade.ref} className={howFade.className}>
          <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-16">
              <p className="text-[10px] font-semibold tracking-[0.3em] text-[#22d3ee] uppercase mb-3">How It Works</p>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-[#e2e8f0]">Three Steps to Total Privacy</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {STEPS.map((step) => (
                <div
                  key={step.num}
                  className="relative bg-[#111827]/80 border border-[#22d3ee]/10 rounded-xl p-8 hover:border-[#22d3ee]/25 hover:shadow-[0_0_30px_rgba(34,211,238,0.05)] transition-all duration-300"
                >
                  <span className="text-5xl font-extrabold font-mono text-[#22d3ee]/[0.06] absolute top-4 right-4">{step.num}</span>
                  <div className="mb-5">{step.icon}</div>
                  <h3 className="text-lg font-bold text-[#e2e8f0] mb-2">{step.title}</h3>
                  <p className="text-sm text-[#94a3b8] leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ========== FEATURE GRID ========== */}
      <section id="features" className="relative py-24 sm:py-32 overflow-hidden">
        {/* Subtle radial glow from center */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(34,211,238,0.04)_0%,_transparent_70%)]" />
        <div ref={featureFade.ref} className={featureFade.className}>
          <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-16">
              <p className="text-[10px] font-semibold tracking-[0.3em] text-[#22d3ee] uppercase mb-3">Features</p>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-[#e2e8f0]">Your Privacy Arsenal</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {FEATURES.map((f) => (
                <div
                  key={f.title}
                  className="bg-[#111827]/80 border border-[#22d3ee]/10 rounded-xl p-6 hover:border-[#22d3ee]/25 hover:shadow-[0_0_30px_rgba(34,211,238,0.05)] transition-all duration-300 group"
                >
                  <div className="flex items-baseline gap-2 mb-3">
                    <span className="text-3xl font-extrabold font-mono tabular-nums" style={{ color: f.color }}>
                      {f.stat}
                    </span>
                    <span className="text-xs text-[#64748b] font-medium">{f.statLabel}</span>
                  </div>
                  <h3 className="text-base font-bold text-[#e2e8f0] mb-2">{f.title}</h3>
                  <p className="text-sm text-[#94a3b8] leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ========== PRICING ========== */}
      <section id="pricing" className="relative py-24 sm:py-32 overflow-hidden">
        <div ref={pricingFade.ref} className={pricingFade.className}>
          <div className="relative max-w-5xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-16">
              <p className="text-[10px] font-semibold tracking-[0.3em] text-[#22d3ee] uppercase mb-3">Pricing</p>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-[#e2e8f0]">Simple, Transparent Pricing</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
              {/* Free Tier */}
              <div className="bg-[#111827]/80 border border-[#1f2937] rounded-xl p-8 hover:border-[#22d3ee]/15 transition-all duration-300">
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-[#e2e8f0]">Free</h3>
                  <div className="flex items-baseline gap-1 mt-2">
                    <span className="text-4xl font-extrabold font-mono text-[#e2e8f0]">$0</span>
                    <span className="text-sm text-[#64748b]">/month</span>
                  </div>
                  <p className="text-sm text-[#94a3b8] mt-2">Get started with core privacy tools.</p>
                </div>
                <ul className="space-y-3">
                  {FREE_FEATURES.map((f) => (
                    <li key={f.name} className="flex items-center gap-3 text-sm">
                      {f.included ? (
                        <svg className="w-4 h-4 text-[#22d3ee] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-[#64748b]/40 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      )}
                      <span className={f.included ? 'text-[#e2e8f0]' : 'text-[#64748b]'}>{f.name}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/auth"
                  className="block text-center mt-8 px-6 py-3 rounded-lg border border-[#22d3ee]/20 text-sm font-semibold text-[#22d3ee] hover:bg-[#22d3ee]/10 hover:border-[#22d3ee]/40 transition-all"
                >
                  Get Started Free
                </Link>
              </div>

              {/* Pro Tier — cyan glow border */}
              <div className="bg-[#111827]/80 border-2 border-[#22d3ee]/30 rounded-xl p-8 relative shadow-[0_0_40px_rgba(34,211,238,0.06)] hover:shadow-[0_0_50px_rgba(34,211,238,0.1)] transition-all duration-300">
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-bold tracking-wider uppercase px-3 py-1 rounded-full bg-[#22d3ee] text-[#0a0e17]">
                  Recommended
                </span>
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-[#e2e8f0]">Pro</h3>
                  <div className="flex items-baseline gap-1 mt-2">
                    <span className="text-4xl font-extrabold font-mono text-[#22d3ee]">$9.99</span>
                    <span className="text-sm text-[#64748b]">/month</span>
                  </div>
                  <p className="text-sm text-[#94a3b8] mt-2">Full privacy command center.</p>
                </div>
                <ul className="space-y-3">
                  {PRO_FEATURES.map((f) => (
                    <li key={f.name} className="flex items-center gap-3 text-sm">
                      <svg className="w-4 h-4 text-[#22d3ee] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      <span className="text-[#e2e8f0]">{f.name}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/auth"
                  className="block text-center mt-8 px-6 py-3 rounded-lg bg-[#22d3ee] hover:bg-[#06b6d4] text-sm font-semibold text-[#0a0e17] transition-colors"
                >
                  Start Pro Trial
                </Link>
              </div>
            </div>

            {/* Add-ons */}
            <div className="mt-8 text-center">
              <p className="text-xs text-[#64748b]">
                <span className="font-semibold text-[#94a3b8]">Add-ons (Pro):</span>{' '}
                Extra phone number <span className="font-mono text-[#22d3ee]">$2.99</span>/mo
                {' '}&middot;{' '}
                Extra 10 aliases <span className="font-mono text-[#22d3ee]">$1.99</span>/mo
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ========== COMPETITIVE COMPARISON ========== */}
      <section className="relative py-24 sm:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(34,211,238,0.03)_0%,_transparent_60%)]" />
        <div ref={compFade.ref} className={compFade.className}>
          <div className="relative max-w-5xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-16">
              <p className="text-[10px] font-semibold tracking-[0.3em] text-[#22d3ee] uppercase mb-3">Comparison</p>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-[#e2e8f0]">What They Do vs What We Do</h2>
              <p className="mt-4 text-sm text-[#94a3b8] max-w-xl mx-auto">
                SimpleLogin, Hide My Email, Cloaked, and Firefox Relay all just forward email. We fight back.
              </p>
            </div>

            <div className="bg-[#111827]/80 border border-[#22d3ee]/10 rounded-xl overflow-hidden hover:border-[#22d3ee]/20 transition-all duration-300">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#22d3ee]/10">
                      <th className="text-left px-4 py-3 text-[10px] font-semibold tracking-wider uppercase text-[#64748b] min-w-[160px]">Feature</th>
                      {COMPETITORS.map((c, i) => (
                        <th key={c} className={`text-center px-3 py-3 text-[10px] font-semibold tracking-wider uppercase min-w-[100px] ${i === 0 ? 'text-[#22d3ee]' : 'text-[#64748b]'}`}>
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {COMP_FEATURES.map((f, ri) => (
                      <tr key={f.name} className={`border-b border-[#1f2937]/50 last:border-0 ${ri % 2 === 1 ? 'bg-[#22d3ee]/[0.02]' : ''}`}>
                        <td className="px-4 py-3 text-sm text-[#e2e8f0] font-medium">{f.name}</td>
                        {f.vals.map((v, ci) => (
                          <td key={ci} className="text-center px-3 py-3">
                            {v ? (
                              <svg className={`w-5 h-5 mx-auto ${ci === 0 ? 'text-[#22d3ee]' : 'text-[#22d3ee]/40'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                              </svg>
                            ) : (
                              <svg className="w-5 h-5 mx-auto text-[#64748b]/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========== FOOTER ========== */}
      <footer id="footer" className="border-t border-[#22d3ee]/10 py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
          {/* Zero-knowledge badge */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-full bg-[#22d3ee]/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-[#22d3ee]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </div>
            <p className="text-sm text-[#94a3b8]">
              Built with zero-knowledge encryption. We couldn&apos;t read your data even if we wanted to.
            </p>
          </div>

          {/* Links */}
          <div className="flex items-center justify-center gap-6 mb-8">
            <a href="#" className="text-xs text-[#64748b] hover:text-[#22d3ee] transition-colors">Privacy Policy</a>
            <span className="text-[#1f2937]">&middot;</span>
            <a href="#" className="text-xs text-[#64748b] hover:text-[#22d3ee] transition-colors">Terms</a>
            <span className="text-[#1f2937]">&middot;</span>
            <a href="https://github.com/JeetVaidya1/PhantomShield" target="_blank" rel="noopener noreferrer" className="text-xs text-[#64748b] hover:text-[#22d3ee] transition-colors">
              GitHub
            </a>
          </div>

          {/* Attribution */}
          <p className="text-xs text-[#64748b]">
            Built by <a href="https://github.com/JeetVaidya1" target="_blank" rel="noopener noreferrer" className="text-[#94a3b8] hover:text-[#22d3ee] transition-colors">Jeet Vaidya</a>
          </p>
        </div>
      </footer>
    </div>
  );
}
