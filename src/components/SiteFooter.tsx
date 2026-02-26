import Link from "next/link";

const footerLinks = [
  { label: "About", href: "/about" },
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Service", href: "/terms" },
];

export default function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-zinc-800 pt-6 pb-8 px-4 text-center space-y-3">
      {/* Policy nav — AdSense crawlers scan for these links on every page */}
      <nav aria-label="Footer navigation">
        <ul className="flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs text-zinc-400">
          {footerLinks.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="hover:text-zinc-300 transition-colors"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <p className="text-xs text-zinc-400">
        © {new Date().getFullYear()} IsThisValid.com &mdash; results are
        informational only, not guaranteed.
      </p>
    </footer>
  );
}
