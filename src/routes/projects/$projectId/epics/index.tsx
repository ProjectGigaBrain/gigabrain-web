import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertCircle, Layers, LoaderCircle, RefreshCw, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Typography } from "@/components/ui/typography";
import { StoryOrConstraint } from "@/components/RequirementCard";
import { Tag, TagLegend } from "@/components/TagLegend";
import { SUBTYPE_LABEL } from "@/components/TagLegend/labels";
import { getApiErrorMessage } from "@/services/api";
import { HistoryService } from "@/services/history.service";
import type { Epic, EpicItem, FormatReport } from "@/services/api.types";

export const Route = createFileRoute("/projects/$projectId/epics/")({
  component: EpicsPage,
});

const CHECK_LABEL: Record<keyof FormatReport["rates"], string> = {
  ears: "EARS statement",
  card: "Story (FR) or constraint card (NFR)",
  gherkin: "Given/When/Then criteria",
  not_vague: "No vague terms",
};

function percent(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

function EpicsPage() {
  const { projectId } = Route.useParams();
  const [epics, setEpics] = useState<Epic[]>([]);
  const [report, setReport] = useState<FormatReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOrganizing, setIsOrganizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [loadedEpics, loadedReport] = await Promise.all([
        HistoryService.getEpics(projectId),
        HistoryService.getFormatReport(projectId),
      ]);
      setEpics(loadedEpics);
      setReport(loadedReport);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, "Cannot load the epics."));
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const organize = async () => {
    if (epics.length && !window.confirm("Organize the requirements again? The current epics are replaced.")) return;
    setIsOrganizing(true);
    setError(null);
    try {
      setEpics(await HistoryService.organizeEpics(projectId));
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, "The Twin could not organize the epics. Try again."));
    } finally {
      setIsOrganizing(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex h-dvh min-h-140 w-full flex-col overflow-hidden">
        <header className="flex items-start gap-3 border-b px-4 py-4 sm:px-8">
          <SidebarTrigger className="mt-1 shrink-0" />
          <div className="min-w-0 flex-1">
            <Typography as="h1" className="text-xl font-semibold">
              Epics
            </Typography>
            <Typography as="p" className="mt-1">
              The requirements grouped by theme: each epic with its user stories (functional) and its constraint cards
              (non-functional, the limits the stories must respect).
            </Typography>
          </div>
          <Button variant="outline" className="h-9 px-3" onClick={() => void load()} disabled={isLoading || isOrganizing}>
            <RefreshCw className={isLoading ? "animate-spin" : ""} />
            <span className="hidden sm:inline">Update</span>
          </Button>
          <Button className="h-9 px-3" onClick={() => void organize()} loading={isOrganizing} disabled={isLoading || !report?.requirements}>
            <Sparkles />
            <span className="hidden sm:inline">{epics.length ? "Organize again" : "Organize into epics"}</span>
          </Button>
        </header>

        <section className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
            {error && (
              <Card role="alert" className="flex-row items-start gap-2 text-destructive">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <p className="text-sm">{error}</p>
              </Card>
            )}

            {report && report.requirements > 0 && (
              <Card className="gap-3">
                <Typography as="h2" className="font-semibold">
                  Format of the {report.requirements} requirements ({report.fr} FR, {report.nfr} NFR)
                </Typography>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {(Object.keys(CHECK_LABEL) as Array<keyof FormatReport["rates"]>).map((check) => (
                    <div key={check} className="rounded-xl bg-muted/40 p-3" title={report.failing[check].length ? `Missing: ${report.failing[check].join(", ")}` : "All pass"}>
                      <p className="text-xs text-muted-foreground">{CHECK_LABEL[check]}</p>
                      <p className="text-2xl font-semibold">{percent(report.rates[check])}</p>
                      {report.failing[check].length > 0 && (
                        <p className="truncate text-xs text-muted-foreground">Review: {report.failing[check].join(", ")}</p>
                      )}
                    </div>
                  ))}
                </div>
                {report.nfr_with_story.length > 0 && (
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    Written as a user story but non-functional (should be a constraint card): {report.nfr_with_story.join(", ")}
                  </p>
                )}
              </Card>
            )}

            {isLoading && (
              <div role="status" className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin" /> Loading epics...
              </div>
            )}

            {!isLoading && !epics.length && !error && (
              <Card className="items-center gap-3 py-12 text-center">
                <Layers className="size-8 text-muted-foreground" />
                <Typography as="h2" className="font-semibold">
                  {report?.requirements ? "No epics yet" : "No requirements saved yet"}
                </Typography>
                <Typography as="p">
                  {report?.requirements
                    ? "Ask the Twin to organize the saved requirements into epics."
                    : "Approve requirements in a conversation, then organize them here."}
                </Typography>
              </Card>
            )}

            {epics.map((epic) => (
              <Card key={epic.id} className="gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-semibold">{epic.id}</span>
                    <Typography as="h2" className="text-lg font-semibold">
                      {epic.title}
                    </Typography>
                    <Tag tone="muted">{epic.stories.length} stories</Tag>
                    <Tag tone="muted">{epic.constraints.length} constraint cards</Tag>
                  </div>
                  {epic.description && <Typography as="p" className="text-sm">{epic.description}</Typography>}
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <EpicColumn title="User stories" empty="No functional requirement." items={epic.stories} projectId={projectId} nfr={false} />
                  <EpicColumn title="Constraint cards" empty="No non-functional requirement." items={epic.constraints} projectId={projectId} nfr />
                </div>
              </Card>
            ))}

            {epics.length > 0 && <TagLegend />}
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}

function EpicColumn({
  title,
  empty,
  items,
  projectId,
  nfr,
}: {
  title: string;
  empty: string;
  items: EpicItem[];
  projectId: string;
  nfr: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      {!items.length && <p className="text-sm text-muted-foreground">{empty}</p>}
      {items.map((item) => (
        <div key={item.id} className="flex flex-col gap-2 rounded-xl border p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/projects/$projectId/requirements/$id"
              params={{ projectId, id: item.id }}
              className="font-mono text-xs font-semibold underline-offset-2 hover:underline"
            >
              {item.id}
            </Link>
            {nfr && item.subtype && (
              <Tag tone="muted" title={SUBTYPE_LABEL[item.subtype]}>
                {item.subtype}
              </Tag>
            )}
            {item.status !== "active" && <Tag tone="warning">{item.status.replaceAll("_", " ")}</Tag>}
            <span className="text-sm font-medium">{item.title}</span>
          </div>
          {item.statement && <p className="text-sm text-muted-foreground">{item.statement}</p>}
          <StoryOrConstraint requirement={{ class: nfr ? "NFR" : "FR", story: item.story, constraint: item.constraint }} />
          {item.acceptance_criteria.length > 0 && (
            <p className="text-xs text-muted-foreground">{item.acceptance_criteria.length} acceptance criteria</p>
          )}
        </div>
      ))}
    </div>
  );
}
