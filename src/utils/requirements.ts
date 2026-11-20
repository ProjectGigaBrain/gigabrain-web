import type { Draft, ExpertContribution, RequirementQuality, RequirementSource } from "@/services/api.types";

/** The experts that reviewed a requirement, from its sources. */
export function contributionsOf(sources: RequirementSource[] | undefined): ExpertContribution[] {
  return (sources ?? [])
    .filter((source) => source.kind === "expert")
    .map((source) => ({
      expert_id: source.ref,
      knowledge_version: source.version ?? null,
      action: source.action ?? null,
      edited: source.action === "fix",
    }));
}

/** Share of the format checks a requirement passes (0 to 1). */
export function completeness(quality: RequirementQuality | undefined): number | null {
  if (!quality) return null;
  const checks = [
    quality.ears,
    quality.card_complete ?? quality.story_complete ?? false,
    quality.criteria_gherkin,
    !quality.vague_terms?.length,
  ];
  return checks.filter(Boolean).length / checks.length;
}

/** Saved of the drafts still in play (rejected ones leave the count), and the average format completeness. */
export function draftProgress(drafts: Draft[]) {
  const inPlay = drafts.filter((d) => d.status !== "rejected");
  const saved = inPlay.filter((d) => d.status === "approved").length;
  const scores = inPlay.map((d) => completeness(d.quality)).filter((v): v is number => v !== null);
  return {
    saved,
    total: inPlay.length,
    pending: drafts.filter((d) => d.status === "pending").length,
    percent: inPlay.length ? Math.round((saved / inPlay.length) * 100) : 0,
    structure: scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) : null,
  };
}

/** The words that join a story and a Gherkin criterion, in the language the requirement is written in. */
export const CONNECTORS = {
  en: { asA: "As a", iWant: "I want", soThat: "so that", given: "Given", when: "When", then: "Then" },
  pt: { asA: "Como", iWant: "quero", soThat: "para que", given: "Dado", when: "Quando", then: "Então" },
};

/** "pt" when the statement is in Portuguese ("o sistema deve ..."), "en" otherwise. */
export function contentLanguage(text: string | null | undefined): keyof typeof CONNECTORS {
  return /\b(deve|devem|deverá|sistema|usuário|quando|então)\b/i.test(text ?? "") ? "pt" : "en";
}
