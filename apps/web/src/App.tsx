import { useState } from "react";

import type { CreateAnalysisResponse } from "@repopulse/shared";

import { AnalysisResult } from "./components/AnalysisResult.js";
import { FeaturePreview } from "./components/FeaturePreview.js";
import { Header } from "./components/Header.js";
import { RepositoryForm } from "./components/RepositoryForm.js";

export function App() {
  const [analysis, setAnalysis] = useState<CreateAnalysisResponse | null>(null);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <Header />

      <section className="mx-auto grid w-full max-w-6xl gap-8 px-5 py-10 md:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)] md:px-8 md:py-14">
        <div className="flex min-w-0 flex-col justify-center">
          <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-emerald-700">
            Repository intelligence
          </p>
          <h1 className="max-w-3xl text-4xl font-semibold leading-tight text-slate-950 md:text-6xl">
            Understand the health of any GitHub repository
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-650 md:text-lg">
            Analyze pull requests, issues, commits, releases, contributors and CI signals in one
            engineering health report.
          </p>

          <RepositoryForm onAnalysisCreated={setAnalysis} />
        </div>

        <aside className="min-w-0 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <FeaturePreview />
        </aside>
      </section>

      {analysis ? (
        <section className="mx-auto w-full max-w-6xl px-5 pb-12 md:px-8">
          <AnalysisResult analysis={analysis} />
        </section>
      ) : null}
    </main>
  );
}
