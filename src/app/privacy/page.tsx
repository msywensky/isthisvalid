import type { Metadata } from "next";
import PolicyLayout, { PolicySection } from "@/components/PolicyLayout";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Privacy policy for IsThisValid.com — what data we collect, how we use it, and your rights under GDPR and CCPA.",
  robots: { index: true, follow: true },
};

const LAST_UPDATED = "February 24, 2026";
const CONTACT_EMAIL = "privacy@isthisvalid.com";

export default function PrivacyPage() {
  return (
    <PolicyLayout title="Privacy Policy" lastUpdated={LAST_UPDATED}>
      <PolicySection title="1. Overview">
        <p>
          IsThisValid.com (&ldquo;we&rdquo;, &ldquo;our&rdquo;, or
          &ldquo;us&rdquo;) operates a free suite of verification tools,
          including an email validator, a URL safety checker, and a text / SMS
          scam detector. This Privacy Policy explains what information we
          collect when you use our site, how we use it, and the rights you have
          over your data.
        </p>
        <p>
          We are committed to processing as little personal data as possible. We
          do not require accounts, logins, or registrations to use this service.
        </p>
      </PolicySection>

      <PolicySection title="2. Information We Collect">
        <p>
          <strong className="text-white">Email addresses you submit.</strong>{" "}
          When you enter an email address into the validation tool, that address
          is sent to our server solely to perform the requested validation
          check. We do not store, log, or retain submitted email addresses after
          the check is complete. No email address you enter is ever saved to a
          database.
        </p>
        <p>
          <strong className="text-white">URLs you submit.</strong> When you
          enter a URL into the URL checker, that URL is sent to our server and
          forwarded to the Google Safe Browsing API solely to perform a safety
          check. We do not store submitted URLs after the check is complete.
        </p>
        <p>
          <strong className="text-white">Text messages you submit.</strong> When
          you paste a text or SMS message into the scam detector, that message
          text is sent to our server and forwarded to the Anthropic API (see
          Third-Party Services below) for AI analysis. We do not permanently
          store the raw message text. A cryptographic hash (SHA-256) of a
          normalised version of the message may be cached in Upstash Redis for
          up to 24 hours to avoid redundant API calls for identical inputs; the
          hash is one-way and cannot be used to reconstruct the original
          message.
        </p>
        <p>
          <strong className="text-white">Server logs.</strong> Like all web
          servers, our hosting provider (Vercel) may retain standard HTTP access
          logs (IP address, browser type, referring URL, timestamp) for up to 30
          days for security and debugging purposes. These logs are governed by{" "}
          <a
            href="https://vercel.com/legal/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-orange-400 hover:underline"
          >
            Vercel&apos;s Privacy Policy
          </a>
          .
        </p>
        <p>
          <strong className="text-white">Cookies and local storage.</strong> We
          store a single cookie-consent preference in your browser&apos;s{" "}
          <code className="font-mono text-xs bg-zinc-800 px-1 rounded">
            localStorage
          </code>{" "}
          to remember whether you have accepted our cookie policy. We do not use
          any first-party tracking cookies ourselves.
        </p>
      </PolicySection>

      <PolicySection title="3. Third-Party Services">
        <p>
          <strong className="text-white">Google AdSense.</strong> We display
          advertisements served by Google AdSense. Google may use cookies and
          similar technologies to serve ads based on your prior visits to this
          or other websites. Google&apos;s use of advertising cookies enables it
          and its partners to serve ads based on your visit to our site and/or
          other sites on the Internet.
        </p>
        <p>
          You may opt out of personalised advertising by visiting{" "}
          <a
            href="https://www.google.com/settings/ads"
            target="_blank"
            rel="noopener noreferrer"
            className="text-orange-400 hover:underline"
          >
            Google Ad Settings
          </a>{" "}
          or{" "}
          <a
            href="https://www.aboutads.info/choices/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-orange-400 hover:underline"
          >
            www.aboutads.info
          </a>
          . For more information, see{" "}
          <a
            href="https://policies.google.com/technologies/ads"
            target="_blank"
            rel="noopener noreferrer"
            className="text-orange-400 hover:underline"
          >
            Google&apos;s advertising policies
          </a>
          .
        </p>
        <p>
          <strong className="text-white">Anthropic API (Claude AI).</strong>{" "}
          Text and SMS messages you submit to the scam detector are forwarded to
          the Anthropic API for AI-powered analysis. Anthropic processes this
          data as a subprocessor on our behalf. By default, Anthropic does not
          use API inputs to train its models and does not retain submitted
          content beyond the duration of the API request. For details, see the{" "}
          <a
            href="https://www.anthropic.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-orange-400 hover:underline"
          >
            Anthropic Privacy Policy
          </a>
          .
        </p>
        <p>
          <strong className="text-white">Google Safe Browsing API.</strong> URLs
          you submit to the URL checker are forwarded to the Google Safe
          Browsing API to detect known phishing and malware sites. Google
          processes this data as a subprocessor. See the{" "}
          <a
            href="https://policies.google.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-orange-400 hover:underline"
          >
            Google Privacy Policy
          </a>{" "}
          for details.
        </p>
        <p>
          <strong className="text-white">Upstash Redis.</strong> We use Upstash
          Redis to enforce rate limits and to cache AI analysis results (stored
          as anonymised hashes with a 24-hour TTL). No personally identifiable
          information is written to Upstash. See the{" "}
          <a
            href="https://upstash.com/trust/privacy.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="text-orange-400 hover:underline"
          >
            Upstash Privacy Policy
          </a>
          .
        </p>
        <p>
          <strong className="text-white">Emailable API.</strong> If our
          Emailable integration is enabled, email addresses you submit may be
          forwarded to the Emailable email verification API (
          <a
            href="https://emailable.com/privacy/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-orange-400 hover:underline"
          >
            Emailable Privacy Policy
          </a>
          ) solely to perform deliverability verification. Emailable processes
          this data as a data processor on our behalf. No other data is shared.
        </p>
      </PolicySection>

      <PolicySection title="4. Cookies">
        <p>Our site may set the following cookies or local storage entries:</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-700 text-zinc-400">
                <th className="text-left py-2 pr-4 font-semibold">Name</th>
                <th className="text-left py-2 pr-4 font-semibold">Type</th>
                <th className="text-left py-2 font-semibold">Purpose</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              <tr>
                <td className="py-2 pr-4 font-mono">itv_cookie_consent</td>
                <td className="py-2 pr-4">localStorage</td>
                <td className="py-2">Stores your cookie consent choice</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono">
                  Google (_ga, _gid, etc.)
                </td>
                <td className="py-2 pr-4">Third-party cookies</td>
                <td className="py-2">
                  Ad personalisation, frequency capping (only after consent)
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          You can disable cookies at any time via your browser settings.
          Disabling advertising cookies will not affect the core functionality
          of our validation tool.
        </p>
      </PolicySection>

      <PolicySection title="5. Your Rights (GDPR / CCPA)">
        <p>
          If you are located in the European Economic Area, United Kingdom, or
          California, you have the following rights regarding your personal
          data:
        </p>
        <ul className="list-disc list-inside space-y-1 pl-2">
          <li>
            <strong className="text-white">Access</strong> — you can request a
            copy of any personal data we hold about you.
          </li>
          <li>
            <strong className="text-white">Deletion</strong> — you can request
            deletion of your personal data. Because we do not store email
            addresses, there is typically nothing to delete.
          </li>
          <li>
            <strong className="text-white">Opt-out of sale</strong> — we do not
            sell personal data to third parties.
          </li>
          <li>
            <strong className="text-white">Object to processing</strong> — you
            can withdraw consent for advertising cookies at any time via the
            cookie banner or your browser settings.
          </li>
        </ul>
        <p>
          To exercise any of these rights, contact us at{" "}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="text-orange-400 hover:underline"
          >
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </PolicySection>

      <PolicySection title="6. Children's Privacy">
        <p>
          This service is not directed at children under the age of 13 (or 16 in
          the EEA). We do not knowingly collect personal data from children. If
          you believe a child has submitted personal data to us, please contact
          us immediately at{" "}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="text-orange-400 hover:underline"
          >
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </PolicySection>

      <PolicySection title="7. Data Retention">
        <p>
          We do not permanently store email addresses, URLs, or text messages
          entered into any of our tools. A short-lived cache entry (24-hour TTL)
          derived from a one-way hash of submitted messages may be retained in
          Upstash Redis solely to avoid redundant AI calls; it cannot be used to
          recover the original text. Server access logs retained by Vercel are
          deleted within 30 days. Cookie consent preferences stored in your
          browser persist until you clear your browser storage.
        </p>
      </PolicySection>

      <PolicySection title="8. Changes to This Policy">
        <p>
          We may update this Privacy Policy from time to time. The &ldquo;Last
          updated&rdquo; date at the top of this page will reflect any changes.
          Continued use of the site after changes constitutes acceptance of the
          updated policy.
        </p>
      </PolicySection>

      <PolicySection title="9. Contact">
        <p>
          For privacy-related questions or requests, contact us at:{" "}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="text-orange-400 hover:underline"
          >
            {CONTACT_EMAIL}
          </a>
        </p>
      </PolicySection>
    </PolicyLayout>
  );
}
