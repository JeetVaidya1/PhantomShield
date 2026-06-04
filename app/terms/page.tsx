import { LegalLayout, LegalSection } from '../legal-layout';

export const metadata = {
  title: 'Terms of Service — Phantom Defender',
  description: 'The terms governing your use of Phantom Defender.',
};

export default function TermsPage() {
  return (
    <LegalLayout title="Terms of Service" updated="June 2026">
      <p>
        These terms govern your use of Phantom Defender. By creating an account you agree to them.
        We&apos;ve kept them short and readable.
      </p>

      <LegalSection heading="Your account">
        <p>
          You are responsible for your master password. Because of our zero-knowledge design, we
          cannot reset it or recover your encrypted data if you lose it. Keep it safe.
        </p>
      </LegalSection>

      <LegalSection heading="Acceptable use">
        <p>
          Phantom Defender exists to protect your privacy. Do not use it to send spam, harass others,
          evade lawful obligations, or commit fraud or other illegal activity. Burner numbers are
          receive-only and must not be used to impersonate others. We may suspend accounts that
          abuse the service.
        </p>
      </LegalSection>

      <LegalSection heading="Plans and billing">
        <p>
          The free tier includes a limited number of aliases. Pro is billed monthly via Stripe and
          can be cancelled at any time; access continues until the end of the billing period. Prices
          may change with notice.
        </p>
      </LegalSection>

      <LegalSection heading="Service availability">
        <p>
          We work to keep the service reliable but provide it &quot;as is,&quot; without warranties.
          Email and SMS delivery depend on third-party networks and are not guaranteed. We are not
          liable for indirect or consequential damages to the extent permitted by law.
        </p>
      </LegalSection>

      <LegalSection heading="Termination">
        <p>
          You can delete your account at any time, including via Emergency Nuke (30-day recovery
          window). We may terminate accounts that violate these terms.
        </p>
      </LegalSection>

      <LegalSection heading="Changes">
        <p>
          We may update these terms; material changes will be reflected by the “last updated” date
          above. Continued use after changes constitutes acceptance. This document is provided for
          transparency and is not legal advice.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
