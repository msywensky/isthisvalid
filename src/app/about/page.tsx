import type { Metadata } from "next";
import Link from "next/link";
import PolicyLayout, { PolicySection } from "@/components/PolicyLayout";

export const metadata: Metadata = {
  title: "About",
  description:
    "Learn about IsThisValid.com — a free verification hub with tools to check emails, scan URLs for threats, and detect scam text messages using AI.",
  robots: { index: true, follow: true },
};

const CONTACT_EMAIL = "privacy@isthisvalid.com";

export default function AboutPage() {
  return (
    <PolicyLayout title="About IsThisValid.com" lastUpdated="March 3, 2026">
      <PolicySection title="What is IsThisValid.com?">
        <p>
          IsThisValid.com is a free verification hub. Whether you&apos;ve
          received a suspicious text, want to check a sketchy link before
          clicking it, or need to validate an email address, we have a tool for
          it — no account, no sign-up, no personal data stored.
        </p>
        <p>
          All four tools are accessible directly in your browser; submitted data
          is processed server-side and never permanently stored.
        </p>
      </PolicySection>

      <PolicySection title="Our tools">
        <ol className="list-decimal list-inside space-y-4 pl-2">
          <li>
            <strong className="text-white">Email Validator</strong> — checks
            whether an email address passes RFC 5322 syntax rules, belongs to a
            known disposable-email provider (57,000+ domains), has valid DNS MX
            records, and (optionally) whether the mailbox actually exists.
            Results are scored 0–100.{" "}
            <Link
              href="/check/email"
              className="text-orange-400 hover:underline"
            >
              Try it →
            </Link>
          </li>
          <li>
            <strong className="text-white">URL Safety Checker</strong> — checks
            URLs for phishing signals, suspicious keywords, brand-squatting,
            punycode tricks, IP addresses masquerading as domains, URL
            shorteners, and known malware/phishing lists via the Google Safe
            Browsing API.{" "}
            <Link href="/check/url" className="text-orange-400 hover:underline">
              Try it →
            </Link>
          </li>
          <li>
            <strong className="text-white">Text / SMS Scam Detector</strong> —
            paste any suspicious message and our AI (powered by Anthropic
            Claude) analyses it for scam, smishing, spam, and social-engineering
            patterns. It flags specific phrases and explains its reasoning.{" "}
            <Link
              href="/check/text"
              className="text-orange-400 hover:underline"
            >
              Try it →
            </Link>
          </li>
          <li>
            <strong className="text-white">Phone Number Checker</strong> —
            validates any phone number against ITU-T rules using
            libphonenumber-js, identifies the country, line type (mobile,
            landline, VoIP, toll-free, etc.), and (optionally) enriches results
            with live carrier and line-status data via the AbstractAPI.{" "}
            <Link
              href="/check/phone"
              className="text-orange-400 hover:underline"
            >
              Try it →
            </Link>
          </li>
        </ol>
      </PolicySection>

      <PolicySection title="Why we built it">
        <p>
          Scams are getting harder to spot. Smishing texts impersonate banks and
          couriers convincingly. Phishing URLs differ from the real thing by a
          single character. Disposable email addresses pollute sign-up flows.
          None of these problems require expensive software to catch — they just
          need a quick, reliable check.
        </p>
        <p>
          IsThisValid.com is deliberately simple. No logins, no dashboards, no
          plans to upsell you into a SaaS tier. Just paste, check, done.
        </p>
      </PolicySection>

      <PolicySection title="How each tool works">
        <p>
          <strong className="text-white">Email Validator</strong> — validation
          runs in two layers: local checks (syntax, TLD, disposable domain list,
          MX DNS) happen in milliseconds with no third-party calls. If a
          ZeroBounce or Emailable API key is configured, we also perform an
          SMTP-level handshake to verify mailbox reachability.
        </p>
        <p>
          <strong className="text-white">URL Safety Checker</strong> — nine
          local heuristics run first (no network calls, instant). If the URL
          passes, we make a HEAD request to check reachability, then query the{" "}
          <a
            href="https://safebrowsing.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-orange-400 hover:underline"
          >
            Google Safe Browsing
          </a>{" "}
          API against its threat database.
        </p>
        <p>
          <strong className="text-white">Text / SMS Scam Detector</strong> —
          your message is sent to our server and forwarded to Anthropic&apos;s
          Claude API with a strict system prompt that instructs the model to
          classify the message and extract specific red flags. The output is
          validated against a schema before being returned to you. Results are
          cached for 24 hours (by a one-way hash of the message) to avoid
          redundant AI calls for the same viral scam text.
        </p>
        <p>
          <strong className="text-white">Phone Number Checker</strong> —
          validation runs locally first using libphonenumber-js (no network
          calls). If an AbstractAPI key is configured, we enrich the result with
          live carrier name, line type, ported status, and line-active
          confirmation. Phone numbers are never stored — only their SHA-256 hash
          is cached for up to 30 days as a cache key.
        </p>
      </PolicySection>

      <PolicySection title="Privacy & data">
        <p>
          None of the content you submit — email addresses, URLs, text messages,
          or phone numbers — is permanently stored on our servers. Text messages
          submitted to the scam detector are forwarded to Anthropic for
          analysis; a one-way cryptographic hash may be cached briefly to avoid
          duplicate calls. For full details, see our{" "}
          <Link href="/privacy" className="text-orange-400 hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
      </PolicySection>

      <PolicySection title="How we're funded">
        <p>
          IsThisValid.com is completely free to use — no account, no limits, no
          catch. Running AI analysis and third-party API calls costs real money,
          so if you find the tools useful, a ☕ via{" "}
          <a
            href="https://ko-fi.com/mikesywensky"
            target="_blank"
            rel="noopener noreferrer"
            className="text-orange-400 hover:underline"
          >
            Ko-fi
          </a>{" "}
          goes a long way. We may also display contextual advertisements in the
          future to help cover costs. Advertising never affects our results — we
          have no commercial relationship with any service we check against, and
          no financial incentive to report a result as safe or unsafe.
        </p>
      </PolicySection>

      <PolicySection title="Contact">
        <p>
          Questions, feedback, or bug reports? Reach us at{" "}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="text-orange-400 hover:underline"
          >
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </PolicySection>

      <div className="pt-4">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-xl bg-orange-500 hover:bg-orange-400 px-5 py-3 text-sm font-semibold text-white transition-colors"
        >
          See all tools →
        </Link>
      </div>
    </PolicyLayout>
  );
}
