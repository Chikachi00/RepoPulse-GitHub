import type { CreateAnalysisResponse } from "@repopulse/shared";

interface AnalysisResultProps {
  analysis: CreateAnalysisResponse;
}

export function AnalysisResult({ analysis }: AnalysisResultProps) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-emerald-700">Queued analysis</p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-950">
            {analysis.repository.owner}/{analysis.repository.repo}
          </h2>
        </div>
        <span className="w-fit rounded-md bg-slate-100 px-3 py-1 text-sm font-medium capitalize text-slate-700">
          {analysis.status}
        </span>
      </div>

      <dl className="mt-5 grid gap-4 md:grid-cols-3">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Analysis ID
          </dt>
          <dd className="mt-1 break-all font-mono text-sm text-slate-800">{analysis.analysisId}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Progress</dt>
          <dd className="mt-1 text-sm text-slate-800">{analysis.progress}%</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Current step
          </dt>
          <dd className="mt-1 text-sm text-slate-800">{analysis.currentStep}</dd>
        </div>
      </dl>

      <p className="mt-5 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
        Full repository analysis will be available in the next milestone.
      </p>
    </article>
  );
}
