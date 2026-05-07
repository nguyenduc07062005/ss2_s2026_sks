# SKS Frontend

React + Vite client for SKS Smart Knowledge System.

## Responsibilities

- Authentication screens.
- Protected workspace shell.
- Document dashboard with folders, favorites, search, upload, rename, move, delete, download, and recent documents.
- Document viewer with PDF/TXT preview, DOCX HTML rendering, summary, Ask AI, SKS Note, and related documents.
- Study GPS route generation and day chat.
- Quiz generation, answering flow, result review, and quiz chat.

Mind map UI has been removed from the current frontend.

## Main Files

- `src/Layout.jsx`: route definitions.
- `src/components/workspace/WorkspaceShell.jsx`: protected app layout and navigation.
- `src/pages/Dashboard.jsx`: workspace dashboard.
- `src/pages/DocumentViewer.jsx`: file preview and document AI sidebar.
- `src/pages/StudyGPS.jsx`: Study GPS route and day chat UI.
- `src/pages/Quiz.jsx`: quiz generation and review UI.
- `src/service/`: API wrappers.
- `src/services/apiClient.js`: shared Axios client.

## Environment

The API base URL is read from `VITE_API_BASE_URL`.

Local override:

```env
VITE_API_BASE_URL=http://localhost:8000/api
```

If omitted, the frontend falls back to `http://localhost:8000/api`.

## Local Commands

```bash
npm install
npm run dev
```

Validation:

```bash
npm run lint
npm run build
```

Default dev URL:

- `http://localhost:3000`

See the root `README.md` for full project setup and backend requirements.
