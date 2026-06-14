import { Github } from "lucide-react";

export function Header() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between md:px-8">
        <div>
          <div className="text-xl font-semibold text-slate-950">RepoPulse</div>
          <p className="text-sm text-slate-600">GitHub repository health analytics</p>
        </div>
        <a
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-100"
          href="https://github.com/Chikachi00/RepoPulse-GitHub"
          rel="noreferrer"
          target="_blank"
        >
          <Github aria-hidden="true" size={18} />
          GitHub repository
        </a>
      </div>
    </header>
  );
}
