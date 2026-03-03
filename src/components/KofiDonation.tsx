export default function KofiDonation() {
  const kofiUsername = process.env.NEXT_PUBLIC_KOFI_USERNAME;

  if (!kofiUsername) {
    return null;
  }

  const kofiUrl = `https://ko-fi.com/${kofiUsername}`;

  return (
    <div className="border-t border-zinc-800 pt-4">
      <a
        href={kofiUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-orange-400 transition-colors duration-200 font-medium"
        aria-label="Support isthisvalid on Ko-fi"
      >
        <span aria-hidden="true">☕</span>
        Enjoying this? Support our work
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="transition-transform duration-150 group-hover:translate-x-0.5"
          aria-hidden="true"
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
      </a>
    </div>
  );
}
