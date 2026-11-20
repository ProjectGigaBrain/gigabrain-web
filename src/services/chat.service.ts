import { API } from "./api";
import type {
  CloseConversationResponse,
  ConversationSummary,
  OpenConversationResponse,
  SendMessagePayload,
  TwinAnswer,
} from "./api.types";

/**
 * Centralized attachment constraints for chat messages.
 * Adjust here if the backend updates its limits or accepted formats.
 */
export const CHAT_UPLOAD_CONSTRAINTS = {
  MAX_FILE_SIZE_BYTES: 10 * 1024 * 1024, // 10 MB per file
  MAX_FILES_PER_MESSAGE: 5,
  ACCEPTED_EXTENSIONS: [".pdf", ".docx", ".md", ".txt", ".csv", ".json"] as const,
  ACCEPTED_MIME_TYPES: [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/markdown",
    "text/x-markdown",
    "text/plain",
    "text/csv",
    "application/csv",
    "application/vnd.ms-excel",
    "application/json",
    "text/json",
  ] as const,
} as const;

export const CHAT_FILE_INPUT_ACCEPT = [
  ...CHAT_UPLOAD_CONSTRAINTS.ACCEPTED_EXTENSIONS,
  ...CHAT_UPLOAD_CONSTRAINTS.ACCEPTED_MIME_TYPES,
].join(",");

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb < 10 ? 1 : 0)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

export function validateChatFiles(
  incoming: File[],
  existingCount = 0,
): { valid: File[]; errors: string[] } {
  const valid: File[] = [];
  const errors: string[] = [];
  const { MAX_FILE_SIZE_BYTES, MAX_FILES_PER_MESSAGE, ACCEPTED_EXTENSIONS, ACCEPTED_MIME_TYPES } =
    CHAT_UPLOAD_CONSTRAINTS;

  const allowedSlots = Math.max(0, MAX_FILES_PER_MESSAGE - existingCount);
  if (incoming.length > allowedSlots) {
    errors.push(
      `Maximum of ${MAX_FILES_PER_MESSAGE} files per message allowed.`,
    );
  }

  const candidates = incoming.slice(0, allowedSlots);

  for (const file of candidates) {
    const lowerName = file.name.toLocaleLowerCase("en-US");
    const hasValidExtension = ACCEPTED_EXTENSIONS.some((ext) =>
      lowerName.endsWith(ext),
    );
    const mime = file.type?.toLocaleLowerCase("en-US").trim() ?? "";
    const hasValidMime =
      !mime ||
      mime === "application/octet-stream" ||
      (ACCEPTED_MIME_TYPES as readonly string[]).includes(mime);

    if (!hasValidExtension || !hasValidMime) {
      errors.push(
        `"${file.name}" is not supported. Accepted formats: ${ACCEPTED_EXTENSIONS.join(", ")}.`,
      );
      continue;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      errors.push(
        `"${file.name}" (${formatFileSize(file.size)}) exceeds the maximum size of ${formatFileSize(MAX_FILE_SIZE_BYTES)}.`,
      );
      continue;
    }

    valid.push(file);
  }

  return { valid, errors };
}

const conversationsPath = (projectId: string) =>
  `/projects/${encodeURIComponent(projectId)}/conversations`;
const conversationPath = (projectId: string, id: string) =>
  `${conversationsPath(projectId)}/${encodeURIComponent(id)}`;

/** A meeting is read one utterance at a time: a long one takes minutes, so no request timeout. */
const MEETING_TIMEOUT_MS = 0;

export const ChatService = {
  async openChat(projectId: string, title?: string): Promise<OpenConversationResponse> {
    const { data } = await API.post<OpenConversationResponse>(
      conversationsPath(projectId),
      title?.trim() ? { title: title.trim() } : undefined,
    );
    return data;
  },

  /** Send a meeting transcript (or its next part): its requirements come back as drafts. */
  async sendMeeting(projectId: string, id: string, text: string, title?: string): Promise<TwinAnswer> {
    const { data } = await API.post<TwinAnswer>(
      `${conversationPath(projectId, id)}/meeting`,
      { text, ...(title?.trim() ? { title: title.trim() } : {}) },
      { timeout: MEETING_TIMEOUT_MS },
    );
    return data;
  },

  async sendMessage(
    projectId: string,
    id: string,
    text: string,
    options?: Omit<SendMessagePayload, "text">,
  ): Promise<TwinAnswer> {
    const files = options?.files ?? [];
    const url = `${conversationPath(projectId, id)}/messages`;

    if (files.length === 0) {
      const { data } = await API.post<TwinAnswer>(url, {
        text,
      });
      return data;
    }

    const formData = new FormData();
    if (text.trim()) {
      formData.append("text", text);
    }
    for (const file of files) {
      formData.append("files", file);
    }

    const { data } = await API.post<TwinAnswer>(url, formData, {
      headers: {
        "Content-Type": undefined,
      },
      timeout: 120_000,
      onUploadProgress: options?.onUploadProgress
        ? (progressEvent) => {
            if (progressEvent.total && progressEvent.total > 0) {
              const percent = Math.round(
                (progressEvent.loaded * 100) / progressEvent.total,
              );
              options.onUploadProgress?.(percent);
            } else {
              options.onUploadProgress?.(null);
            }
          }
        : undefined,
    });
    return data;
  },

  /** Approve the pending drafts: all of them, or only `draftIds`. */
  async approve(projectId: string, id: string, draftIds?: string[]): Promise<TwinAnswer> {
    const { data } = await API.post<TwinAnswer>(
      `${conversationPath(projectId, id)}/approve`,
      draftIds ? { draft_ids: draftIds } : undefined,
    );
    return data;
  },

  async approveDraft(projectId: string, id: string, draftId: string): Promise<TwinAnswer> {
    const { data } = await API.post<TwinAnswer>(
      `${conversationPath(projectId, id)}/drafts/${encodeURIComponent(draftId)}/approve`,
    );
    return data;
  },

  async rejectDraft(projectId: string, id: string, draftId: string): Promise<TwinAnswer> {
    const { data } = await API.delete<TwinAnswer>(
      `${conversationPath(projectId, id)}/drafts/${encodeURIComponent(draftId)}`,
    );
    return data;
  },

  async restoreDraft(projectId: string, id: string, draftId: string): Promise<TwinAnswer> {
    const { data } = await API.post<TwinAnswer>(
      `${conversationPath(projectId, id)}/drafts/${encodeURIComponent(draftId)}/restore`,
    );
    return data;
  },

  async rename(projectId: string, id: string, title: string): Promise<ConversationSummary> {
    const { data } = await API.patch<ConversationSummary>(conversationPath(projectId, id), { title });
    return data;
  },

  /** Delete a conversation that saved nothing (the API answers 409 for one that did). */
  async remove(projectId: string, id: string): Promise<void> {
    await API.delete(conversationPath(projectId, id));
  },

  /** Delete every conversation where the PO never wrote. Returns the deleted ids. */
  async removeEmpty(projectId: string): Promise<string[]> {
    const { data } = await API.delete<{ deleted: string[] }>(conversationsPath(projectId));
    return data.deleted;
  },

  async close(projectId: string, id: string): Promise<CloseConversationResponse> {
    const { data } = await API.post<CloseConversationResponse>(
      `${conversationPath(projectId, id)}/close`,
    );
    return data;
  },
};
