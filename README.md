# SKS - Smart Knowledge System

SKS is a full-stack academic document workspace. It lets users upload study documents, organize them into folders, search by meaning, preview/read files, save study notes, and use grounded AI features over indexed document content.

The project has changed from the earlier mind map version. Mind map and diagram generation are no longer part of the current codebase. The current AI feature set is summary, document Q&A, Study GPS, quiz generation, quiz chat, semantic search, and related documents.

## Repository Layout

```text
.
+-- sks-backend/                 # NestJS API
|   +-- src/
|   |   +-- common/llm/           # MiMo text generation + Gemini embeddings
|   |   +-- database/             # TypeORM entities, migrations, repositories
|   |   +-- modules/
|   |       +-- authentication/   # Email verification, login, password reset, JWT guard
|   |       +-- document/         # Upload, document CRUD, file serving, notes
|   |       +-- folder/           # Folder hierarchy and document placement
|   |       +-- rag/              # Search, summary, Q&A, Study GPS, quiz
|   +-- uploads/                  # Local uploaded files, ignored by git
+-- sks-frontend/                # React + Vite client
|   +-- src/
|       +-- components/           # Reusable UI and workspace shell
|       +-- context/              # Document viewer session state
|       +-- pages/                # Workspace, viewer, Study GPS, quiz
|       +-- service/              # API wrappers used by UI
|       +-- services/             # Shared Axios client
+-- render.yaml                  # Render backend and frontend config
+-- README.md
```

## Current Features

- JWT authentication with email verification, login, profile, and password reset links.
- Upload `PDF`, `DOCX`, and `TXT` documents up to 10 MB.
- Local file storage, file preview/download, document rename/delete, and favorites.
- Automatic text extraction, chunking, background indexing, and embedding storage.
- SHA-256 content hash deduplication for repeated uploads.
- Nested folders with create, rename, move, delete, and document assignment.
- Semantic document search with pgvector and keyword fallback behavior.
- Related document suggestions.
- Document summaries with default and custom summary slots.
- Document Q&A with per-document ask history.
- SKS Note for per-document study notes.
- Study GPS: multi-document study roadmap by goal, level, days, hours, and language.
- Study GPS day chat with saved day-specific chat history.
- Quiz generation from selected documents with multiple-choice or true/false questions.
- Quiz review chat with persisted quiz chat history.

Removed feature:

- Mind map / diagram generation and UI are no longer present.

## Tech Stack

- **Frontend**: React 19, Vite 8, React Router 7, Axios, Tailwind CSS, React Markdown.
- **Backend**: NestJS 11, TypeScript, TypeORM, Passport JWT.
- **Database**: PostgreSQL with `pgcrypto` and `pgvector`.
- **Text generation LLM**: MiMo via `MIMO_API_KEY`, default model `mimo-v2.5-pro`.
- **Embeddings**: Google Gemini via `GEMINI_API_KEY`, default model `gemini-embedding-001`.
- **Document parsing**: `pdf-parse` for PDF, `mammoth` for DOCX, native UTF-8 parsing for TXT.
- **Testing**: Jest and Supertest.
- **Deployment config**: Render blueprint in `render.yaml`.

## System Overview

### Backend

The backend is a NestJS API served under the global `/api` prefix.

Core modules:

- `authentication`: email-based registration, password setup, login, password reset, profile, JWT authentication.
- `document`: upload, extracted text storage, file serving, favorites, search, notes, related documents.
- `folder`: per-user folder tree and document placement.
- `rag`: indexing, retrieval, summary, Q&A, Study GPS, quiz, and chat history.
- `common/llm`: provider boundary for text generation and embeddings.

### Frontend

The frontend is a React + Vite app. It uses:

- `react-router-dom` for routing.
- `axios` for API communication.
- `react-markdown` and `remark-gfm` for rendering AI responses.
- Tailwind CSS plus app-specific CSS for the workspace UI.

The API base URL is read from:

- `VITE_API_BASE_URL`
- fallback: `http://localhost:8000/api`

Important client routes:

