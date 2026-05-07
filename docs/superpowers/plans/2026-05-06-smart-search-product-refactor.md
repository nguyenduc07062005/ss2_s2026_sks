# Smart Search Product Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework document search into a generic, product-grade smart search pipeline without document/topic-specific hardcoding.

**Architecture:** Separate query analysis, retrieval, ranking, and explanation generation. Retrieval must be deterministic and fast; LLM explanations are optional enrichment for already-ranked results and must never decide retrieval or block search reliability.

**Tech Stack:** NestJS 11, TypeScript, TypeORM, PostgreSQL, pgvector, Gemini embeddings, MiMo/Gemini text generation, React 19.

---

## Current Root Causes

1. `RagSearchService.classifySearchQuery()` uses domain-ish keyword rules such as `chapter`, `chuong`, `lecture`, `lesson`, `bai`, `phan`, and `module`. These are generic enough for school documents, but they are still a brittle classifier and do not generalize well to file names, arbitrary course codes, biology terms, Java classes, legal references, or Vietnamese natural language.

2. Lexical retrieval pulls all user documents and chunks into Node.js, then filters/ranks in memory. This can work for small accounts, but it is not product-grade for real users with many documents.

3. Ranking uses hard-coded weights like `title: 400`, `section: 300`, `content: 220`, `meaning: 100`. The intent is right, but the implementation is opaque and hard to calibrate.

4. LLM reason generation is inside the main search path. Even with timeout/fallback, it couples a reliable retrieval feature to an unreliable external provider.

5. Search response still exposes legacy/internal fields (`score`, `matchedConcepts`, `matchSnippet`, `evidenceSnippet`, `topics`) even though the UI now wants only `matchLabel` and `matchReason`.

6. Tests are currently too implementation-specific. They verify classifier branches and some sample queries, but they do not define a stable product contract such as “exact title match beats semantic match” or “short symbol query never calls embeddings.”

---

## Target Behavior

Search should behave like this:

- Exact filename/title/code/symbol/number query: lexical first, no embedding required.
- Short query: lexical first; semantic only if lexical is weak or empty and query has enough semantic content.
- Long natural-language concept query: semantic plus lexical, merged by ranking.
- Mixed query: hybrid.
- Title and filename matches must outrank weak semantic matches.
- LLM-generated reason should explain the final already-ranked match, not influence retrieval.
- UI should show only:
  - `Title match` / `Section match` / `Content match` / `Meaning match`
  - `Why this matches: <AI or fallback reason>`
- No document/topic-specific rules or tests.

---

## Files

- Modify: `sks-backend/src/modules/rag/services/rag-search.service.ts`
- Modify: `sks-backend/src/modules/rag/services/rag-search.service.spec.ts`
- Optional create: `sks-backend/src/modules/rag/services/rag-search-query-analyzer.service.ts`
- Optional create: `sks-backend/src/modules/rag/services/rag-search-explanation.service.ts`
- Optional create: `sks-backend/src/modules/rag/types/rag-search.types.ts`
- Modify: `sks-backend/src/modules/rag/rag.module.ts`
- Modify: `sks-frontend/src/pages/Dashboard.jsx`
- Modify: `sks-frontend/src/pages/dashboardUtils.js`

---

## Task 1: Define Generic Search Contract Tests

**Files:**
- Modify: `sks-backend/src/modules/rag/services/rag-search.service.spec.ts`

- [ ] Replace implementation-specific classifier tests with product contract tests:

```ts
it('does not call embeddings for exact file-name style queries', async () => {
  mockScopeResolution();
  jest
    .spyOn(service as unknown as RagSearchServiceInternals, 'getLexicalDocumentMatches')
    .mockResolvedValue([
      createSearchDocument({
        id: 'title-hit',
        matchType: 'title',
        matchLabel: 'Title match',
        score: 1,
      }),
    ]);

  const result = await service.searchDocuments('report-2026.pdf', 'user-1');

  expect(geminiService.createEmbedding).not.toHaveBeenCalled();
  expect(result.documents[0].matchLabel).toBe('Title match');
});
```

- [ ] Add ranking contract:

