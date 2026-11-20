# gigabrain-web

Web application of GigaBrain, built with React, TypeScript, Vite and TanStack Router. The
Product Owner (PO) creates projects, talks to the Digital Twin to define requirements and
browses the requirements and experts of each project.

Part of the [ProjectGigaBrain](https://github.com/ProjectGigaBrain) organization, next to
[gigabrain-api](https://github.com/ProjectGigaBrain/gigabrain-api) (backend) and
[gigabrain-dataset](https://github.com/ProjectGigaBrain/gigabrain-dataset) (evaluation data).

## Requirements

- Node.js compatible with the Vite version of the project.
- The GigaBrain API running locally or reachable at the configured URL
  (`python main.py api` in [gigabrain-api](https://github.com/ProjectGigaBrain/gigabrain-api)).

## API configuration

Copy `.env.example` to `.env.local` and adjust it:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1
VITE_API_TOKEN=
```

`VITE_API_BASE_URL` is the base URL of the backend (default: `http://127.0.0.1:8000/api/v1`).

`VITE_API_TOKEN` is optional and only for local development, when the API was started with
`--token`. `VITE_*` variables are embedded in the browser bundle: **do not put production
secrets in it**.

The API documents itself at `http://127.0.0.1:8000/docs`.

### DeepSeek key

The key can be set on the server (`DEEPSEEK_API_KEY`) or typed in the app, under **Settings**
in the sidebar. A key typed in the app stays in the browser (`localStorage`) and is sent to
the API in the `X-LLM-Key` header when a conversation is opened; the API does not store it.

## Development

```bash
npm install
npm run dev
```

## Checks

```bash
npm run build
npm run lint
```

## Routes

| Route | What it shows |
|---|---|
| `/` | Institutional page |
| `/projects` | List, create and rename projects |
| `/projects/$projectId/chat` | Start a conversation (optional name) |
| `/projects/$projectId/conversations/$id` | The conversation: messages, meetings and its drafts, approved or rejected one by one |
| `/projects/$projectId/requirements` | Saved requirements, with search and filters |
| `/projects/$projectId/requirements/$id` | Details, Critic validation, quality checks, versions and traceability |
| `/projects/$projectId/epics` | Requirements grouped into epics (stories and constraint cards) and the format report |
| `/projects/$projectId/experts` | Expert catalog |
| `/projects/$projectId/experts/$id` | Knowledge file and versions of an expert |

Each project has its own requirements, conversations and experts.

## How a conversation works

- **Message** mode: talk to the Twin, attach documents (.txt, .md, .csv, .json, .docx, .pdf).
- **Meeting** mode: paste a transcript ("Speaker: what was said") or load a .txt/.md file. It is
  read one utterance at a time; each requirement becomes a **draft** (D1, D2...). Send the next
  part of the meeting later: it can correct earlier drafts.
- **Drafts** panel: approve or reject each draft, restore a rejected one, or approve all pending.
  The progress bar shows how many were saved and how complete their format is. Change a draft
  by talking ("in D3 the limit is 5", "reject D2").
- After an approval the conversation goes on; **End** closes it. Conversations can be renamed
  (pencil next to the name) and empty ones deleted (sidebar).
- An NFR shows a **constraint card** (quality, scope, measure) instead of a user story. "What do
  the tags mean?" explains every tag.

## Structure

- `src/services/api.ts`: shared Axios client, environment configuration, timeout and error messages.
- `src/services/api.types.ts`: TypeScript contracts of the API.
- `src/services/projects.service.ts`: projects.
- `src/services/chat.service.ts`: open, message, approve and close a conversation.
- `src/services/history.service.ts`: read-only queries (conversations, events, requirements, links, experts).
- `src/services/llmKey.ts`: the DeepSeek key typed by the user.
- `src/components/ValidationPanel`: the Critic's scores and findings.
- `src/components/DraftBoard`: the drafts of a conversation and their actions.
- `src/components/RequirementCard`: a requirement with its story or constraint card, criteria and checks.
- `src/components/TagLegend`: the tags and what they mean.
- `src/utils/requirements.ts`: completeness, progress and the experts that contributed.
