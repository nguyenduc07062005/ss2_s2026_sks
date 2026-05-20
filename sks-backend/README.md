# SKS Backend

NestJS API for SKS Smart Knowledge System.

## Responsibilities

- JWT authentication with email verification and password reset links.
- Document upload, extraction, storage, download, rename, delete, favorites, and notes.
- Folder hierarchy and document placement.
- Background RAG indexing with Gemini embeddings and pgvector.
- Semantic search and related documents.
- AI generation through MiMo for summaries, document Q&A, Study GPS, and quizzes.
- Ask history, Study GPS day chat history, and quiz chat history.

Mind map and diagram generation are not part of the current backend routes.

## Main Modules

- `src/common/llm/`: `MimoGenerationService`, `GeminiService`, and the `LLM_GENERATION_SERVICE` provider.
- `src/database/`: TypeORM entities, migrations, repositories, and PostgreSQL configuration.
- `src/modules/authentication/`: register, email confirmation, login, password reset, profile updates, JWT guard.
- `src/modules/document/`: upload, document CRUD, file serving, notes.
- `src/modules/folder/`: folder tree and document movement.
- `src/modules/rag/`: indexing, retrieval, search, summary, Q&A, Study GPS, quiz.

## Environment

Copy the example file:

```bash
copy .env.example .env
```

On macOS or Linux, use `cp .env.example .env`.

Important values:

- `DATABASE_URL` or `DATABASE_HOST` / `DATABASE_PORT` / `DATABASE_USERNAME` / `DATABASE_PASSWORD` / `DATABASE_NAME`
- `DATABASE_SSL=true` when using Neon or another SSL-only managed PostgreSQL provider
- `DATABASE_SYNC=false`
- `JWT_SECRET`
- `FRONTEND_URL`
- `MAIL_PROVIDER=smtp` with `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`
- `MAIL_PROVIDER=brevo` with `BREVO_API_KEY`, `MAIL_FROM`
- `GEMINI_API_KEY`
- `GEMINI_EMBEDDING_MODEL=gemini-embedding-001`
- `MIMO_API_KEY`
- `MIMO_BASE_URL=https://token-plan-sgp.xiaomimimo.com/v1`
- `MIMO_MODEL=mimo-v2.5-pro`

Never commit real `.env` values.

For local Gmail SMTP, use an app password for `SMTP_PASS`, not your normal Gmail password. On Render Free, use `MAIL_PROVIDER=brevo` because SMTP ports are blocked.

Registration and password reset require a working email provider. If email is not configured, the backend can run but users cannot receive the setup or reset links.

## Local Commands

```bash
npm install
npm run migration:run
npm run start:dev
```

Validation:

```bash
npm run lint
npm run build
npm test -- --runInBand
npm run test:e2e -- --runInBand
```

Use `npm run lint:fix` only when you intentionally want ESLint to rewrite files.

## API Prefix

The global API prefix is `/api`.

Important route groups:

- `/api/auth`
- `/api/documents`
- `/api/folders`
- `/api/rag`
- `/api/llm`

See the root `README.md` for the full endpoint list and setup flow.