```ts
it('ranks title matches above stronger semantic scores', async () => {
  mockScopeResolution();
  jest
    .spyOn(service as unknown as RagSearchServiceInternals, 'getLexicalDocumentMatches')
    .mockResolvedValue([
      createSearchDocument({
        id: 'title-hit',
        matchType: 'title',
        matchLabel: 'Title match',
        score: 0.8,
      }),
    ]);
  jest
    .spyOn(service as unknown as RagSearchServiceInternals, 'getSemanticSearchDocuments')
    .mockResolvedValue([
      createSearchDocument({
        id: 'meaning-hit',
        matchType: 'meaning',
        matchLabel: 'Meaning match',
        score: 0.95,
      }),
    ]);

  const result = await service.searchDocuments('generic mixed query 2026', 'user-1');

  expect(result.documents.map((document) => document.id)).toEqual([
    'title-hit',
    'meaning-hit',
  ]);
});
```

- [ ] Add output contract:

```ts
it('returns user-facing match label and reason for search results', async () => {
  mockScopeResolution();
  generationService.generateText.mockResolvedValue(
    'This document matches because its title directly matches the search request.',
  );
  jest
    .spyOn(service as unknown as RagSearchServiceInternals, 'getLexicalDocumentMatches')
    .mockResolvedValue([
      createSearchDocument({
        matchType: 'title',
        matchLabel: 'Title match',
      }),
    ]);

  const result = await service.searchDocuments('report.pdf', 'user-1');

  expect(result.documents[0]).toEqual(
    expect.objectContaining({
      matchLabel: 'Title match',
      matchReason:
        'This document matches because its title directly matches the search request.',
    }),
  );
});
```

- [ ] Run:

```bash
cd sks-backend
npm test -- --runInBand rag-search.service.spec.ts
```

Expected: tests fail until implementation is adjusted.

---

## Task 2: Replace Keyword Classifier With Generic Query Analysis

**Files:**
- Modify: `sks-backend/src/modules/rag/services/rag-search.service.ts`
- Optional create: `sks-backend/src/modules/rag/types/rag-search.types.ts`

- [ ] Introduce a generic query analysis type:

```ts
type SearchQueryIntent = {
  mode: SearchQueryMode;
  normalizedQuery: string;
  tokens: string[];
  hasDigits: boolean;
  hasSymbols: boolean;
  looksLikeFileName: boolean;
  looksLikeExtension: boolean;
  isShort: boolean;
  semanticTokenCount: number;
};
```

- [ ] Replace `classifySearchQuery()` body with generic heuristics:

```ts
private analyzeSearchQuery(query: string): SearchQueryIntent {
  const normalizedQuery = normalizeComparisonText(query);
  const tokens = this.extractComparisonTokens(query);
  const semanticTokens = tokens.filter(
    (token) =>
      token.length >= 3 &&
      !CONTEXT_SEARCH_STOPWORDS.has(token) &&
      !SEARCH_CONCEPT_GENERIC_WORDS.has(token),
  );
  const hasDigits = /\d/.test(query);
  const hasSymbols = /[._/#:[\](){}-]/.test(query);
  const looksLikeFileName = /[\p{L}\p{N}_ -]+\.[a-z0-9]{2,6}$/iu.test(query.trim());
  const looksLikeExtension = /^\.[a-z0-9]{2,6}$/i.test(query.trim()) ||
    /^[a-z0-9]{2,6}$/i.test(query.trim());
  const isShort = tokens.length <= 2 || normalizedQuery.length <= 4;

  let mode: SearchQueryMode = 'hybrid';

  if (!normalizedQuery || looksLikeFileName || hasSymbols || hasDigits || isShort) {
    mode = 'lexical';
  } else if (semanticTokens.length >= 5) {
    mode = 'semantic';
  }

  return {
    mode,
    normalizedQuery,
    tokens,
    hasDigits,
    hasSymbols,
    looksLikeFileName,
    looksLikeExtension,
    isShort,
    semanticTokenCount: semanticTokens.length,
  };
}
```

- [ ] Update `searchDocuments()` to call `analyzeSearchQuery()` and use `intent.mode`.

- [ ] Remove keyword title-like regex:

```ts
/\b(?:chapter|chuong|lecture|lesson|bai|phan|module)\b/i
```

- [ ] Run search tests.

---

## Task 3: Move Lexical Retrieval Into Database

**Files:**
- Modify: `sks-backend/src/modules/rag/services/rag-search.service.ts`

