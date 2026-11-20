import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  FileText,
  FileUp,
  LoaderCircle,
  MessageSquare,
  Paperclip,
  Pencil,
  RefreshCw,
  ScrollText,
  Send,
  X,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Typography } from "@/components/ui/typography";
import { DraftBoard } from "@/components/DraftBoard";
import { Tag, TagLegend } from "@/components/TagLegend";
import { getApiErrorMessage } from "@/services/api";
import {
  CHAT_FILE_INPUT_ACCEPT,
  CHAT_UPLOAD_CONSTRAINTS,
  ChatService,
  formatFileSize,
  validateChatFiles,
} from "@/services/chat.service";
import { HistoryService, notifyConversationsUpdated } from "@/services/history.service";
import type {
  BehindTheScenesEvent,
  ConversationDetails,
  ConversationMessage,
  Draft,
  TwinAnswer,
} from "@/services/api.types";

export const Route = createFileRoute("/projects/$projectId/conversations/$id/")({
  component: ConversationPage,
});

type Mode = "message" | "meeting";
const TRANSCRIPT_EXTENSIONS = [".txt", ".md", ".vtt", ".srt"];
const MEETING_EXAMPLE = "Analyst: How should login work?\nClient: Users must log in with their email and a password.";

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function conversationLabel(conversation: ConversationDetails | null, id: string): string {
  return conversation?.title?.trim() || `Conversation ${id.slice(0, 8)}`;
}

