/** Types shared by the GigaBrain REST API services. */

export type ConversationAction = "ask" | "propose" | "approved";
export type RequirementClass = "FR" | "NFR";

export interface UserStory {
  role: string;
  goal: string;
  benefit: string;
}

/** Constraint card of a non-functional requirement (an NFR is never a user story). */
export interface ConstraintCard {
  quality: string;
  scope: string;
  measure: string;
}

export interface AcceptanceCriterion {
  scenario: string;
  given: string;
  when: string;
  then: string;
}

export interface RequirementQuality {
  ears: boolean;
  ears_pattern: string | null;
  /** "story" for an FR, "constraint" for an NFR. */
  card?: "story" | "constraint";
  card_complete?: boolean;
  story_complete?: boolean | null;
  constraint_complete?: boolean | null;
  criteria_count: number;
  criteria_gherkin: boolean;
  vague_terms: string[];
}

export interface ValidationFinding {
  severity: string;
  message: string;
  suggestion?: string | null;
  [key: string]: unknown;
}

export interface ValidationDocumentScore {
  assessed: boolean;
  score: number;
  passed: boolean;
}

/** The Critic's report: on a proposal (with action=propose) or on a saved requirement. */
export interface ValidationReport {
  verdict: string;
  passed?: boolean;
  score?: number;
  scores?: Record<string, number>;
  document?: Record<string, ValidationDocumentScore>;
  failed_dimensions: string[];
  findings?: ValidationFinding[];
  rounds?: number;
  saved_with?: { report_id: string; verdict?: string | null } | null;
  [key: string]: unknown;
}

/** Where a piece of a requirement came from. */
export interface RequirementSource {
  kind: "conversation" | "turn" | "expert" | "requirement" | "validation" | string;
  ref: string;
  version?: number | null;
  action?: string | null;
  meeting?: number;
  [key: string]: unknown;
}

/** An expert that reviewed a requirement; `edited` when it changed it. */
export interface ExpertContribution {
  expert_id: string;
  knowledge_version?: number | null;
  action?: string | null;
  edited: boolean;
}

export interface ProposedRequirement {
  id?: string;
  title: string;
  statement: string;
  ears_pattern?: string;
  story?: UserStory | null;
  constraint?: ConstraintCard | null;
  turns?: string[];
  acceptance_criteria: AcceptanceCriterion[];
  class: RequirementClass;
  subtype: string | null;
  kind?: string;
  topics: string[];
  quality?: RequirementQuality;
  validation?: ValidationReport | null;
  [key: string]: unknown;
}

export type DraftStatus = "pending" | "approved" | "rejected";

/** A requirement of the conversation the PO has not approved yet (or already approved/rejected). */
export interface Draft extends ProposedRequirement {
  draft_id: string;
  status: DraftStatus;
  origin: "chat" | "meeting" | string;
  saved_as: string | null;
  sources: RequirementSource[];
}

export interface BehindTheScenesEvent {
  id: number;
  timestamp: string;
  sender: string;
  recipient: string;
  kind: string;
  summary: string;
  content?: Record<string, unknown>;
}

export interface TwinAnswer {
  action: ConversationAction;
  message: string;
  proposed_requirements: Draft[];
  drafts: Draft[];
  validation?: ValidationReport | null;
  saved: string[];
  pending_proposal: boolean;
  conversation_active: boolean;
  behind_the_scenes: BehindTheScenesEvent[];
}

export interface OpenConversationResponse {
  id: string;
  mode: "after_meeting" | "in_meeting";
  status: string;
  title?: string | null;
  active: boolean;
}

export interface CloseConversationResponse {
  id: string;
  status: "closed" | string;
  active: boolean;
}

export interface ConversationSummary {
  id: string;
  title?: string | null;
  started_at: string;
  ended_at: string | null;
  mode: string;
  status: string;
  events: number;
  active: boolean;
  in_memory?: boolean;
}

export interface ChatAttachment {
  name: string;
  size: number;
  content_type?: string | null;
}

export interface SendMessagePayload {
  text?: string;
  files?: File[];
  onUploadProgress?: (percent: number | null) => void;
}

export interface ConversationMessage {
  id: number;
  timestamp: string;
  author: "po" | "twin" | string;
  kind: string;
  text: string;
  attachments?: ChatAttachment[];
  proposed_requirements: ProposedRequirement[];
  saved: string[];
}

export interface ConversationListResponse {
  conversations: ConversationSummary[];
}

export interface ConversationDetails extends ConversationSummary {
  pending_proposal: boolean;
  messages: ConversationMessage[];
  drafts: Draft[];
  saved_requirements: string[];
  /** How many times each expert answered in this conversation. */
  expert_consultations: Record<string, number>;
}

export interface RequirementSummary {
  id: string;
  title: string;
  status: string;
  current_version: number;
  kind: string;
  topics: string[];
  statement: string | null;
  story?: UserStory | null;
  acceptance_criteria: number;
  class: RequirementClass;
  subtype: string | null;
  created_at: string;
  updated_at: string;
  quality?: RequirementQuality;
  sources?: RequirementSource[];
  experts?: ExpertContribution[];
}

export interface RequirementDetails {
  id: string;
  title: string;
  status: string;
  current_version: number;
  content: ProposedRequirement;
  quality: RequirementQuality;
  validation?: ValidationReport | null;
  sources?: RequirementSource[];
  experts?: ExpertContribution[];
  versions: Array<Record<string, unknown>>;
  links: RequirementLink[];
  trace: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export interface RequirementLink {
  id: number;
  source_id: string;
  target_id: string;
  kind: string;
  reason: string | null;
  conversation_id: string | null;
  created_at: string;
}

export interface ExpertSummary {
  id: string;
  topic: string;
  description: string;
  file: string;
  knowledge_version: number;
  consultations: number;
  created_at: string;
  updated_at: string;
}

export interface ExpertDetails extends ExpertSummary {
  knowledge: string;
  versions: Array<Record<string, unknown>>;
}

export interface ExpertListResponse {
  experts?: ExpertSummary[];
  items?: ExpertSummary[];
  results?: ExpertSummary[];
}

export interface RequirementListResponse {
  requirements?: RequirementSummary[];
  items?: RequirementSummary[];
  results?: RequirementSummary[];
}

export interface RequirementFilters {
  status?: string;
  topic?: string;
  search?: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  created_at: string;
}

export interface EpicItem {
  id: string;
  title: string;
  status: string;
  statement: string | null;
  subtype: string | null;
  acceptance_criteria: AcceptanceCriterion[];
  story?: UserStory | null;
  constraint?: ConstraintCard | null;
}

/** Requirements grouped by theme: user stories (FR) and constraint cards (NFR). */
export interface Epic {
  id: string;
  title: string;
  description: string;
  requirements: string[];
  created_at: string;
  stories: EpicItem[];
  constraints: EpicItem[];
}

/** How the requirements follow the format: share that passes each check. */
export interface FormatReport {
  requirements: number;
  fr: number;
  nfr: number;
  rates: Record<"ears" | "card" | "gherkin" | "not_vague", number | null>;
  failing: Record<"ears" | "card" | "gherkin" | "not_vague", string[]>;
  ears_patterns: Record<string, number>;
  nfr_with_story: string[];
}
