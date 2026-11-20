/** What each tag on a requirement means. The same words are the tooltips of the tags. */

export const CLASS_LABEL: Record<string, string> = {
  FR: "Functional: what the system does (a function, an input, an output, a business rule). Told as a user story.",
  NFR: "Non-functional: how well the system does it (performance, security, usability...). Written as a constraint card, never as a user story.",
};

export const SUBTYPE_LABEL: Record<string, string> = {
  PE: "Performance: response time, throughput, resource use",
  SE: "Security: authentication, authorization, encryption, privacy",
  US: "Usability: ease of learning and use, help, messages",
  LF: "Look and feel: colors, fonts, layout, visual style",
  A: "Availability: uptime, maintenance windows",
  SA: "Safety: avoid harm to people or accidental data loss",
  PO: "Portability: platforms, browsers, devices",
  MN: "Maintainability: ease of change and testing",
  SC: "Scalability: growth in users, data or load",
  L: "Legal: laws, standards, licenses",
  FT: "Fault tolerance: recovery, backup, working under failures",
  OT: "Other quality",
};

export const STATUS_LABEL: Record<string, string> = {
  pending: "Draft waiting for your review: approve it, reject it or ask the Twin to change it",
  approved: "Draft approved and saved in the Repository",
  rejected: "Draft rejected: it was not saved; it can be restored",
  active: "Saved requirement in force",
  under_review: "A requirement it depends on changed: review this one",
  superseded: "Replaced by a newer requirement",
  split: "Split into smaller requirements",
  merged: "Merged into another requirement",
};

export const ORIGIN_LABEL: Record<string, string> = {
  chat: "Proposed by the Digital Twin in the chat",
  meeting: "Read from a meeting you sent, utterance by utterance",
};

export const EARS_LABEL: Record<string, string> = {
  ubiquitous: "Always true: “The system shall …”",
  event: "Triggered by an event: “When …, the system shall …”",
  state: "While a state holds: “While …, the system shall …”",
  unwanted: "Handles a problem: “If …, then the system shall …”",
  optional: "Only where a feature exists: “Where …, the system shall …”",
  complex: "A combination of the patterns above",
};

export const EXPERT_LABEL = {
  reviewed: "An expert of the topic reviewed this requirement",
  edited: "An expert of the topic changed this requirement when reviewing it",
};
