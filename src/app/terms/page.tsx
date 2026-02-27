import type { Metadata } from "next";
import PolicyLayout, { PolicySection } from "@/components/PolicyLayout";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms of service for IsThisValid.com.",
  robots: { index: true, follow: true },
};

const LAST_UPDATED = "February 26, 2026";
const CONTACT_EMAIL = "privacy@isthisvalid.com";

export default function TermsPage() {
  return (
    <PolicyLayout title="Terms of Service" lastUpdated={LAST_UPDATED}>
      <PolicySection title="1. Acceptance of Terms">
        <p>
          By accessing or using IsThisValid.com (the &ldquo;Service&rdquo;), you
          agree to be bound by these Terms of Service (&ldquo;Terms&rdquo;). If
          you do not agree with any part of these Terms, please do not use the
          Service.
        </p>
      </PolicySection>

      <PolicySection title="2. Description of Service">
        <p>
          IsThisValid.com provides a free suite of verification tools, currently
          including:
        </p>
        <ul className="list-disc list-inside space-y-1 pl-2">
          <li>
            <strong className="text-white">Email Validator</strong> — checks
            whether an email address is syntactically valid, belongs to a known
            disposable-email domain, and (optionally) whether the associated
            mailbox is deliverable.
          </li>
          <li>
            <strong className="text-white">URL Safety Checker</strong> — checks
            whether a URL exhibits characteristics of phishing or malicious
            content, using local heuristics and (optionally) the Google Safe
            Browsing API.
          </li>
          <li>
            <strong className="text-white">Text / SMS Scam Detector</strong> —
            uses AI (Anthropic Claude) to analyse text messages submitted by
            users and classify them as potential scam, spam, or legitimate
            content.
          </li>
        </ul>
        <p>
          All tools are provided &ldquo;as is&rdquo; for informational purposes
          only. Results do not constitute legal, financial, or law-enforcement
          advice.
        </p>
      </PolicySection>

      <PolicySection title="3. Acceptable Use">
        <p>You agree not to use the Service to:</p>
        <ul className="list-disc list-inside space-y-1 pl-2">
          <li>
            Validate email addresses for the purpose of sending unsolicited
            messages (spam).
          </li>
          <li>
            Submit URLs, email addresses, or text messages belonging to third
            parties without authorisation, or in a manner that violates those
            individuals&apos; privacy.
          </li>
          <li>
            Deliberately submit content designed to manipulate, exploit, or
            circumvent the AI analysis system (including prompt injection
            attempts).
          </li>
          <li>
            Scrape, crawl, or systematically harvest results via automated tools
            without prior written permission.
          </li>
          <li>
            Attempt to reverse-engineer, disassemble, or otherwise tamper with
            the Service or its underlying systems.
          </li>
          <li>
            Use the Service in any manner that violates applicable local,
            national, or international law.
          </li>
          <li>
            Circumvent any rate limits or access controls implemented by the
            Service.
          </li>
        </ul>
      </PolicySection>

      <PolicySection title="4. Accuracy and Limitations">
        <p>
          All tools on IsThisValid.com are provided for informational purposes
          only. We make no guarantees regarding the accuracy, completeness, or
          reliability of any result. Results should not be used as the sole
          basis for any decision. We expressly disclaim liability for any errors
          or omissions.
        </p>
        <p>
          <strong className="text-white">Email Validator:</strong> A result of
          &ldquo;valid&rdquo; does not guarantee that an email address belongs
          to a real person or that delivery will succeed. A result of
          &ldquo;invalid&rdquo; does not guarantee that the address cannot
          receive email.
        </p>
        <p>
          <strong className="text-white">URL Safety Checker:</strong> A result
          of &ldquo;safe&rdquo; does not guarantee that a URL is free from all
          malicious content; threat databases are not exhaustive and new threats
          emerge continuously. A result of &ldquo;unsafe&rdquo; does not
          guarantee that a URL is malicious.
        </p>
        <p>
          <strong className="text-white">Text / SMS Scam Detector:</strong> AI
          analysis can produce incorrect classifications (false positives and
          false negatives). A result of &ldquo;legit&rdquo; does not confirm
          that a message is safe; a result of &ldquo;scam&rdquo; does not
          confirm criminal activity. Do not use this tool as a substitute for
          professional or law-enforcement advice. Never ignore official warnings
          or fail to report suspected fraud based solely on a result from this
          tool.
        </p>
      </PolicySection>

      <PolicySection title="5. Intellectual Property">
        <p>
          All content, design, source code, and branding associated with
          IsThisValid.com are the property of IsThisValid.com and are protected
          by applicable intellectual property laws. You may not reproduce,
          distribute, or create derivative works without express written
          permission.
        </p>
      </PolicySection>

      <PolicySection title="6. Third-Party Services">
        <p>
          The Service uses the following third-party services to provide certain
          features. We are not responsible for the availability, accuracy, or
          practices of any third-party service, and use of their services is
          subject to their own terms and policies:
        </p>
        <ul className="list-disc list-inside space-y-1 pl-2">
          <li>
            <strong className="text-white">Anthropic</strong> — powers the Text
            / SMS Scam Detector. Text messages you submit are processed by
            Anthropic&apos;s API. See{" "}
            <a
              href="https://www.anthropic.com/legal/consumer-terms"
              target="_blank"
              rel="noopener noreferrer"
              className="text-orange-400 hover:underline"
            >
              Anthropic&apos;s Terms of Service
            </a>
            .
          </li>
          <li>
            <strong className="text-white">Google Safe Browsing</strong> — used
            to check URLs against known threat lists. See{" "}
            <a
              href="https://policies.google.com/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="text-orange-400 hover:underline"
            >
              Google&apos;s Terms of Service
            </a>
            .
          </li>
          <li>
            <strong className="text-white">ZeroBounce</strong> — the preferred
            provider for email SMTP deliverability checks. Email addresses you
            submit may be forwarded to ZeroBounce when the integration is
            enabled. See{" "}
            <a
              href="https://www.zerobounce.net/terms-of-service/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-orange-400 hover:underline"
            >
              ZeroBounce&apos;s Terms of Service
            </a>
            .
          </li>
          <li>
            <strong className="text-white">Emailable</strong> — fallback
            provider for email deliverability checks (used when ZeroBounce is
            not configured). See{" "}
            <a
              href="https://emailable.com/terms-of-service/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-orange-400 hover:underline"
            >
              Emailable&apos;s Terms of Service
            </a>
            .
          </li>
          <li>
            <strong className="text-white">Upstash Redis</strong> — used for
            rate limiting and short-lived result caching.
          </li>
          <li>
            <strong className="text-white">Google AdSense</strong> — used to
            display advertisements.
          </li>
        </ul>
      </PolicySection>

      <PolicySection title="7. Affiliate Links Disclosure">
        <p>
          Some pages on IsThisValid.com display affiliate links to third-party
          products or services. If you click an affiliate link and make a
          purchase, we may earn a commission at no additional cost to you.
          Affiliate links are shown contextually after certain tool results and
          are always labeled as such.
        </p>
        <p>
          Affiliate links are provided for convenience and do not constitute an
          editorial recommendation. We do not share any personal data or
          submitted information with affiliate partners. For questions about
          affiliate links, contact us at{" "}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="text-orange-400 hover:underline"
          >
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </PolicySection>

      <PolicySection title="8. Disclaimer of Warranties">
        <p>
          THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS
          AVAILABLE&rdquo; WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
          INCLUDING BUT NOT LIMITED TO THE IMPLIED WARRANTIES OF
          MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
          NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE
          UNINTERRUPTED, ERROR-FREE, OR FREE OF VIRUSES OR OTHER HARMFUL
          COMPONENTS.
        </p>
      </PolicySection>

      <PolicySection title="9. Limitation of Liability">
        <p>
          TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, ISTHISVALID.COM
          SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL,
          CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS
          OF PROFITS, DATA, OR GOODWILL, ARISING OUT OF OR IN CONNECTION WITH
          YOUR USE OF THE SERVICE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH
          DAMAGES.
        </p>
      </PolicySection>

      <PolicySection title="10. Changes to the Service and Terms">
        <p>
          We reserve the right to modify or discontinue the Service at any time
          without notice. We may update these Terms from time to time; the
          &ldquo;Last updated&rdquo; date at the top will reflect any changes.
          Continued use of the Service after changes constitutes acceptance of
          the updated Terms.
        </p>
      </PolicySection>

      <PolicySection title="11. Governing Law">
        <p>
          These Terms shall be governed by and construed in accordance with the
          laws of the United States, without regard to conflict-of-law
          principles. Any disputes shall be resolved in the appropriate courts
          of the United States.
        </p>
      </PolicySection>

      <PolicySection title="12. Contact">
        <p>
          Questions about these Terms? Contact us at{" "}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="text-orange-400 hover:underline"
          >
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </PolicySection>
    </PolicyLayout>
  );
}
