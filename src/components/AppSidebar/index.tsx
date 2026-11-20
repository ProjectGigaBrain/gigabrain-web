import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams, useRouterState } from "@tanstack/react-router";
import {
  AlertCircle,
  BrainCircuit,
  Eraser,
  FileText,
  FolderKanban,
  Layers,
  LoaderCircle,
  MessageSquare,
  Plus,
  RefreshCw,
  Settings,
  Trash2,
  User,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Typography } from "@/components/ui/typography";
import { getApiErrorMessage } from "@/services/api";
import { ChatService } from "@/services/chat.service";
import {
  CONVERSATIONS_UPDATED_EVENT,
  HistoryService,
  notifyConversationsUpdated,
} from "@/services/history.service";
import {
  PROJECTS_UPDATED_EVENT,
  ProjectsService,
} from "@/services/projects.service";
import type { ConversationSummary, Project } from "@/services/api.types";

import { Logo } from "./Logo";
import { LlmKeyForm } from "./LlmKeyForm";

function getConversationLabel(conversation: ConversationSummary): string {
  if (conversation.title?.trim()) return conversation.title.trim();
  return `Chat ${conversation.id.slice(0, 8)}`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

export function AppSidebar() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const { projectId } = useParams({ strict: false });
  const [project, setProject] = useState<Project | null>(null);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    const load = () =>
      ProjectsService.get(projectId)
        .then((result) => !cancelled && setProject(result))
        .catch(() => !cancelled && setProject(null));
    void load();
    window.addEventListener(PROJECTS_UPDATED_EVENT, load);
    return () => {
      cancelled = true;
      window.removeEventListener(PROJECTS_UPDATED_EVENT, load);
    };
  }, [projectId]);

  const loadConversations = useCallback(async () => {
    if (!projectId) {
      setConversations([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const result = await HistoryService.getChats(projectId);
      setConversations(result);
    } catch (requestError) {
      setError(
        getApiErrorMessage(
          requestError,
          "Can't load conversations. Try refreshing the page.",
        ),
      );
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  const navigate = useNavigate();

  const deleteConversation = async (conversation: ConversationSummary) => {
    if (!projectId) return;
    if (!window.confirm(`Delete "${getConversationLabel(conversation)}"? This cannot be undone.`)) return;
    try {
      await ChatService.remove(projectId, conversation.id);
      if (pathname.endsWith(`/conversations/${conversation.id}`)) {
        await navigate({ to: "/projects/$projectId/chat", params: { projectId } });
      }
      notifyConversationsUpdated();
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, "The conversation could not be deleted."));
    }
  };

  const deleteEmpty = async () => {
    if (!projectId) return;
    if (!window.confirm("Delete every conversation where nothing was written? This cannot be undone.")) return;
    try {
      const deleted = await ChatService.removeEmpty(projectId);
      if (deleted.some((cid) => pathname.endsWith(`/conversations/${cid}`))) {
        await navigate({ to: "/projects/$projectId/chat", params: { projectId } });
      }
      notifyConversationsUpdated();
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, "The empty conversations could not be deleted."));
    }
  };

  useEffect(() => {
    void loadConversations();
    window.addEventListener(CONVERSATIONS_UPDATED_EVENT, loadConversations);
    return () =>
      window.removeEventListener(
        CONVERSATIONS_UPDATED_EVENT,
        loadConversations,
      );
  }, [loadConversations]);

  return (
    <Sidebar>
      <SidebarHeader>
        <Logo />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={<Link to="/projects" />}
                  isActive={pathname === "/projects"}
                  tooltip="Projects"
                >
                  <FolderKanban />
                  <span>Projects</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {projectId && (
                <>
                  <SidebarMenuItem>
                    <p className="truncate px-2 pt-2 text-xs font-semibold text-muted-foreground">
                      {project?.name ?? projectId}
                    </p>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      render={
                        <Link
                          to="/projects/$projectId/chat"
                          params={{ projectId }}
                        />
                      }
                      isActive={pathname.endsWith("/chat")}
                      tooltip="New Conversation"
                    >
                      <Plus />
                      <span>New Conversation</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      render={
                        <Link
                          to="/projects/$projectId/requirements"
                          params={{ projectId }}
                        />
                      }
                      isActive={pathname.includes("/requirements")}
                      tooltip="Requirements"
                    >
                      <FileText />
                      <span>Requirements</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      render={
                        <Link
                          to="/projects/$projectId/epics"
                          params={{ projectId }}
                        />
                      }
                      isActive={pathname.includes("/epics")}
                      tooltip="Epics"
                    >
                      <Layers />
                      <span>Epics</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      render={
                        <Link
                          to="/projects/$projectId/experts"
                          params={{ projectId }}
                        />
                      }
                      isActive={pathname.includes("/experts")}
                      tooltip="Experts"
                    >
                      <BrainCircuit />
                      <span>Experts</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {projectId && (
          <SidebarGroup>
            <div className="flex items-center justify-between gap-2 px-2">
              <SidebarGroupLabel className="px-0">
                Recent Conversations
              </SidebarGroupLabel>
              <Button
                variant="ghost"
                size="icon"
                className="ml-auto size-7"
                aria-label="Delete empty conversations"
                title="Delete empty conversations"
                onClick={() => void deleteEmpty()}
                disabled={isLoading || conversations.length === 0}
              >
                <Eraser className="size-3.5" aria-hidden />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                aria-label="Refresh conversations"
                onClick={() => void loadConversations()}
                disabled={isLoading}
              >
                {isLoading ? (
                  <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
                ) : (
                  <RefreshCw className="size-3.5" aria-hidden />
                )}
              </Button>
            </div>
            <SidebarGroupContent>
              <SidebarMenu>
                {isLoading && conversations.length === 0 && (
                  <SidebarMenuItem>
                    <div
                      role="status"
                      className="flex items-center gap-2 px-2 py-3 text-xs text-muted-foreground"
                    >
                      <LoaderCircle className="size-3.5 animate-spin" /> Loading
                      History
                    </div>
                  </SidebarMenuItem>
                )}

                {error && (
                  <SidebarMenuItem>
                    <div
                      className="flex items-start gap-2 px-2 py-2 text-xs text-destructive"
                      role="alert"
                    >
                      <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                      <span className="min-w-0 flex-1">{error}</span>
                    </div>
                    <Button
                      variant="ghost"
                      className="ml-1 h-7 px-2 text-xs"
                      onClick={() => void loadConversations()}
                    >
                      Try Again
                    </Button>
                  </SidebarMenuItem>
                )}

                {!isLoading && !error && conversations.length === 0 && (
                  <SidebarMenuItem>
                    <Typography as="p" className="px-2 py-3 text-xs">
                      No conversations found
                    </Typography>
                  </SidebarMenuItem>
                )}

                {conversations.map((conversation) => {
                  const to = "/projects/$projectId/conversations/$id" as const;
                  const active = pathname.endsWith(
                    `/conversations/${conversation.id}`,
                  );
                  return (
                    <SidebarMenuItem key={conversation.id}>
                      <SidebarMenuButton
                        render={
                          <Link
                            to={to}
                            params={{
                              projectId: projectId!,
                              id: conversation.id,
                            }}
                          />
                        }
                        isActive={active}
                        tooltip={getConversationLabel(conversation)}
                      >
                        <MessageSquare />
                        <span className="min-w-0 flex-1 truncate">
                          {getConversationLabel(conversation)}
                        </span>
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {conversation.status === "closed" ? "closed · " : ""}
                          {formatDate(conversation.started_at)}
                        </span>
                      </SidebarMenuButton>
                      {conversation.status !== "approved" && (
                        <SidebarMenuAction
                          showOnHover
                          aria-label={`Delete ${getConversationLabel(conversation)}`}
                          title="Delete (only a conversation that saved nothing)"
                          onClick={() => void deleteConversation(conversation)}
                        >
                          <Trash2 />
                        </SidebarMenuAction>
                      )}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <details className="group">
              <summary className="list-none">
                <SidebarMenuButton tooltip="Settings" render={<div />}>
                  <Settings />
                  <span>Settings</span>
                </SidebarMenuButton>
              </summary>
              <LlmKeyForm />
            </details>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Profile" disabled>
              <User />
              <span>Profile</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