- `/`
- `/login`
- `/register`
- `/complete-registration`
- `/forgot-password`
- `/reset-password`
- `/app`
- `/app/study-gps`
- `/app/quiz`
- `/app/favorites`
- `/app/documents/:documentId`

Protected app routes require a JWT token stored in browser `localStorage`.

## AI and RAG Pipeline

```text
Upload file
  -> Extract text
  -> Split into chunks
  -> Store document and chunks
  -> Generate Gemini embeddings
  -> Persist vectors in PostgreSQL pgvector
  -> Retrieve relevant chunks
  -> Use MiMo for grounded summaries, answers, quizzes, and study routes
```

Important implementation notes:

- Upload returns quickly after storing the document; AI indexing runs in the background.
- Search and AI features call `ensureDocumentIndexed` when they need indexed content.
- Text generation is injected through `LLM_GENERATION_SERVICE`, currently backed by `MimoGenerationService`.
- Gemini is currently used for embeddings only.
- Structured AI output is requested as raw JSON and repaired/validated where needed.
- Summary artifacts are cached in `user_documents.extra_attributes.aiArtifacts`.
- Study GPS and quiz chat histories are stored in dedicated tables.

## Data Model

Important tables created by migrations:

- `users`: application users, email verification token hashes, and password reset token hashes.
- `document`: canonical uploaded document metadata and source file reference.
- `chunks`: extracted text chunks with optional embedding vectors.
- `document_chunks`: many-to-many relation between documents and chunks.
- `user_documents`: per-user ownership, display name, favorites, folder link, notes, and AI artifact cache.
- `folder`: nested folder tree per owner.
- `document_ask_history`: document Q&A history.
- `study_gps_plans`: active Study GPS plan per user.
- `study_gps_day_chat_messages`: Study GPS day chat messages.
- `quiz_chat_history`: quiz review chat messages.

Database requirements:

- `pgcrypto` for UUID generation.
- `vector` from pgvector for embedding storage and similarity search.

## Prerequisites

- Node.js `20+` minimum, Node.js `22+` recommended.
- npm `10+`.
- PostgreSQL `15+` or `16+`.
- pgvector installed on the PostgreSQL server.
- Gemini API key for embeddings.
- MiMo API key for AI text generation.

## Quick Start for Grading

Run the backend and frontend in two separate terminals. The backend must start first because the frontend calls `http://localhost:8000/api` by default.

Before running these commands, create a PostgreSQL database named `sks` and make sure pgvector is available on that PostgreSQL server.

### 1. Install backend dependencies

```bash
cd sks-backend
npm install
```

### 2. Configure backend environment

```bash
copy .env.example .env
```

On macOS or Linux, use `cp .env.example .env`.

Required local values:

```env
PORT=8000
CORS_ORIGIN=http://localhost:3000
FRONTEND_URL=http://localhost:3000
UPLOADS_DIR=uploads

DATABASE_URL=
DATABASE_SSL=false
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=postgres
DATABASE_NAME=sks
DATABASE_SYNC=false
DATABASE_LOGGING=false

JWT_SECRET=change_me_before_production
JWT_EXPIRES_IN=1d

MAIL_PROVIDER=smtp
BREVO_API_KEY=
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your_email@example.com
SMTP_PASS=your_smtp_app_password
MAIL_FROM="SKS Smart Knowledge System <your_email@example.com>"

GEMINI_API_KEY=your_gemini_api_key
GEMINI_EMBEDDING_MODEL=gemini-embedding-001

MIMO_API_KEY=your_mimo_api_key
MIMO_BASE_URL=https://token-plan-sgp.xiaomimimo.com/v1
MIMO_MODEL=mimo-v2.5-pro
```

Do not commit real `.env` values. `DATABASE_SYNC` should stay `false` because the project uses migrations.

Registration and password reset send real email links. For local grading, configure one email provider:

- Gmail SMTP: set `MAIL_PROVIDER=smtp` and use a Gmail app password for `SMTP_PASS`.
- Brevo API: set `MAIL_PROVIDER=brevo` and `BREVO_API_KEY`.

