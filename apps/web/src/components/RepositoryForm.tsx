import { Loader2, Search } from "lucide-react";
import { FormEvent, useState } from "react";

import {
  parseGitHubRepositoryUrl,
  type ApiErrorResponse,
  type CreateAnalysisResponse
} from "@repopulse/shared";

interface RepositoryFormProps {
  onAnalysisCreated: (analysis: CreateAnalysisResponse) => void;
}

async function createAnalysis(repositoryUrl: string): Promise<CreateAnalysisResponse> {
  const response = await fetch("/api/analyses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ repositoryUrl })
  });

  const body = (await response.json()) as CreateAnalysisResponse | ApiErrorResponse;

  if (!response.ok) {
    const message =
      "error" in body ? body.error.message : "Unable to create a repository analysis.";
    throw new Error(message);
  }

  if ("error" in body) {
    throw new Error(body.error.message);
  }

  return body;
}

export function RepositoryForm({ onAnalysisCreated }: RepositoryFormProps) {
  const [repositoryUrl, setRepositoryUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    try {
      parseGitHubRepositoryUrl(repositoryUrl);
      setIsSubmitting(true);
      const analysis = await createAnalysis(repositoryUrl);
      onAnalysisCreated(analysis);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to create a repository analysis."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="mt-8 max-w-2xl" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="sr-only" htmlFor="repositoryUrl">
          GitHub repository URL
        </label>
        <input
          className="min-h-12 min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-4 text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
          id="repositoryUrl"
          onChange={(event) => setRepositoryUrl(event.target.value)}
          placeholder="https://github.com/owner/repository"
          type="url"
          value={repositoryUrl}
        />
        <button
          className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-md bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? (
            <Loader2 aria-hidden="true" className="animate-spin" size={18} />
          ) : (
            <Search aria-hidden="true" size={18} />
          )}
          {isSubmitting ? "Analyzing..." : "Analyze repository"}
        </button>
      </div>
      {error ? (
        <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </form>
  );
}
