import { BrainCircuit, CheckCircle2, CircleAlert, PencilLine } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Typography } from "@/components/ui/typography";
import { ValidationPanel } from "@/components/ValidationPanel";
import { Tag } from "@/components/TagLegend";
import { CLASS_LABEL, EARS_LABEL, EXPERT_LABEL, ORIGIN_LABEL, STATUS_LABEL, SUBTYPE_LABEL } from "@/components/TagLegend/labels";
import { CONNECTORS, contentLanguage, contributionsOf } from "@/utils/requirements";
import type { ExpertContribution, ProposedRequirement, RequirementQuality, RequirementSource } from "@/services/api.types";

export function ExpertTags({ experts }: { experts: ExpertContribution[] }) {
  if (!experts.length) return null;
  return (
    <>
      {experts.map((expert, index) => (
        <Tag
          key={`${expert.expert_id}-${index}`}
          tone={expert.edited ? "warning" : "muted"}
          title={`${expert.edited ? EXPERT_LABEL.edited : EXPERT_LABEL.reviewed}${
            expert.knowledge_version ? ` (knowledge v${expert.knowledge_version})` : ""
          }`}
        >
          {expert.edited ? <PencilLine className="size-3" /> : <BrainCircuit className="size-3" />}
          {expert.edited ? `edited by ${expert.expert_id}` : expert.expert_id}
        </Tag>
      ))}
    </>
  );
}

function QualityItem({ label, valid }: { label: string; valid: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-muted/40 p-2">
      {valid ? <CheckCircle2 className="size-4 text-emerald-600" /> : <CircleAlert className="size-4 text-amber-600" />}
      <span>{label}</span>
      <span className="ml-auto text-xs text-muted-foreground">{valid ? "OK" : "Review"}</span>
    </div>
  );
}

export function QualityChecks({ quality, isNfr }: { quality: RequirementQuality; isNfr: boolean }) {
  return (
    <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
      <QualityItem label={`EARS statement${quality.ears_pattern ? ` · ${quality.ears_pattern}` : ""}`} valid={quality.ears} />
      <QualityItem
        label={isNfr ? "Full constraint card" : "Full user story"}
        valid={Boolean(quality.card_complete ?? quality.story_complete)}
      />
      <QualityItem label={`Given/When/Then (${quality.criteria_count})`} valid={quality.criteria_gherkin} />
      <QualityItem
        label={quality.vague_terms?.length ? `Vague: ${quality.vague_terms.join(", ")}` : "No vague terms"}
        valid={!quality.vague_terms?.length}
      />
    </dl>
  );
}

export function StoryOrConstraint({
  requirement,
}: {
  requirement: Pick<ProposedRequirement, "class" | "story" | "constraint"> & { statement?: string | null };
}) {
  const { story, constraint } = requirement;
  const words = CONNECTORS[contentLanguage(requirement.statement)];
  if (requirement.class === "NFR") {
    if (!constraint || !(constraint.quality || constraint.measure)) return null;
    return (
      <div className="rounded-xl bg-muted/40 p-3 text-sm">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Constraint card</p>
        <p>
          <span className="font-medium">Quality:</span> {constraint.quality}
        </p>
        <p>
          <span className="font-medium">Applies to:</span> {constraint.scope}
        </p>
        <p>
          <span className="font-medium">Measure:</span> {constraint.measure}
        </p>
      </div>
    );
  }
  if (!story || !(story.role?.trim() || story.goal?.trim())) return null;
  return (
    <div className="rounded-xl bg-muted/40 p-3">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">User story</p>
      <p className="text-sm">
        {words.asA} <strong>{story.role}</strong>, {words.iWant} <strong>{story.goal}</strong>, {words.soThat}{" "}
        <strong>{story.benefit}</strong>.
      </p>
    </div>
  );
}

/** A requirement as the PO reads it: tags, statement, story or constraint card, criteria and checks. */
export function RequirementCard({
  requirement,
  id,
  status,
  origin,
  sources,
  actions,
  dimmed = false,
}: {
  requirement: ProposedRequirement;
  id?: string;
  status?: string;
  origin?: string;
  sources?: RequirementSource[];
  actions?: React.ReactNode;
  dimmed?: boolean;
}) {
  const isNfr = requirement.class === "NFR";
  const experts = contributionsOf(sources);
  const words = CONNECTORS[contentLanguage(requirement.statement)];
  // The pattern the sentence really has (the model's own label may be wrong).
  const earsPattern = requirement.quality?.ears_pattern ?? requirement.ears_pattern;
  const statusTone = status === "approved" ? "success" : status === "rejected" ? "danger" : status === "pending" ? "warning" : "neutral";
  return (
    <Card className={`gap-3 rounded-2xl bg-card p-4 ${dimmed ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        {id && <span className="font-mono text-xs font-semibold">{id}</span>}
        {status && (
          <Tag tone={statusTone} title={STATUS_LABEL[status]}>
            {status.replaceAll("_", " ")}
          </Tag>
        )}
        <Tag title={CLASS_LABEL[requirement.class]}>{requirement.class}</Tag>
        {isNfr && requirement.subtype && (
          <Tag tone="muted" title={SUBTYPE_LABEL[requirement.subtype]}>
            {requirement.subtype}
          </Tag>
        )}
        {earsPattern && (
          <Tag tone="muted" title={EARS_LABEL[earsPattern]}>
            EARS · {earsPattern}
          </Tag>
        )}
        {origin && (
          <Tag tone="muted" title={ORIGIN_LABEL[origin]}>
            {origin}
          </Tag>
        )}
        {requirement.topics?.map((topic) => (
          <Tag key={topic} tone="primary" title="Business topic">
            {topic}
          </Tag>
        ))}
        <ExpertTags experts={experts} />
        {requirement.turns?.length ? (
          <span className="text-xs text-muted-foreground" title="Utterances of the meeting it came from">
            from {requirement.turns.join(", ")}
          </span>
        ) : null}
        {actions && <div className="ml-auto flex flex-wrap gap-2">{actions}</div>}
      </div>

      <Typography as="h4" className="text-base font-semibold">
        {requirement.title}
      </Typography>
      <p className="whitespace-pre-wrap text-sm leading-6">{requirement.statement}</p>

      <StoryOrConstraint requirement={requirement} />

      {requirement.acceptance_criteria?.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Acceptance criteria</p>
          {requirement.acceptance_criteria.map((criterion, index) => (
            <div key={`${criterion.scenario}-${index}`} className="rounded-xl border p-3 text-sm">
              {criterion.scenario && <p className="mb-2 font-medium">{criterion.scenario}</p>}
              <p>
                <span className="font-medium">{words.given}</span> {criterion.given}
              </p>
              <p>
                <span className="font-medium">{words.when}</span> {criterion.when}
              </p>
              <p>
                <span className="font-medium">{words.then}</span> {criterion.then}
              </p>
            </div>
          ))}
        </div>
      )}

      <ValidationPanel validation={requirement.validation} requirementClass={requirement.class} />

      {requirement.quality && (
        <details className="rounded-xl border px-3 py-2">
          <summary className="cursor-pointer text-sm font-medium">Format checks</summary>
          <div className="mt-3">
            <QualityChecks quality={requirement.quality} isNfr={isNfr} />
          </div>
        </details>
      )}
    </Card>
  );
}