function ConversationPage() {
  const { projectId, id } = Route.useParams();
  const [conversation, setConversation] = useState<ConversationDetails | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [lastEvents, setLastEvents] = useState<BehindTheScenesEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [mode, setMode] = useState<Mode>("message");
  const [message, setMessage] = useState("");
  const [meetingTitle, setMeetingTitle] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [sending, setSending] = useState<null | "message" | "meeting">(null);
  const [pendingText, setPendingText] = useState<string | null>(null);
  const [busyDraft, setBusyDraft] = useState<string | null>(null);
  const [isApprovingAll, setIsApprovingAll] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [editingTitle, setEditingTitle] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const transcriptInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  const load = useCallback(async () => {
    try {
      const details = await HistoryService.getChatById(projectId, id);
      setConversation(details);
      setDrafts(details.drafts ?? []);
      setLoadError(null);
    } catch (requestError) {
      setLoadError(getApiErrorMessage(requestError, "Cannot load the conversation."));
    } finally {
      setIsLoading(false);
    }
  }, [projectId, id]);

  useEffect(() => {
    setIsLoading(true);
    setConversation(null);
    setDrafts([]);
    setLastEvents([]);
    setError(null);
    setNotice(null);
    void load();
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [conversation?.messages.length, pendingText, error, notice]);

  const isActive = Boolean(conversation?.active);
  const isBusy = isLoading || sending !== null || busyDraft !== null || isApprovingAll || isClosing;
  const pendingCount = drafts.filter((d) => d.status === "pending").length;

  /** Every action answers the same way: take its drafts now, then reload the messages. */
  const applyAnswer = async (answer: TwinAnswer, successNotice?: string) => {
    setDrafts(answer.drafts ?? []);
    setLastEvents(answer.behind_the_scenes ?? []);
    setNotice(successNotice ?? null); // the Twin's own message already says what was saved
    await load();
    notifyConversationsUpdated();
  };

  // ------------------------------------------------------------------ attachments

  const addFiles = (incoming: FileList | File[]) => {
    const { valid, errors } = validateChatFiles(Array.from(incoming), files.length);
    setError(errors.length ? errors.join(" ") : null);
    if (valid.length) setFiles((current) => [...current, ...valid]);
  };

  const loadTranscript = async (file: File) => {
    const lower = file.name.toLocaleLowerCase("en-US");
    if (!TRANSCRIPT_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
      setError(`A transcript must be a text file (${TRANSCRIPT_EXTENSIONS.join(", ")}). For .docx or .pdf, attach it to a message.`);
      return;
    }
    setMessage(await file.text());
    if (!meetingTitle.trim()) setMeetingTitle(file.name.replace(/\.[^.]+$/, ""));
    setError(null);
  };

  const dragHandlers = {
    onDragEnter: (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      if (isBusy || !isActive) return;
      dragCounterRef.current += 1;
      if (event.dataTransfer.items?.length) setIsDragging(true);
    },
    onDragLeave: (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
      if (dragCounterRef.current === 0) setIsDragging(false);
    },
    onDragOver: (event: DragEvent<HTMLElement>) => event.preventDefault(),
    onDrop: (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      dragCounterRef.current = 0;
      setIsDragging(false);
      if (isBusy || !isActive || !event.dataTransfer.files?.length) return;
      if (mode === "meeting") void loadTranscript(event.dataTransfer.files[0]);
      else addFiles(event.dataTransfer.files);
    },
  };

  // ------------------------------------------------------------------ actions

  const submit = async () => {
    const text = message.trim();
    if (isBusy || !isActive) return;
    if (mode === "meeting") {
      if (!text) return;
      setSending("meeting");
      setPendingText(`Meeting${meetingTitle.trim() ? ` “${meetingTitle.trim()}”` : ""}: ${text.split("\n").filter((l) => l.trim()).length} lines`);
      setError(null);
      setNotice(null);
      try {
        const answer = await ChatService.sendMeeting(projectId, id, text, meetingTitle);
        setMessage("");
        setMeetingTitle("");
        await applyAnswer(answer);
      } catch (requestError) {
        setError(getApiErrorMessage(requestError, "The meeting could not be read. Try again."));
      } finally {
        setSending(null);
        setPendingText(null);
      }
      return;
    }

    const attached = [...files];
    if (!text && !attached.length) return;
    setSending("message");
    setPendingText(text || attached.map((f) => f.name).join(", "));
    setUploadProgress(attached.length ? 0 : null);
    setMessage("");
    setFiles([]);
    setError(null);
    setNotice(null);
    try {
      const answer = await ChatService.sendMessage(projectId, id, text, {
        files: attached,
        onUploadProgress: attached.length ? (percent) => setUploadProgress(percent) : undefined,
      });
      await applyAnswer(answer);
    } catch (requestError) {
      setMessage(text);
      setFiles(attached);
      setError(getApiErrorMessage(requestError, "Cannot send the message. Try again."));
    } finally {
      setSending(null);
      setPendingText(null);
      setUploadProgress(null);
      composerRef.current?.focus();
    }
  };

  const draftAction = async (draftId: string, action: "approve" | "reject" | "restore") => {
    if (isBusy) return;
    setBusyDraft(draftId);
    setError(null);
    // Optimistic: the card moves at once; on error the list comes back as it was.
    const before = drafts;
    const optimistic: Record<typeof action, Draft["status"]> = { approve: "approved", reject: "rejected", restore: "pending" };
    setDrafts((current) => current.map((d) => (d.draft_id === draftId ? { ...d, status: optimistic[action] } : d)));
    try {
      const call = { approve: ChatService.approveDraft, reject: ChatService.rejectDraft, restore: ChatService.restoreDraft }[action];
      const answer = await call(projectId, id, draftId);
      await applyAnswer(answer, action === "reject" ? `${draftId} rejected. Restore it from the "rejected" filter.` : undefined);
    } catch (requestError) {
      setDrafts(before);
      setError(getApiErrorMessage(requestError, `Could not ${action} ${draftId}.`));
    } finally {
      setBusyDraft(null);
    }
  };

  const approveAll = async () => {
    if (isBusy || !pendingCount) return;
    setIsApprovingAll(true);
    setError(null);
    try {
      await applyAnswer(await ChatService.approve(projectId, id));
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, "The drafts could not be approved. Nothing was saved."));
    } finally {
      setIsApprovingAll(false);
    }
  };

  const saveTitle = async () => {
    if (editingTitle === null) return;
    const title = editingTitle.trim();
    if (title.length > 80) {
      setError("The name has at most 80 characters.");
      return;
    }
    const previous = conversation;
    setConversation((current) => (current ? { ...current, title: title || null } : current));
    setEditingTitle(null);
    try {
      await ChatService.rename(projectId, id, title);
      notifyConversationsUpdated();
    } catch (requestError) {
      setConversation(previous);
      setError(getApiErrorMessage(requestError, "The conversation could not be renamed."));
    }
  };

  const close = async () => {
    if (isBusy || !isActive) return;
    const warning = pendingCount
      ? `End this conversation? ${pendingCount} pending draft(s) will not be saved.`
      : "End this conversation? It keeps its history but takes no more messages.";
    if (!window.confirm(warning)) return;
    setIsClosing(true);
    try {
      await ChatService.close(projectId, id);
      setNotice("Conversation ended.");
      await load();
      notifyConversationsUpdated();
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, "Cannot end the conversation."));
    } finally {
      setIsClosing(false);
    }
  };

  // ------------------------------------------------------------------ view

  if (isLoading && !conversation) {
    return (
      <DashboardLayout>
        <div role="status" className="flex h-dvh items-center justify-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" /> Loading conversation...
        </div>
      </DashboardLayout>
    );
  }

  if (loadError && !conversation) {
    return (
      <DashboardLayout>
        <div className="flex h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
          <AlertCircle className="size-6 text-destructive" />
          <p className="text-sm">{loadError}</p>
          <Button variant="outline" onClick={() => void load()}>
            <RefreshCw /> Try again
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const status = conversation?.status ?? "open";

  return (
    <DashboardLayout>
      <div className="relative flex h-dvh min-h-140 w-full flex-col" {...dragHandlers}>
        {isDragging && (
          <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs">
            <div className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-primary bg-card px-8 py-6 text-center">
              {mode === "meeting" ? <ScrollText className="size-8 text-primary" /> : <Paperclip className="size-8 text-primary" />}
              <Typography as="h3" className="font-semibold">
                {mode === "meeting" ? "Drop the transcript (.txt, .md)" : "Drop files to attach"}
              </Typography>
            </div>
          </div>
        )}

        <header className="border-b px-4 py-3 sm:px-6">
          <div className="flex w-full flex-wrap items-center gap-3">
            <SidebarTrigger />
            <div className="min-w-0 flex-1">
              {editingTitle !== null ? (
                <form
                  className="flex items-center gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void saveTitle();
                  }}
                >
                  <Input
                    autoFocus
                    aria-label="Conversation name"
                    maxLength={80}
                    value={editingTitle}
                    onChange={(event) => setEditingTitle(event.target.value)}
                    onKeyDown={(event) => event.key === "Escape" && setEditingTitle(null)}
                    className="h-9 max-w-md"
                  />
                  <Button type="submit" size="icon-sm" aria-label="Save name">
                    <Check />
                  </Button>
                  <Button type="button" variant="ghost" size="icon-sm" aria-label="Cancel" onClick={() => setEditingTitle(null)}>
                    <X />
                  </Button>
                </form>
              ) : (
                <div className="flex items-center gap-2">
                  <Typography as="h1" className="truncate text-lg font-semibold">
                    {conversationLabel(conversation, id)}
                  </Typography>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Rename conversation"
                    onClick={() => setEditingTitle(conversation?.title ?? "")}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                </div>
              )}
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <Tag
                  tone={status === "closed" ? "muted" : status === "approved" ? "success" : "primary"}
                  title={
                    status === "approved"
                      ? "Something was already saved; the conversation goes on"
                      : status === "closed"
                        ? "Ended: it keeps its history and takes no more messages"
                        : "Nothing saved yet"
                  }
                >
                  {status === "approved" ? "Has approvals" : status}
                </Tag>
                {pendingCount > 0 && <Tag tone="warning">{pendingCount} pending draft(s)</Tag>}
                {conversation?.saved_requirements.length ? (
                  <span className="text-xs text-muted-foreground">Saved: {[...new Set(conversation.saved_requirements)].join(", ")}</span>
                ) : null}
              </div>
            </div>
            {isActive && (
              <Button variant="ghost" className="h-9 px-3 text-muted-foreground" disabled={isBusy} onClick={() => void close()}>
                <XCircle />
                <span className="hidden sm:inline">End</span>
              </Button>
            )}
          </div>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto xl:grid-cols-[minmax(0,1fr)_minmax(380px,520px)] xl:overflow-hidden">
          {/* Messages */}
          <section aria-label="Conversation" aria-live="polite" className="px-4 py-5 sm:px-6 xl:min-h-0 xl:overflow-y-auto">
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
              {conversation?.messages.length === 0 && !pendingText && (
                <div className="mx-auto flex max-w-lg flex-col items-center gap-3 py-12 text-center">
                  <div className="flex size-14 items-center justify-center rounded-2xl border bg-muted/40">
                    <MessageSquare className="size-6 text-muted-foreground" />
                  </div>
                  <Typography as="h2" className="text-lg font-semibold">
                    Where do we start?
                  </Typography>
                  <Typography as="p">
                    Describe a need to the Twin, or switch to <b>Meeting</b> and paste the transcript of a meeting. Its
                    requirements become drafts: change them by talking, approve or reject them one by one.
                  </Typography>
                </div>
              )}

              {conversation?.messages.map((item) => <MessageBubble key={item.id} message={item} />)}

              {pendingText && (
                <>
                  <div className="flex justify-end">
                    <div className="max-w-[88%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-primary px-4 py-3 text-sm text-primary-foreground">
                      {pendingText.length > 600 ? `${pendingText.slice(0, 600)}…` : pendingText}
                    </div>
                  </div>
                  <div role="status" className="flex items-center gap-3 text-sm text-muted-foreground">
                    <LoaderCircle className="size-4 animate-spin" />
                    {sending === "meeting"
                      ? "Reading the meeting one utterance at a time, with the experts. A long meeting takes a few minutes."
                      : uploadProgress !== null && uploadProgress < 100
                        ? `Uploading attachments (${uploadProgress}%)...`
                        : "The Digital Twin is working on it. This may take up to a minute."}
                  </div>
                </>
              )}

              {lastEvents.length > 0 && !pendingText && (
                <details className="w-full rounded-xl border px-3 py-2 text-sm">
                  <summary className="cursor-pointer font-medium text-muted-foreground">
                    Internal steps of the last answer ({lastEvents.length})
                  </summary>
                  <ol className="mt-3 flex max-h-80 flex-col gap-2 overflow-y-auto">
                    {lastEvents.map((event, index) => (
                      <li key={`${event.id}-${index}`} className="border-l-2 pl-3">
                        <p className="font-medium">
                          {event.sender} → {event.recipient} <span className="text-xs text-muted-foreground">{event.kind}</span>
                        </p>
                        <p className="text-muted-foreground">{event.summary}</p>
                      </li>
                    ))}
                  </ol>
                </details>
              )}

              {error && (
                <div role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <div className="min-w-0 flex-1">{error}</div>
                  <button type="button" aria-label="Dismiss" onClick={() => setError(null)}>
                    <X className="size-4" />
                  </button>
                </div>
              )}
              {notice && (
                <div role="status" className="flex items-start gap-2 rounded-xl border bg-muted/40 p-3 text-sm">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                  <span className="whitespace-pre-wrap">{notice}</span>
                </div>
              )}
              {!isActive && (
                <div className="rounded-2xl border border-dashed p-4 text-center text-sm text-muted-foreground">
                  This conversation has ended. Its history and saved requirements stay available.
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </section>

          {/* Drafts */}
          <aside aria-label="Drafts" className="border-t px-4 py-5 sm:px-6 xl:min-h-0 xl:overflow-y-auto xl:border-t-0 xl:border-l">
            <div className="flex flex-col gap-3">
              <div>
                <Typography as="h2" className="font-semibold">
                  Drafts
                </Typography>
                <Typography as="p" className="text-sm">
                  What the Twin proposed or read from your meetings. Nothing is saved until you approve it.
                </Typography>
              </div>
              <DraftBoard
                drafts={drafts}
                busyDraft={busyDraft}
                disabled={isBusy || !isActive}
                onApprove={(draftId) => void draftAction(draftId, "approve")}
                onReject={(draftId) => void draftAction(draftId, "reject")}
                onRestore={(draftId) => void draftAction(draftId, "restore")}
                onApproveAll={() => void approveAll()}
              />
              {drafts.length > 0 && <TagLegend />}
            </div>
          </aside>
        </div>

        {isActive && (
          <footer className="border-t px-4 py-3 sm:px-6">
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <div role="tablist" aria-label="What to send" className="inline-flex rounded-full border p-0.5 text-sm">
                  {(["message", "meeting"] as Mode[]).map((value) => (
                    <button
                      key={value}
                      role="tab"
                      type="button"
                      aria-selected={mode === value}
                      onClick={() => setMode(value)}
                      disabled={isBusy}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 ${mode === value ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                    >
                      {value === "message" ? <MessageSquare className="size-3.5" /> : <ScrollText className="size-3.5" />}
                      {value === "message" ? "Message" : "Meeting"}
                    </button>
                  ))}
                </div>
                {mode === "meeting" && (
                  <>
                    <Input
                      aria-label="Meeting name"
                      placeholder="Meeting name (optional)"
                      maxLength={80}
                      value={meetingTitle}
                      onChange={(event) => setMeetingTitle(event.target.value)}
                      className="h-8 max-w-60"
                      disabled={isBusy}
                    />
                    <input
                      ref={transcriptInputRef}
                      type="file"
                      accept={TRANSCRIPT_EXTENSIONS.join(",")}
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void loadTranscript(file);
                        event.target.value = "";
                      }}
                    />
                    <Button variant="outline" className="h-8 px-3" disabled={isBusy} onClick={() => transcriptInputRef.current?.click()}>
                      <FileUp /> Load transcript
                    </Button>
                  </>
                )}
              </div>

              {mode === "message" && files.length > 0 && (
                <div aria-label="Selected attachments" className="flex flex-wrap gap-2">
                  {files.map((file, index) => (
                    <span key={`${file.name}-${index}`} className="inline-flex items-center gap-1.5 rounded-full border bg-muted/50 px-3 py-1 text-xs">
                      <FileText className="size-3.5 text-muted-foreground" />
                      <span className="max-w-48 truncate font-medium">{file.name}</span>
                      <span className="text-muted-foreground">({formatFileSize(file.size)})</span>
                      <button
                        type="button"
                        onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}
                        aria-label={`Remove ${file.name}`}
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
                {mode === "message" && (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept={CHAT_FILE_INPUT_ACCEPT}
                      className="hidden"
                      onChange={(event) => {
                        if (event.target.files) addFiles(event.target.files);
                        event.target.value = "";
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="shrink-0 rounded-2xl"
                      disabled={isBusy || files.length >= CHAT_UPLOAD_CONSTRAINTS.MAX_FILES_PER_MESSAGE}
                      onClick={() => fileInputRef.current?.click()}
                      aria-label="Attach files"
                      title={`Attach files (${CHAT_UPLOAD_CONSTRAINTS.ACCEPTED_EXTENSIONS.join(", ")})`}
                    >
                      <Paperclip />
                    </Button>
                  </>
                )}
                <Textarea
                  ref={composerRef}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  onKeyDown={(event) => {
                    if (mode === "message" && event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                      event.preventDefault();
                      void submit();
                    }
                  }}
                  className={`flex-1 resize-y rounded-2xl ${mode === "meeting" ? "max-h-80 min-h-32 font-mono text-xs" : "max-h-40 min-h-12"}`}
                  disabled={isBusy}
                  placeholder={
                    mode === "meeting"
                      ? `Paste the transcript, one utterance per line ("Speaker: what was said"). E.g.:\n${MEETING_EXAMPLE}`
                      : pendingCount
                        ? `Talk about the drafts ("in ${drafts.find((d) => d.status === "pending")?.draft_id ?? "D1"} the limit is 5", "reject D2") or ask for something new.`
                        : "Describe what the system needs, or attach documents."
                  }
                  aria-label={mode === "meeting" ? "Meeting transcript" : "Message to the Digital Twin"}
                />
                <Button
                  type="submit"
                  size="icon"
                  className="shrink-0 rounded-2xl"
                  loading={sending !== null}
                  disabled={isBusy || (!message.trim() && (mode === "meeting" || files.length === 0))}
                  aria-label={mode === "meeting" ? "Send meeting" : "Send message"}
                >
                  <Send />
                </Button>
              </form>
              <p className="text-xs text-muted-foreground">
                {mode === "meeting"
                  ? "Send the meeting in parts if you like: a later part can correct the drafts of an earlier one."
                  : `Enter sends · Shift + Enter breaks the line · Attach ${CHAT_UPLOAD_CONSTRAINTS.ACCEPTED_EXTENSIONS.join(", ")} (up to ${formatFileSize(CHAT_UPLOAD_CONSTRAINTS.MAX_FILE_SIZE_BYTES)}, ${CHAT_UPLOAD_CONSTRAINTS.MAX_FILES_PER_MESSAGE} files) · Writing "approved" approves every pending draft.`}
              </p>
            </div>
          </footer>
        )}
      </div>
    </DashboardLayout>
  );
}

function MessageBubble({ message }: { message: ConversationMessage }) {
  const fromPo = message.author === "po";
  const kindLabel: Record<string, string> = {
    meeting: "Meeting sent",
    approval: "Approval",
    proposal: "Proposal",
    confirmation: "Saved",
    question_to_po: "Question",
  };
  const proposed = message.proposed_requirements ?? [];
  const text = message.kind === "po_request" && message.text.length > 1200 ? `${message.text.slice(0, 1200)}…` : message.text;
  return (
    <article className={`flex w-full ${fromPo ? "justify-end" : "justify-start"}`}>
      <div className={`flex max-w-full flex-col gap-1.5 sm:max-w-[88%] ${fromPo ? "items-end" : "items-start"}`}>
        <span className="px-1 text-xs text-muted-foreground">
          {fromPo ? "You · Product Owner" : "GigaBrain · Digital Twin"}
          {kindLabel[message.kind] ? ` · ${kindLabel[message.kind]}` : ""} · {formatTimestamp(message.timestamp)}
        </span>
        {text && (
          <div
            className={`whitespace-pre-wrap wrap-break-word rounded-2xl px-4 py-3 text-sm leading-6 ${
              fromPo ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md border bg-card"
            } ${message.kind === "meeting" ? "flex items-center gap-2" : ""}`}
          >
            {message.kind === "meeting" && <ScrollText className="size-4 shrink-0" />}
            {text}
          </div>
        )}
        {proposed.length > 0 && (
          <div className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
            {proposed.map((r, index) => (
              <span key={`${String(r.draft_id ?? r.title)}-${index}`} className="rounded-full border px-2.5 py-1" title={r.statement}>
                {String(r.draft_id ?? "")} {r.title}
              </span>
            ))}
          </div>
        )}
        {message.saved?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {message.saved.map((rid) => (
              <Tag key={rid} tone="success">
                {rid}
              </Tag>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