On Render Free, use Brevo because outbound SMTP ports are blocked. If no email provider is configured, the app can start but users cannot receive registration completion or password reset links.

AI features require both `GEMINI_API_KEY` for embeddings and `MIMO_API_KEY` for text generation. Authentication, upload, folders, and document management can be checked first, but summary, Q&A, Study GPS, quiz, semantic search, and related documents need those keys.

### 3. Prepare PostgreSQL

Create a database named `sks`, then make sure the PostgreSQL server has pgvector installed. The migrations create the extensions if available:

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;
```

### 4. Run backend migrations

```bash
npm run migration:run
```

### 5. Start the backend

```bash
npm run start:dev
```

Backend URL:

- `http://localhost:8000/api`

### 6. Install frontend dependencies

```bash
cd ../sks-frontend
npm install
```

### 7. Configure frontend environment

Copy the frontend example file:

```bash
copy .env.example .env.local
```

The local value should be:

```env
VITE_API_BASE_URL=http://localhost:8000/api
```

On macOS or Linux, use `cp .env.example .env.local` instead of `copy`.

### 8. Start the frontend

```bash
npm run dev
```

Frontend URL:

- `http://localhost:3000`

## Local Workflow

After both services are running:

1. Open `http://localhost:3000`.
2. Register with your name and email, open the email verification link, set a password, then log in.
3. Upload a `PDF`, `DOCX`, or `TXT` document.
4. Wait for AI indexing if the document shows an indexing state.
5. Use workspace search, folders, favorites, and document actions.
6. Open a document and try summary, Ask AI, SKS Note, and related documents.
7. Generate Study GPS from selected documents.
8. Generate a Quiz from selected documents and use quiz review chat.

## API Overview

All backend routes use the `/api` prefix.

### Authentication

Base route: `/api/auth`

- `POST /register`
- `POST /complete-registration`
- `POST /forgot-password`
- `POST /reset-password`
- `POST /login`
- `GET /profile`
- `PATCH /profile`
- `PATCH /password`

### Documents

Base route: `/api/documents`

- `POST /upload`
- `GET /`
- `GET /favorites`
- `GET /search`
- `GET /:id`
- `GET /:id/file`
- `GET /:id/related`
- `GET /:documentId/note`
- `PATCH /:documentId/note`
- `DELETE /:documentId/note/:noteId`
- `PATCH /:documentId/update-name`
- `POST /:documentId/toggle-favorite`
- `DELETE /delete`

### Folders

Base route: `/api/folders`

- `GET /`
- `GET /:id`
- `POST /`
- `PATCH /update`
- `PATCH /move`
- `DELETE /delete`
- `POST /documents/add`
- `DELETE /documents/remove`
- `GET /:folderId/documents`

### RAG / AI

Base route: `/api/rag`

- `POST /documents/:documentId/ask`
- `GET /documents/:documentId/ask/history`
- `DELETE /documents/:documentId/ask/history`
- `POST /documents/:documentId/summary`
- `GET /study-gps`
- `POST /study-gps`
- `DELETE /study-gps`
- `GET /study-gps/day-chat/:day/history`
- `POST /study-gps/day-chat/start`
- `POST /study-gps/day-chat`
- `DELETE /study-gps/day-chat/:day/history`
- `POST /quiz/generate`
- `GET /quiz/chat/history`
- `POST /quiz/chat`
- `DELETE /quiz/chat/history`

### LLM Diagnostics

Base route: `/api/llm`

- `GET /test?prompt=...`
- `GET /test-embedding?text=...`

These are simple diagnostic endpoints for local/provider checks.

## Scripts

Backend scripts from `sks-backend/`:

```bash
npm run build
npm run start
npm run start:dev
npm run start:debug
npm run start:prod
npm run lint
npm run lint:fix
npm run test
npm run test:watch
npm run test:cov
npm run test:e2e
npm run migration:run
npm run migration:revert
npm run migration:show
```

Frontend scripts from `sks-frontend/`:

```bash
npm run dev
npm run build
npm run lint
npm run preview
```

