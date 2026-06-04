import Link from 'next/link';
import { ReactNode } from 'react';

/**
 * Shared shell for static legal pages (/privacy, /terms). Matches the dark
 * landing-page theme: header with logo + home link, prose content, footer.
 */
export function LegalLayout({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#0a0e17] text-[#e2e8f0] flex flex-col">
      <header className="border-b border-[#1f2937]">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#22d3ee] flex items-center justify-center">
              <svg className="w-4 h-4 text-[#0a0e17]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <span className="text-sm font-bold">Phantom Defender</span>
          </Link>
          <Link href="/" className="text-xs text-[#64748b] hover:text-[#22d3ee] transition-colors">
            ← Back to home
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-3xl mx-auto px-4 py-12 sm:py-16">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm text-[#64748b]">Last updated: {updated}</p>
          <div className="mt-10 space-y-8 text-[#94a3b8] leading-relaxed">{children}</div>
        </div>
      </main>

      <footer className="border-t border-[#1f2937] py-8">
        <div className="max-w-3xl mx-auto px-4 flex items-center justify-between text-xs text-[#64748b]">
          <span>© Phantom Defender</span>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-[#22d3ee] transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-[#22d3ee] transition-colors">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

/** A titled section block used inside legal pages. */
export function LegalSection({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-[#e2e8f0]">{heading}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}