- [ ] Replace full-scan lexical raw query with a query that filters in SQL first.

Use `ILIKE` and normalized token conditions initially, without schema changes:

```sql
WHERE ud.user_id = $1
  AND (
    COALESCE(ud.document_name, d.title, '') ILIKE $2
    OR COALESCE(d.file_ref, '') ILIKE $2
    OR COALESCE(c.section_title, '') ILIKE $2
    OR COALESCE(c.chunk_text, '') ILIKE $2
  )
```

- [ ] Keep generic token fallback for multi-token query:

```ts
const likeParams = intent.tokens.slice(0, 6).map((token) => `%${token}%`);
```

- [ ] Rank candidates by source priority:
  - title/file exact
  - title/file contains
  - section contains
  - content contains

- [ ] Keep final result shape unchanged.

- [ ] Add a test that lexical retrieval does not return unrelated documents when query has no lexical overlap.

---

## Task 4: Make Ranking Explainable and Calibrated

**Files:**
- Modify: `sks-backend/src/modules/rag/services/rag-search.service.ts`

- [ ] Replace `400/300/220/100` with named constants:

```ts
const SEARCH_RANK_WEIGHTS: Record<SearchMatchType, number> = {
  title: 1_000,
  section: 700,
  content: 500,
  meaning: 300,
};
```

- [ ] Add tie-breakers:
  - higher lexical confidence
  - higher semantic score
  - newer document only as final tie-breaker

- [ ] Add tests:
  - exact title beats partial title
  - title beats semantic
  - section beats content
  - content beats weak meaning

---

## Task 5: Decouple LLM Explanation From Search Reliability

**Files:**
- Optional create: `sks-backend/src/modules/rag/services/rag-search-explanation.service.ts`
- Modify: `sks-backend/src/modules/rag/services/rag-search.service.ts`
- Modify: `sks-backend/src/modules/rag/rag.module.ts`

- [ ] Move `generateAiMatchReason()`, prompt building, cleanup, timeout, and concurrency helpers into `RagSearchExplanationService`.

- [ ] Keep fallback reason deterministic and generic:

```ts
private buildFallbackReason(document: SearchResultDocument): string {
  if (document.matchType === 'title') {
    return 'The document title or file name is the closest match for this search.';
  }
  if (document.matchType === 'section') {
    return 'A section in this document matches the search request.';
  }
  if (document.matchType === 'content') {
    return 'The document content contains information related to the search request.';
  }
  return 'The document discusses ideas that are meaningfully related to the search request.';
}
```

- [ ] Do not include raw snippets in the response unless explicitly needed by a future UI.

- [ ] Add tests:
  - LLM failure does not fail search
  - LLM timeout does not fail search
  - generated reason cannot mention technical internals

---

## Task 6: Simplify Public Search Response

**Files:**
- Modify: `sks-backend/src/modules/rag/services/rag-search.service.ts`
- Modify: `sks-frontend/src/pages/dashboardUtils.js`
- Modify: `sks-frontend/src/pages/Dashboard.jsx`

- [ ] Keep backward-compatible fields temporarily, but mark internal fields as nullable and stop frontend use.

- [ ] Frontend should only use:

```js
document.matchLabel
document.matchReason
```

- [ ] Remove frontend helpers that infer topics/snippets/relevance from legacy fields.

- [ ] Add a backend test asserting no technical label is returned in `matchLabel`.

---

## Task 7: Verification

- [ ] Run backend unit tests:

```bash
cd sks-backend
npm test -- --runInBand rag-search.service.spec.ts
```

- [ ] Run full backend validation:

```bash
cd sks-backend
npm run lint
npm run build
npm test -- --runInBand
```

- [ ] Run frontend validation:

```bash
cd sks-frontend
npm run lint
npm run build
```

- [ ] Manual checks in UI:
  - Search exact file name.
  - Search short number/code.
  - Search Vietnamese with accents.
  - Search Vietnamese without accents.
  - Search long English concept.
  - Search query with punctuation or extension.

Expected UI: only match label and `Why this matches` reason are shown.

---

## Execution Recommendation

Implement this in small commits:

1. Query analysis tests and classifier cleanup.
2. SQL lexical retrieval.
3. Ranking constants and tie-breakers.
4. Explanation service split.
5. Response/UI cleanup.

