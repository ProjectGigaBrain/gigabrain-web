import { useMemo, useState } from "react";
import { Check, CheckCheck, RotateCcw, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Typography } from "@/components/ui/typography";
import { RequirementCard } from "@/components/RequirementCard";
import { draftProgress } from "@/utils/requirements";
import type { Draft, DraftStatus } from "@/services/api.types";

type Filter = "pending" | "all" | DraftStatus;

export function DraftProgress({ drafts }: { drafts: Draft[] }) {
  const p = draftProgress(drafts);
  if (!drafts.length) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">
          {p.saved} of {p.total} requirements saved · {p.percent}%
        </span>
        {p.structure !== null && (
          <span className="text-xs text-muted-foreground" title="Average share of the format checks the drafts pass">
            Format: {p.structure}%
          </span>
        )}
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={p.percent}
        aria-label="Requirements saved"
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
      >
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${p.percent}%` }} />
      </div>
    </div>
  );
}

/** The working list of a conversation: approve, reject or restore each draft, or approve all. */
export function DraftBoard({
  drafts,
  busyDraft,
  disabled,
  onApprove,
  onReject,
  onRestore,
  onApproveAll,
}: {
  drafts: Draft[];
  busyDraft: string | null;
  disabled: boolean;
  onApprove: (draftId: string) => void;
  onReject: (draftId: string) => void;
  onRestore: (draftId: string) => void;
  onApproveAll: () => void;
}) {
  const [filter, setFilter] = useState<Filter>("pending");
  const counts = useMemo(
    () => ({
      pending: drafts.filter((d) => d.status === "pending").length,
      approved: drafts.filter((d) => d.status === "approved").length,
      rejected: drafts.filter((d) => d.status === "rejected").length,
    }),
    [drafts],
  );
  const shown = filter === "all" ? drafts : drafts.filter((d) => d.status === filter);

  if (!drafts.length) {
    return (
      <div className="rounded-2xl border border-dashed p-5 text-center text-sm text-muted-foreground">
        No drafts yet. Talk to the Twin or send a meeting: its requirements show up here for you to review.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <DraftProgress drafts={drafts} />
      <div className="flex flex-wrap items-center gap-2">
        {(["pending", "approved", "rejected", "all"] as Filter[]).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={`rounded-full border px-3 py-1 text-xs capitalize ${filter === value ? "border-primary bg-primary/10 font-semibold" : "text-muted-foreground"}`}
          >
            {value}
            {value !== "all" ? ` (${counts[value as DraftStatus]})` : ` (${drafts.length})`}
          </button>
        ))}
        {counts.pending > 0 && (
          <Button className="ml-auto h-8 px-3" disabled={disabled} onClick={onApproveAll}>
            <CheckCheck />
            Approve {counts.pending === 1 ? "the pending draft" : `all ${counts.pending} pending`}
          </Button>
        )}
      </div>

      {shown.length === 0 && (
        <Typography as="p" className="py-4 text-center text-sm text-muted-foreground">
          No {filter} drafts.
        </Typography>
      )}

      {shown.map((draft) => (
        <RequirementCard
          key={draft.draft_id}
          requirement={draft}
          id={draft.saved_as ? `${draft.draft_id} → ${draft.saved_as}` : draft.draft_id}
          status={draft.status}
          origin={draft.origin}
          sources={draft.sources}
          dimmed={draft.status === "rejected"}
          actions={
            draft.status === "pending" ? (
              <>
                <Button
                  className="h-8 px-3"
                  disabled={disabled}
                  loading={busyDraft === draft.draft_id}
                  onClick={() => onApprove(draft.draft_id)}
                  title="Save this draft in the Repository"
                >
                  <Check /> Approve
                </Button>
                <Button
                  variant="outline"
                  className="h-8 px-3"
                  disabled={disabled}
                  onClick={() => onReject(draft.draft_id)}
                  title="Do not save this draft (it can be restored)"
                >
                  <X /> Reject
                </Button>
              </>
            ) : draft.status === "rejected" ? (
              <Button
                variant="outline"
                className="h-8 px-3"
                disabled={disabled}
                loading={busyDraft === draft.draft_id}
                onClick={() => onRestore(draft.draft_id)}
              >
                <RotateCcw /> Restore
              </Button>
            ) : null
          }
        />
      ))}
    </div>
  );
}
