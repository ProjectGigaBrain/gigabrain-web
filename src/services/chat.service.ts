import { API } from "./api";
import type {
  CloseConversationResponse,
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

export const ChatService = {
  async openChat(projectId: string): Promise<OpenConversationResponse> {
    const { data } = await API.post<OpenConversationResponse>(
      conversationsPath(projectId),
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

  async approve(projectId: string, id: string): Promise<TwinAnswer> {
    const { data } = await API.post<TwinAnswer>(
      `${conversationPath(projectId, id)}/approve`,
    );
    return data;
  },

  async close(projectId: string, id: string): Promise<CloseConversationResponse> {
    const { data } = await API.post<CloseConversationResponse>(
      `${conversationPath(projectId, id)}/close`,
    );
    return data;
  },
};
