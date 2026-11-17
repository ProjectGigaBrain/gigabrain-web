import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent,
} from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  FileText,
  LoaderCircle,
  MessageSquare,
  Paperclip,
  RefreshCw,
  Send,
  X,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Typography } from "@/components/ui/typography";
import { getApiErrorMessage } from "@/services/api";
import {
  CHAT_FILE_INPUT_ACCEPT,
  CHAT_UPLOAD_CONSTRAINTS,
  ChatService,
  formatFileSize,
  validateChatFiles,
} from "@/services/chat.service";
import {
  HistoryService,
  notifyConversationsUpdated,
} from "@/services/history.service";
import type {
  ChatAttachment,
  ConversationDetails,
  ConversationMessage,
  TwinAnswer,
} from "@/services/api.types";

export const Route = createFileRoute("/projects/$projectId/conversations/$id/")(
  {
    component: ConversationDetailsPage,
  },
);

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getAuthorLabel(message: ConversationMessage): string {
  if (message.author === "po") return "Product Owner";
  if (message.author === "twin") return "Digital Twin";
  return message.author;
}

function ConversationDetailsPage() {
  const { projectId, id } = Route.useParams();
  const [conversation, setConversation] = useState<ConversationDetails | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  const loadConversation = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setConversation(await HistoryService.getChatById(projectId, id));
    } catch (requestError) {
      setError(
        getApiErrorMessage(requestError, "Cannot load conversation details."),
      );
    } finally {
      setIsLoading(false);
    }
  }, [projectId, id]);

  useEffect(() => {
    void loadConversation();
  }, [loadConversation]);

  const isBusy = isLoading || isSending || isApproving || isClosing;
  const isActive = Boolean(conversation?.active);

  const addFiles = (incoming: FileList | File[]) => {
    const list = Array.from(incoming);
    if (list.length === 0) return;

    const { valid, errors } = validateChatFiles(list, files.length);
    if (errors.length > 0) {
      setSendError(errors.join(" "));
    } else {
      setSendError(null);
    }

    if (valid.length > 0) {
      setFiles((current) => [...current, ...valid]);
    }
  };

  const removeFile = (indexToRemove: number) => {
    setFiles((current) =>
      current.filter((_, index) => index !== indexToRemove),
    );
  };

  const handleDragEnter = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (isBusy || !isActive) return;
    dragCounterRef.current += 1;
    if (event.dataTransfer.items && event.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragging(false);
    if (isBusy || !isActive) return;
    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      addFiles(event.dataTransfer.files);
      event.dataTransfer.clearData();
    }
  };

  const appendAnswerToConversation = (answer: TwinAnswer) => {
    const twinMessage: ConversationMessage = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      timestamp: new Date().toISOString(),
      author: "twin",
      kind: answer.action,
      text: answer.message,
      proposed_requirements: answer.proposed_requirements ?? [],
      saved: answer.saved ?? [],
    };

    setConversation((current) => {
      if (!current) return current;
      const savedSet = new Set([
        ...(current.saved_requirements ?? []),
        ...(answer.saved ?? []),
      ]);
      return {
        ...current,
        active: answer.conversation_active,
        status: answer.conversation_active ? current.status : "closed",
        pending_proposal: answer.pending_proposal,
        saved_requirements: Array.from(savedSet),
        messages: [...current.messages, twinMessage],
      };
    });

    if (answer.action === "approved") {
      setNotice(
        answer.saved?.length
          ? `Approved and Saved Requirements: ${answer.saved.join(", ")}.`
          : "The proposal was approved by the API.",
      );
    } else {
      setNotice(null);
    }
  };

  const submit = async () => {
    const text = message.trim();
    const attachedFiles = [...files];
    if (
      (!text && attachedFiles.length === 0) ||
      !conversation ||
      !isActive ||
      isSending ||
      isApproving
    ) {
      return;
    }

    const localAttachments: ChatAttachment[] = attachedFiles.map((file) => ({
      name: file.name,
      size: file.size,
      content_type: file.type || null,
    }));

    const optimisticId = -Date.now();
    const optimisticMessage: ConversationMessage = {
      id: optimisticId,
      timestamp: new Date().toISOString(),
      author: "po",
      kind: "message",
      text,
      attachments: localAttachments.length > 0 ? localAttachments : undefined,
      proposed_requirements: [],
      saved: [],
    };

    setConversation((current) =>
      current
        ? { ...current, messages: [...current.messages, optimisticMessage] }
        : current,
    );
    setMessage("");
    setFiles([]);
    setUploadProgress(attachedFiles.length > 0 ? 0 : null);
    setIsSending(true);
    setSendError(null);
    setNotice(null);

    try {
      const answer = await ChatService.sendMessage(projectId, id, text, {
        files: attachedFiles,
        onUploadProgress:
          attachedFiles.length > 0
            ? (percent) => setUploadProgress(percent)
            : undefined,
      });
      appendAnswerToConversation(answer);
      notifyConversationsUpdated();
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      }, 50);
    } catch (requestError) {
      setConversation((current) =>
        current
          ? {
              ...current,
              messages: current.messages.filter(
                (item) => item.id !== optimisticId,
              ),
            }
          : current,
      );
      setMessage(text);
      setFiles(attachedFiles);
      setSendError(
        getApiErrorMessage(requestError, "Cannot send message. Try again."),
      );
    } finally {
      setIsSending(false);
      setUploadProgress(null);
      composerRef.current?.focus();
    }
  };

  const approveProposal = async () => {
    if (
      !conversation ||
      !conversation.pending_proposal ||
      isApproving ||
      isSending
    )
      return;

    setIsApproving(true);
    setSendError(null);
    setNotice(null);

    try {
      const answer = await ChatService.approve(projectId, id);
      appendAnswerToConversation(answer);
      notifyConversationsUpdated();
    } catch (requestError) {
      setSendError(
        getApiErrorMessage(
          requestError,
          "The proposal could not be approved. No approval will be assumed.",
        ),
      );
    } finally {
      setIsApproving(false);
    }
  };

  const closeConversation = async () => {
    if (!conversation || !isActive || isClosing || isSending || isApproving)
      return;
    if (
      !window.confirm(
        "End this conversation without approving the pending proposal?",
      )
    )
      return;

    setIsClosing(true);
    setSendError(null);
    setNotice(null);

    try {
      await ChatService.close(projectId, id);
      setConversation((current) =>
        current
          ? {
              ...current,
              active: false,
              status: "closed",
              pending_proposal: false,
            }
          : current,
      );
      setNotice("Conversation ended. No pending proposal was approved.");
      notifyConversationsUpdated();
    } catch (requestError) {
      setSendError(
        getApiErrorMessage(
          requestError,
          "Cannot close conversation. Try Again.",
        ),
      );
    } finally {
      setIsClosing(false);
    }
  };

  const title = conversation?.title?.trim() || `Conversation ${id.slice(0, 8)}`;

  return (
    <DashboardLayout>
      <div
        className="relative flex h-dvh min-h-140 w-full flex-col overflow-hidden"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {isDragging && (
          <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs">
            <div className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-primary bg-card px-8 py-6 text-center shadow-sm">
              <Paperclip className="size-8 text-primary" />
              <Typography as="h3" className="font-semibold">
                Drop files here to attach
              </Typography>
              <Typography as="p" className="text-xs text-muted-foreground">
                Supported:{" "}
                {CHAT_UPLOAD_CONSTRAINTS.ACCEPTED_EXTENSIONS.join(", ")} (up to{" "}
                {formatFileSize(CHAT_UPLOAD_CONSTRAINTS.MAX_FILE_SIZE_BYTES)}{" "}
                each, max {CHAT_UPLOAD_CONSTRAINTS.MAX_FILES_PER_MESSAGE} files)
              </Typography>
            </div>
          </div>
        )}
        <header className="flex items-start gap-3 border-b px-4 py-4 sm:px-8">
          <SidebarTrigger className="mt-1 shrink-0" />
          <div className="min-w-0 flex-1">
            <Typography as="h1" className="text-xl font-semibold">
              {title}
            </Typography>
            <Typography as="p" className="mt-1">
              Conversation history with the Digital Twin
            </Typography>
            {conversation && (
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Clock3 className="size-3.5" /> Started at{" "}
                  {formatTimestamp(conversation.started_at)}
                </span>
                <span className="rounded-full border px-2 py-0.5">
                  {conversation.status}
                </span>
                {conversation.pending_proposal && (
                  <span className="rounded-full border border-amber-500/40 px-2 py-0.5 text-amber-700">
                    Pending proposal
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isActive && (
              <Button
                variant="ghost"
                className="h-9 rounded-xl px-3 text-muted-foreground"
                disabled={isBusy}
                onClick={() => void closeConversation()}
              >
                <XCircle />
                <span className="hidden sm:inline">End</span>
              </Button>
            )}
            <Button
              variant="outline"
              className="h-9 px-3"
              onClick={() => void loadConversation()}
              disabled={isBusy}
            >
              <RefreshCw className={isLoading ? "animate-spin" : ""} />
              <span className="hidden sm:inline">Update</span>
            </Button>
          </div>
        </header>

        <section
          aria-label="Mensagens da conversa"
          className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8"
        >
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
            {isLoading && (
              <div
                role="status"
                className="flex items-center gap-2 py-8 text-sm text-muted-foreground"
              >
                <LoaderCircle className="size-4 animate-spin" /> Loading
                conversation messages ...
              </div>
            )}

            {error && !isLoading && (
              <Card className="gap-3 rounded-2xl p-5" role="alert">
                <div className="flex items-start gap-2 text-destructive">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <p className="text-sm">{error}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => void loadConversation()}>
                    <RefreshCw /> Try Again
                  </Button>
                  <Link to="/projects/$projectId/chat" params={{ projectId }}>
                    <Button variant="outline">
                      <ArrowLeft /> New Conversation
                    </Button>
                  </Link>
                </div>
              </Card>
            )}

            {!isLoading &&
              !error &&
              conversation &&
              conversation.messages.length === 0 && (
                <div className="flex flex-col items-center gap-3 py-16 text-center">
                  <MessageSquare className="size-8 text-muted-foreground" />
                  <Typography as="h2" className="text-lg font-semibold">
                    This conversation is empty
                  </Typography>
                  <Typography as="p">
                    You can start a new conversation while the history is
                    available.
                  </Typography>
                  <Link to="/projects/$projectId/chat" params={{ projectId }}>
                    <Button>New Conversation</Button>
                  </Link>
                </div>
              )}

            {!isLoading &&
              !error &&
              conversation?.messages.map((message) => (
                <article
                  key={message.id}
                  className={`flex w-full ${message.author === "po" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`flex max-w-full flex-col gap-2 sm:max-w-[88%] ${message.author === "po" ? "items-end" : "items-start"}`}
                  >
                    <span className="px-1 text-xs font-medium text-muted-foreground">
                      {getAuthorLabel(message)}
                      {message.timestamp
                        ? ` · ${formatTimestamp(message.timestamp)}`
                        : ""}
                    </span>
                    {message.text && (
                      <div
                        className={`whitespace-pre-wrap wrap-break-word rounded-2xl px-4 py-3 text-sm leading-6 ${message.author === "po" ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md border bg-card"}`}
                      >
                        {message.text}
                      </div>
                    )}
                    {message.attachments && message.attachments.length > 0 && (
                      <div
                        className={`flex flex-wrap gap-1.5 ${message.author === "po" ? "justify-end" : "justify-start"}`}
                      >
                        {message.attachments.map((attachment, index) => (
                          <span
                            key={`${attachment.name}-${index}`}
                            className="inline-flex items-center gap-1.5 rounded-full border bg-muted/60 px-2.5 py-1 text-xs"
                          >
                            <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                            <span className="max-w-48 truncate font-medium">
                              {attachment.name}
                            </span>
                            <span className="text-muted-foreground">
                              ({formatFileSize(attachment.size)})
                            </span>
                          </span>
                        ))}
                      </div>
                    )}
                    {(message.proposed_requirements?.length ?? 0) > 0 && (
                      <div className="w-full rounded-xl border p-3">
                        <Typography as="h3" className="mb-2 font-semibold">
                          Proposed Requirements (
                          {message.proposed_requirements.length})
                        </Typography>
                        <ul className="flex flex-col gap-2">
                          {message.proposed_requirements.map(
                            (requirement, index) => (
                              <li
                                key={
                                  requirement.id ??
                                  `${requirement.title}-${index}`
                                }
                                className="rounded-lg bg-muted/40 p-3"
                              >
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="rounded-full border px-2 py-0.5 text-xs">
                                    {requirement.class}
                                  </span>
                                  <span className="font-medium text-sm">
                                    {requirement.title}
                                  </span>
                                </div>
                                <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                                  {requirement.statement}
                                </p>
                              </li>
                            ),
                          )}
                        </ul>
                      </div>
                    )}
                    {(message.saved?.length ?? 0) > 0 && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <CheckCircle2 className="size-3.5" /> Saved
                        requirements: {message.saved.join(", ")}
                      </div>
                    )}
                  </div>
                </article>
              ))}

            {isSending && (
              <div
                role="status"
                className="flex items-center gap-3 text-sm text-muted-foreground"
              >
                <LoaderCircle className="size-4 animate-spin" />
                <span>
                  {uploadProgress !== null && uploadProgress < 100
                    ? `Uploading attachments (${uploadProgress}%)...`
                    : "The Digital Twin is analyzing your message. This may take up to a minute."}
                </span>
              </div>
            )}

            {sendError && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <div className="min-w-0 flex-1">{sendError}</div>
              </div>
            )}

            {notice && (
              <div
                role="status"
                className="flex items-start gap-2 rounded-xl border border-border bg-muted/40 p-3 text-sm"
              >
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                <span>{notice}</span>
              </div>
            )}

            {conversation &&
              conversation.active &&
              conversation.pending_proposal &&
              !isLoading && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => void approveProposal()}
                    disabled={isBusy}
                    loading={isApproving}
                  >
                    <CheckCircle2 />
                    Approve proposal
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => composerRef.current?.focus()}
                    disabled={isBusy}
                  >
                    Edit proposal
                  </Button>
                </div>
              )}

            {!isLoading &&
              !error &&
              conversation &&
              conversation.saved_requirements.length > 0 && (
                <Card className="gap-2 rounded-2xl p-4">
                  <Typography as="h3" className="font-semibold">
                    Persisted Requirements
                  </Typography>
                  <div className="flex flex-wrap gap-2">
                    {conversation.saved_requirements.map((requirementId) => (
                      <span
                        key={requirementId}
                        className="rounded-full border px-2.5 py-1 text-xs"
                      >
                        {requirementId}
                      </span>
                    ))}
                  </div>
                </Card>
              )}

            {conversation && !conversation.active && !isLoading && !error && (
              <p className="rounded-xl border border-dashed p-3 text-center text-sm text-muted-foreground">
                This conversation is closed. The history is available for
                review.
              </p>
            )}
            <div ref={bottomRef} />
          </div>
        </section>

        {conversation && conversation.active && !error && (
          <footer className="border-t px-4 py-4 sm:px-8">
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-2">
              {files.length > 0 && (
                <div
                  aria-label="Selected attachments"
                  className="flex flex-wrap gap-2"
                >
                  {files.map((file, index) => (
                    <span
                      key={`${file.name}-${file.size}-${index}`}
                      className="inline-flex items-center gap-1.5 rounded-full border bg-muted/50 px-3 py-1 text-xs"
                    >
                      <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                      <span className="max-w-48 truncate font-medium">
                        {file.name}
                      </span>
                      <span className="text-muted-foreground">
                        ({formatFileSize(file.size)})
                      </span>
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        disabled={isBusy}
                        aria-label={`Remove ${file.name}`}
                        className="ml-0.5 rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                      >
                        <X className="size-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <form
                className="flex w-full items-end gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void submit();
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept={CHAT_FILE_INPUT_ACCEPT}
                  className="hidden"
                  onChange={(event) => {
                    if (event.target.files) {
                      addFiles(event.target.files);
                      event.target.value = "";
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="rounded-2xl shrink-0"
                  disabled={
                    isBusy ||
                    !isActive ||
                    files.length >=
                      CHAT_UPLOAD_CONSTRAINTS.MAX_FILES_PER_MESSAGE
                  }
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Attach files"
                  title={`Attach files (${CHAT_UPLOAD_CONSTRAINTS.ACCEPTED_EXTENSIONS.join(", ")})`}
                >
                  <Paperclip />
                </Button>
                <Textarea
                  ref={composerRef}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      !event.shiftKey &&
                      !event.nativeEvent.isComposing
                    ) {
                      event.preventDefault();
                      void submit();
                    }
                  }}
                  className="max-h-40 min-h-12 flex-1 resize-y rounded-2xl"
                  disabled={isBusy || !isActive}
                  placeholder="Continue the conversation or attach files..."
                  aria-label="Message to the Digital Twin"
                />
                <Button
                  type="submit"
                  size="icon"
                  className="rounded-2xl shrink-0"
                  loading={isSending}
                  disabled={
                    isBusy ||
                    !isActive ||
                    (!message.trim() && files.length === 0)
                  }
                  aria-label="Send message"
                >
                  <Send />
                </Button>
              </form>
              <p className="text-xs text-muted-foreground">
                Enter sends · Shift + Enter creates a line break · Drag and drop
                or attach{" "}
                {CHAT_UPLOAD_CONSTRAINTS.ACCEPTED_EXTENSIONS.join(", ")} (up to{" "}
                {formatFileSize(CHAT_UPLOAD_CONSTRAINTS.MAX_FILE_SIZE_BYTES)},
                max {CHAT_UPLOAD_CONSTRAINTS.MAX_FILES_PER_MESSAGE} files).
              </p>
            </div>
          </footer>
        )}
      </div>
    </DashboardLayout>
  );
}
