import { LegalLayout, LegalSection } from '../legal-layout';

export const metadata = {
  title: 'Privacy Policy — Phantom Defender',
  description: 'How Phantom Defender handles your data under its zero-knowledge architecture.',
};

export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy" updated="June 2026">
      <p>
        Phantom Defender is a privacy tool, so our own privacy practices matter. This policy
        explains what we collect, what we deliberately cannot see, and how our zero-knowledge
        architecture works. Plain language, no dark patterns.
      </p>

      <LegalSection heading="What we cannot see">
        <p>
          Your data is encrypted on your device with your master password before it ever reaches
          our servers (AES-256-GCM; keys derived with PBKDF2). We store only encrypted blobs. We
          never receive your master password, and we cannot read your forwarding address, email
          contents, or notes — even if compelled. If you lose your master password, your encrypted
          data cannot be recovered, by us or anyone.
        </p>
      </LegalSection>

      <LegalSection heading="What we collect">
        <p>
          <strong className="text-[#e2e8f0]">Account:</strong> a username and a salted hash of your
          password. No email is required to sign up.
        </p>
        <p>
          <strong className="text-[#e2e8f0]">Operational metadata:</strong> the aliases and phone
          numbers you create, tracker/leak counts, and audit events needed to run the service. This
          is scoped to your account and protected by row-level security.
        </p>
        <p>
          <strong className="text-[#e2e8f0]">Billing:</strong> if you subscribe, payments are
          processed by Stripe. We never store your card details.
        </p>
      </LegalSection>

      <LegalSection heading="Email and phone handling">
        <p>
          Aliases forward mail to your real inbox with trackers stripped. We process the minimum
          metadata needed to detect leaks and strip trackers. Burner phone numbers are
          receive-only (for OTPs and inbound SMS); we never send messages on your behalf.
        </p>
      </LegalSection>

      <LegalSection heading="Third parties">
        <p>
          We rely on infrastructure providers (hosting, database, email forwarding, SMS, and
          payments) strictly to deliver the service. We do not sell your data, and we do not run
          advertising or third-party trackers in the app.
        </p>
      </LegalSection>

      <LegalSection heading="Your controls">
        <p>
          You can export all of your data (JSON or CSV) at any time, and the Emergency Nuke feature
          deletes your identities and soft-deletes your account with a 30-day recovery window.
        </p>
      </LegalSection>

      <LegalSection heading="Contact">
        <p>
          Questions about this policy? Reach out via the project repository on GitHub. This document
          is provided for transparency and is not legal advice.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
