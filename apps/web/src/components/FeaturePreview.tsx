import { Activity, GitPullRequest, RadioTower, ShieldCheck } from "lucide-react";

const features = [
  {
    title: "Pull request efficiency",
    description: "Track review flow, merge time and throughput signals.",
    Icon: GitPullRequest,
    color: "text-emerald-700"
  },
  {
    title: "Issue maintenance",
    description: "Surface stale issues and backlog maintenance patterns.",
    Icon: RadioTower,
    color: "text-amber-700"
  },
  {
    title: "Code hotspots",
    description: "Identify files with repeated change pressure.",
    Icon: Activity,
    color: "text-sky-700"
  },
  {
    title: "CI and test signals",
    description: "Summarize check status and delivery confidence.",
    Icon: ShieldCheck,
    color: "text-indigo-700"
  }
];

export function FeaturePreview() {
  return (
    <div>
      <div className="mb-5 flex items-center justify-between border-b border-slate-200 pb-4">
        <h2 className="text-base font-semibold text-slate-950">Analysis preview</h2>
        <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
          V0.1
        </span>
      </div>
      <div className="grid gap-3">
        {features.map(({ title, description, Icon, color }) => (
          <article className="rounded-md border border-slate-200 p-4" key={title}>
            <div className="flex gap-3">
              <Icon aria-hidden="true" className={color} size={20} />
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