Recommended validation before demo or submission:

```bash
cd sks-backend
npm run lint
npm run build
npm test -- --runInBand
npm run test:e2e -- --runInBand
```

```bash
cd sks-frontend
npm run lint
npm run build
```

## Storage and Persistence

- Uploaded files are stored locally under `sks-backend/uploads/` by default.
- JWT auth state is stored in browser `localStorage`.
- Document notes and AI summary artifacts are stored in `user_documents.extra_attributes`.
- Embeddings are stored in the `chunks.embedding` vector column.
- Ask history, Study GPS, Study GPS day chat, and quiz chat are stored in PostgreSQL tables.

Production deployments should use Cloudflare R2 for uploaded files by setting
`DOCUMENT_STORAGE_DRIVER=r2` and the required R2 credentials.

## Render Deployment

The repository includes `render.yaml` with:

- Backend web service: `sks-s2026-backend`.
- Static frontend service: `smartknowledge`.
- External Neon PostgreSQL database through `DATABASE_URL`.
- Backend pre-deploy migration command: `npm run migration:run`.
- Frontend SPA rewrite to `/index.html`.

Secrets marked `sync: false` in `render.yaml` must be configured in Render:

- `DATABASE_URL` from Neon
- `CLOUDFLARE_R2_ACCESS_KEY_ID`
- `CLOUDFLARE_R2_SECRET_ACCESS_KEY`
- `JWT_SECRET`
- `BREVO_API_KEY`
- `MAIL_FROM`
- `GEMINI_API_KEY`
- `MIMO_API_KEY`

Production checklist:

- Use a strong `JWT_SECRET`.
- Restrict `CORS_ORIGIN` to the deployed frontend URL.
- Keep `DATABASE_SSL=true` for Neon.
- Keep `DATABASE_SYNC=false`.
- Use `MAIL_PROVIDER=brevo` on Render Free so email is sent over HTTPS instead of blocked SMTP ports.
- Ensure `pgcrypto` and `pgvector` are available in the production database.
- Use Cloudflare R2 for uploaded file storage in production.
- Monitor Gemini embedding quota and MiMo generation quota.

## Troubleshooting

### Registration or password reset email does not arrive

Check:

- `MAIL_PROVIDER` matches the provider values you configured.
- For Gmail SMTP, `SMTP_USER`, `SMTP_PASS`, `SMTP_HOST`, `SMTP_PORT`, and `SMTP_SECURE` are set correctly.
- For Brevo, `BREVO_API_KEY` and `MAIL_FROM` are set correctly.
- `FRONTEND_URL=http://localhost:3000` locally, so email links point back to the frontend.

### AI generation fails

Check:

- `MIMO_API_KEY` is set.
- `MIMO_BASE_URL` and `MIMO_MODEL` are valid.
- The backend can reach the MiMo API.
- Provider quota has not been exhausted.

### Search or indexing fails

Check:

- `GEMINI_API_KEY` is set.
- `GEMINI_EMBEDDING_MODEL=gemini-embedding-001`.
- The document contains extractable text.
- Migrations created the `chunks.embedding` vector column.
- pgvector is installed on PostgreSQL.

### Migrations fail on `CREATE EXTENSION vector`

Install pgvector on the PostgreSQL server, then rerun:

```bash
cd sks-backend
npm run migration:run
```

### Frontend cannot call the backend

Check:

- Backend is running on port `8000`.
- Frontend is running on port `3000`.
- `CORS_ORIGIN=http://localhost:3000`.
- `VITE_API_BASE_URL=http://localhost:8000/api`.

### Upload works but AI features are not ready

Check:

- The document status is not still `indexing`.
- The file is under 10 MB and has extractable text.
- Gemini embedding calls are working.
- MiMo generation calls are working for summary, quiz, Study GPS, and Q&A.

## Optional Future Improvements

- Add a Docker Compose setup for backend, frontend, PostgreSQL, and pgvector.
- Add more end-to-end coverage for Study GPS and Quiz flows.

## License

No explicit root license file is currently documented. The backend package is marked `UNLICENSED`.
