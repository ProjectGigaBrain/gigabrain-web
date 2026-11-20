import { CLASS_LABEL, EARS_LABEL, EXPERT_LABEL, ORIGIN_LABEL, STATUS_LABEL, SUBTYPE_LABEL } from "./labels";

export function Tag({
  children,
  title,
  tone = "neutral",
}: {
  children: React.ReactNode;
  title?: string;
  tone?: "neutral" | "primary" | "success" | "warning" | "danger" | "muted";
}) {
  const tones: Record<string, string> = {
    neutral: "border",
    primary: "bg-primary/10",
    success: "border border-emerald-600/40 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400",
    warning: "border border-amber-600/40 bg-amber-600/10 text-amber-700 dark:text-amber-400",
    danger: "border border-destructive/40 bg-destructive/10 text-destructive",
    muted: "bg-muted",
  };
  return (
    <span title={title} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

function Group({ title, items }: { title: string; items: Record<string, string> }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <dl className="grid gap-1 text-sm">
        {Object.entries(items).map(([tag, meaning]) => (
          <div key={tag} className="flex gap-2">
            <dt className="w-24 shrink-0 font-medium">{tag.replaceAll("_", " ")}</dt>
            <dd className="text-muted-foreground">{meaning}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** "What do the tags mean?": a legend the PO can open next to a list of requirements. */
export function TagLegend() {
  return (
    <details className="rounded-2xl border px-4 py-3">
      <summary className="cursor-pointer text-sm font-medium">What do the tags mean?</summary>
      <div className="mt-4 grid gap-5 md:grid-cols-2">
        <Group title="Class" items={CLASS_LABEL} />
        <Group title="Non-functional subtype" items={SUBTYPE_LABEL} />
        <Group title="Status" items={STATUS_LABEL} />
        <Group title="EARS pattern of the statement" items={EARS_LABEL} />
        <Group title="Origin of a draft" items={ORIGIN_LABEL} />
        <Group title="Experts" items={{ "expert": EXPERT_LABEL.reviewed, "edited by": EXPERT_LABEL.edited }} />
      </div>
    </details>
  );
}
