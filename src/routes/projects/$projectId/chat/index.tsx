import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertCircle, MessageSquare, ScrollText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Typography } from "@/components/ui/typography";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { getApiErrorMessage } from "@/services/api";
import { ChatService } from "@/services/chat.service";
import { notifyConversationsUpdated } from "@/services/history.service";
import { getWelcomeMessage } from "@/utils/getWelcomeMessage";

export const Route = createFileRoute("/projects/$projectId/chat/")({
  component: NewConversation,
});

/** Opens a conversation only when the PO asks for it, so no empty conversation is left behind. */
function NewConversation() {
  const { projectId } = Route.useParams();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [isOpening, setIsOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    if (isOpening) return;
    setIsOpening(true);
    setError(null);
    try {
      const conversation = await ChatService.openChat(projectId, title);
      notifyConversationsUpdated();
      await navigate({ to: "/projects/$projectId/conversations/$id", params: { projectId, id: conversation.id } });
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, "Cannot open the conversation. Try again."));
      setIsOpening(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex h-dvh w-full flex-col">
        <header className="flex items-center gap-3 border-b px-4 py-4 sm:px-8">
          <SidebarTrigger />
          <Typography as="h1" className="text-xl font-semibold">
            {getWelcomeMessage()}
          </Typography>
        </header>
        <section className="flex flex-1 items-center justify-center px-4">
          <form
            className="flex w-full max-w-lg flex-col gap-4 rounded-2xl border p-6"
            onSubmit={(event) => {
              event.preventDefault();
              void start();
            }}
          >
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10">
                <MessageSquare className="size-5" />
              </div>
              <Typography as="h2" className="text-lg font-semibold">
                New conversation with the Digital Twin
              </Typography>
            </div>
            <Typography as="p" className="text-sm">
              Talk about a need, or send the transcript of a meeting (<ScrollText className="inline size-3.5" /> Meeting).
              The requirements become drafts you review, change and approve one by one; the conversation goes on after
              each approval.
            </Typography>
            <Input
              aria-label="Conversation name"
              placeholder="Name (optional), e.g. Kick-off with the client"
              maxLength={80}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              disabled={isOpening}
            />
            {error && (
              <div role="alert" className="flex items-start gap-2 text-sm text-destructive">
                <AlertCircle className="mt-0.5 size-4 shrink-0" /> {error}
              </div>
            )}
            <Button type="submit" loading={isOpening}>
              Start conversation
            </Button>
          </form>
        </section>
      </div>
    </DashboardLayout>
  );
}
