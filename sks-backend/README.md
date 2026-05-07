# SKS Backend

NestJS API for SKS Smart Knowledge System.

## Responsibilities

- JWT authentication.
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
- `src/modules/authentication/`: register, login, profile, JWT guard.
- `src/modules/document/`: upload, document CRUD, file serving, notes.
- `src/modules/folder/`: folder tree and document movement.
- `src/modules/rag/`: indexing, retrieval, search, summary, Q&A, Study GPS, quiz.

## Environment

Copy the example file:

```bash
copy .env.example .env
```

Important values:

- `DATABASE_URL` or `DATABASE_HOST` / `DATABASE_PORT` / `DATABASE_USERNAME` / `DATABASE_PASSWORD` / `DATABASE_NAME`
- `DATABASE_SYNC=false`
- `JWT_SECRET`
- `GEMINI_API_KEY`
- `GEMINI_EMBEDDING_MODEL=gemini-embedding-001`
- `MIMO_API_KEY`
- `MIMO_BASE_URL=https://api.xiaomimimo.com/v1`
- `MIMO_MODEL=mimo-v2.5-pro`

Never commit real `.env` values.

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

## API Prefix

The global API prefix is `/api`.

Important route groups:

- `/api/auth`
- `/api/documents`
- `/api/folders`
- `/api/rag`
- `/api/llm`

See the root `README.md` for the full endpoint list and setup flow.
