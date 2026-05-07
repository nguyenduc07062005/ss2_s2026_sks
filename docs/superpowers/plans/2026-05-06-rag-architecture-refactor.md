# RAG Architecture Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor SKS RAG features so Summary, Mind Map, Q&A, and Study GPS share cache keys, context construction, generation policy, and validation while preserving public routes.

**Architecture:** Move ownership/indexing, context building, artifact cache keys, and generation validation into shared services. Feature services should declare artifact intent, schema, prompt, validator, and response mapping, not reimplement cache/context/generation flow.

**Tech Stack:** NestJS 11, TypeScript, TypeORM, PostgreSQL jsonb extraAttributes, Gemini/LangChain structured generation, Jest.

---

## Current Evidence

- `sks-backend/src/modules/rag/services/rag-artifact-cache.service.ts` stores summary and mind map by `language -> default/custom`, not by content hash and instruction hash.
- `sks-backend/src/modules/rag/services/rag-summary.service.ts` selects cached summaries by slot and does not compare the requested instruction with the cached instruction.
- `sks-backend/src/modules/rag/services/rag-mind-map.service.ts` has a partial split into context/tree/validation services, but the main service still owns cache, indexing, context selection, primary generation, repair, fallback, sanitization, persistence, and response mapping.
- `sks-backend/src/modules/rag/services/rag-mind-map-tree.service.ts` can synthesize missing `studyNote` values during tree construction, so missing AI study notes can be masked.
- `sks-backend/src/modules/rag/services/rag-question-answering.service.ts` uses one prompt that allows general knowledge in a document workspace and has no mode in `AskRagDto`.
- `sks-backend/src/modules/rag/services/rag-study-gps.service.ts` builds plans from representative excerpts and falls back to generic deterministic study tasks.
- Targeted test run failed on `rag-mind-map.service.spec.ts`: 8 failed, 18 passed in the selected RAG suite. The failures show current tests and mocks no longer match the stricter study-note validation and fallback behavior.

## File Structure

- Create `sks-backend/src/modules/rag/utils/rag-artifact-key.util.ts`: deterministic cache-key builder and instruction hash.
- Create `sks-backend/src/modules/rag/utils/rag-artifact-key.util.spec.ts`: cache-key behavior tests.
- Modify `sks-backend/src/modules/rag/types/rag.types.ts`: add shared artifact key/cache/request/mode types without changing DB schema.
- Modify `sks-backend/src/modules/rag/services/rag-artifact-cache.service.ts`: add generic key-based read/write while keeping legacy `summaryByLanguage` and `mindMapByLanguage` read compatibility.
- Create `sks-backend/src/modules/rag/services/rag-context-builder.service.ts`: purpose-specific context builder.
- Create `sks-backend/src/modules/rag/services/rag-context-builder.service.spec.ts`: context builder behavior tests.
- Modify `sks-backend/src/modules/rag/services/rag-structured-generation.service.ts`: centralize structured-generation policy instead of feature-level ad hoc skips.
- Modify `sks-backend/src/modules/rag/services/rag-summary.service.ts`: use shared cache key and summary context.
- Modify `sks-backend/src/modules/rag/services/rag-mind-map.service.ts`: use shared cache key/context and remove source-driven saved fallback.
- Modify `sks-backend/src/modules/rag/services/rag-mind-map-tree.service.ts`: stop masking missing AI study notes before validation.
- Modify `sks-backend/src/modules/rag/services/rag-question-answering.service.ts`: add Q&A modes and prompt selection.
- Modify `sks-backend/src/modules/rag/dtos/ask-rag.dto.ts`: add optional mode.
- Modify `sks-backend/src/modules/rag/services/rag-study-gps.service.ts`: use learning structure context and fail clearly when generation quality is too low.
- Modify `sks-backend/src/modules/rag/rag.module.ts`: register `RagContextBuilderService`.
- Modify RAG service specs to test behavior with neutral fixtures.

---

### Task 1: Add Artifact Cache Key Utility

**Files:**

- Create: `sks-backend/src/modules/rag/utils/rag-artifact-key.util.ts`
- Create: `sks-backend/src/modules/rag/utils/rag-artifact-key.util.spec.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import {
  buildArtifactCacheKey,
  hashArtifactInstruction,
} from "./rag-artifact-key.util";

describe("rag artifact cache key", () => {
  it("changes when instruction changes", () => {
    const base = {
      artifactType: "summary" as const,
      documentId: "doc-1",
      contentHash: "content-hash-1",
      language: "en" as const,
      mode: "custom",
      artifactVersion: 3,
    };

    expect(
      buildArtifactCacheKey({ ...base, instruction: "Focus on causes." }).key,
    ).not.toBe(
      buildArtifactCacheKey({ ...base, instruction: "Focus on effects." }).key,
    );
  });

  it("uses a stable empty instruction hash for default artifacts", () => {
    expect(hashArtifactInstruction(null)).toBe(hashArtifactInstruction(""));
    expect(hashArtifactInstruction("   ")).toBe(hashArtifactInstruction(null));
  });

  it("changes when content hash or artifact version changes", () => {
    const base = {
      artifactType: "mind_map" as const,
      documentId: "doc-1",
      contentHash: "content-hash-1",
      language: "vi" as const,
      mode: "default",
      instruction: null,
      artifactVersion: 18,
    };

    expect(buildArtifactCacheKey(base).key).not.toBe(
      buildArtifactCacheKey({ ...base, contentHash: "content-hash-2" }).key,
    );
    expect(buildArtifactCacheKey(base).key).not.toBe(
      buildArtifactCacheKey({ ...base, artifactVersion: 19 }).key,
    );
  });
});
```

- [ ] **Step 2: Run the new failing test**

Run:

```bash
cd sks-backend
npm test -- --runInBand rag-artifact-key.util.spec.ts
```

Expected: FAIL because `rag-artifact-key.util.ts` does not exist.

- [ ] **Step 3: Implement the utility**

```ts
import { createHash } from "crypto";
import { SummaryLanguage } from "../types/rag.types";

export type RagArtifactType = "summary" | "mind_map" | "study_gps";

export type RagArtifactMode =
  | "default"
  | "custom"
  | "document_strict"
  | "document_assisted"
  | "general_chat";

export type RagArtifactCacheKeyInput = {
  artifactType: RagArtifactType;
  documentId: string;
  contentHash: string | null | undefined;
  language: SummaryLanguage;
  mode: RagArtifactMode;
  instruction?: string | null;
  artifactVersion: number;
  extra?: Record<string, string | number | boolean | null | undefined>;
};

export type RagArtifactCacheKey = {
  artifactType: RagArtifactType;
  documentId: string;
  contentHash: string;
  language: SummaryLanguage;
  mode: RagArtifactMode;
  instructionHash: string;
  artifactVersion: number;
  key: string;
};

export function hashArtifactInstruction(instruction?: string | null): string {
  const normalizedInstruction = (instruction ?? "")
    .replace(/\r\n/g, "\n")
    .trim();
  return createHash("sha256").update(normalizedInstruction).digest("hex");
}

export function buildArtifactCacheKey(
  input: RagArtifactCacheKeyInput,
): RagArtifactCacheKey {
  const contentHash =
    input.contentHash?.trim() || `document:${input.documentId}`;
  const instructionHash = hashArtifactInstruction(input.instruction);
  const stableExtra = stableStringify(input.extra ?? {});
  const keyPayload = [
    input.artifactType,
    input.documentId,
    contentHash,
    input.language,
    input.mode,
    instructionHash,
    String(input.artifactVersion),
    stableExtra,
  ].join("|");

  return {
    artifactType: input.artifactType,
    documentId: input.documentId,
    contentHash,
    language: input.language,
    mode: input.mode,
    instructionHash,
    artifactVersion: input.artifactVersion,
    key: createHash("sha256").update(keyPayload).digest("hex"),
  };
}

function stableStringify(value: Record<string, unknown>): string {
  return JSON.stringify(
    Object.keys(value)
      .sort()
      .reduce<Record<string, unknown>>((accumulator, key) => {
        accumulator[key] = value[key];
        return accumulator;
      }, {}),
  );
}
```

- [ ] **Step 4: Verify**

Run:

```bash
cd sks-backend
npm test -- --runInBand rag-artifact-key.util.spec.ts
```

Expected: PASS.

---

### Task 2: Add Keyed Artifact Cache Shape

**Files:**

- Modify: `sks-backend/src/modules/rag/types/rag.types.ts`
- Modify: `sks-backend/src/modules/rag/services/rag-artifact-cache.service.ts`
- Modify: `sks-backend/src/modules/rag/services/rag-artifact-cache.service.spec.ts`

- [ ] **Step 1: Extend cache types**

Add these types to `rag.types.ts` near `DocumentArtifactCache`:

```ts
export type StoredRagArtifact<TPayload = unknown> = {
  key: string;
  artifactType: "summary" | "mind_map" | "study_gps";
  language: SummaryLanguage;
  mode: string;
  documentId: string;
  contentHash: string;
  instructionHash: string;
  artifactVersion: number;
  generatedAt: string;
  payload: TPayload;
};

export type DocumentArtifactCache = {
  artifactsByKey?: Record<string, StoredRagArtifact>;
  activeArtifactKeys?: Record<string, string>;
  summary?: {
    text: string;
    sources: RagSource[];
    generatedAt: string;
  };
  summaryByLanguage?: Partial<
    Record<SummaryLanguage, SummaryLanguageCache | SummaryArtifact>
  >;
  mindMapByLanguage?: Partial<
    Record<SummaryLanguage, MindMapLanguageCache | MindMapArtifact>
  >;
};
```

- [ ] **Step 2: Add cache service tests**

Add tests proving:

```ts
it("stores and reads a keyed artifact without dropping legacy summary state", async () => {
  const userDocument = {
    id: "user-doc-1",
    extraAttributes: {
      aiArtifacts: {
        summaryByLanguage: {
          en: {
            activeSlot: "default",
            versions: {
              default: {
                title: "Legacy summary",
                overview: "Legacy overview.",
                key_points: ["Legacy point"],
                conclusion: "Legacy conclusion.",
                language: "en",
                generatedAt: "2026-05-06T00:00:00.000Z",
                sources: [],
                slot: "default",
              },
            },
          },
        },
      },
    },
  };

  await service.writeArtifact(userDocument as never, {
    activeSelector: "summary:en:custom",
    artifact: {
      key: "cache-key-1",
      artifactType: "summary",
      language: "en",
      mode: "custom",
      documentId: "doc-1",
      contentHash: "hash-1",
      instructionHash: "instruction-hash-1",
      artifactVersion: 3,
      generatedAt: "2026-05-06T01:00:00.000Z",
      payload: { title: "Custom summary" },
    },
  });

  const payload = updateUserDocument.mock.calls[0]?.[1] as Record<string, any>;
  expect(
    payload.extraAttributes.aiArtifacts.summaryByLanguage.en,
  ).toBeDefined();
  expect(
    payload.extraAttributes.aiArtifacts.artifactsByKey["cache-key-1"],
  ).toBeDefined();
  expect(
    payload.extraAttributes.aiArtifacts.activeArtifactKeys["summary:en:custom"],
  ).toBe("cache-key-1");
});
```

- [ ] **Step 3: Add generic cache methods**

Add public methods to `RagArtifactCacheService`:

```ts
readArtifact<TPayload>(
  owner: Pick<UserDocument, 'extraAttributes'>,
  key: string,
): StoredRagArtifact<TPayload> | null {
  const artifact = this.getArtifactCache(owner).artifactsByKey?.[key];
  return artifact ? (artifact as StoredRagArtifact<TPayload>) : null;
}

async writeArtifact<TPayload>(
  userDocument: UserDocument,
  input: {
    activeSelector: string;
    artifact: StoredRagArtifact<TPayload>;
  },
): Promise<void> {
  const currentArtifacts = this.getArtifactCache(userDocument);
  await this.saveUserDocumentArtifactCache(userDocument, {
    artifactsByKey: {
      ...(currentArtifacts.artifactsByKey ?? {}),
      [input.artifact.key]: input.artifact,
    },
    activeArtifactKeys: {
      ...(currentArtifacts.activeArtifactKeys ?? {}),
      [input.activeSelector]: input.artifact.key,
    },
  });
}
```

- [ ] **Step 4: Preserve merge behavior**

Update `buildNextExtraAttributes()` so `artifactsByKey` and `activeArtifactKeys` are deep-merged like `summaryByLanguage` and `mindMapByLanguage`.

- [ ] **Step 5: Verify**

Run:

```bash
cd sks-backend
npm test -- --runInBand rag-artifact-cache.service.spec.ts rag-artifact-key.util.spec.ts
```

Expected: PASS.

---

### Task 3: Create Purpose-Specific Context Builder

**Files:**

- Create: `sks-backend/src/modules/rag/services/rag-context-builder.service.ts`
- Create: `sks-backend/src/modules/rag/services/rag-context-builder.service.spec.ts`
- Modify: `sks-backend/src/modules/rag/rag.module.ts`

- [ ] **Step 1: Define shared context result types**

Use this shape in the new service:

```ts
export type RagBuiltContext<
  TMeta extends Record<string, unknown> = Record<string, unknown>,
> = {
  text: string;
  chunks: RepresentativeChunk[];
  meta: TMeta;
};

export type MindMapContextMeta = {
  sourceWordCount: number;
  meaningfulChunkCount: number;
  minTopLevelBranches: number;
  minTotalNodes: number;
  requireNestedNode: boolean;
};

export type StudyGpsLearningStructure = {
  documents: Array<{
    id: string;
    title: string;
    sections: string[];
    concepts: string[];
  }>;
};
```

- [ ] **Step 2: Implement builder methods**

Create methods with these signatures:

```ts
async buildSummaryContext(documentId: string): Promise<RagBuiltContext>;

async buildMindMapContext(
  documentId: string,
  instruction?: string | null,
): Promise<RagBuiltContext<MindMapContextMeta>>;

async buildStudyGpsContext(
  documents: Array<{ id: string; title: string }>,
): Promise<RagBuiltContext<{ learningStructure: StudyGpsLearningStructure }>>;

async buildQaContext(input: {
  ownerId: string;
  question: string;
  documentId?: string;
  documentIds?: string[];
  limit?: number;
}): Promise<RagBuiltContext<{ evidenceQuality: 'none' | 'weak' | 'usable' }>>;
```

- [ ] **Step 3: Move context policy out of feature services**

The new service should call `RagDocumentContextService` for low-level chunk loading and formatting. It should own use-case choices:

```ts
const SUMMARY_MAX_CHUNKS = 18;
const MIND_MAP_MAX_CHUNKS = 60;
const STUDY_GPS_MAX_CHUNKS_PER_DOCUMENT = 10;

// Summary: representative context.
// Mind map: headings, section starts, outline scaffold, evidence excerpts, instruction-relevant chunks.
// Study GPS: learning structure first, excerpts second.
// QA: semantic retrieval plus evidence quality metadata.
```

- [ ] **Step 4: Register the provider**

Add `RagContextBuilderService` to `rag.module.ts` providers.

- [ ] **Step 5: Verify**

Run:

```bash
cd sks-backend
npm test -- --runInBand rag-context-builder.service.spec.ts
```

Expected: PASS.

---

### Task 4: Centralize Structured Generation Policy

**Files:**

- Modify: `sks-backend/src/modules/rag/services/rag-structured-generation.service.ts`
- Modify: `sks-backend/src/modules/rag/services/rag-summary.service.spec.ts`

- [ ] **Step 1: Replace feature-level booleans with policy**

Change the options type:

```ts
type StructuredGenerationPolicy =
  | "schema_first"
  | "function_first"
  | "raw_json_only";

type StructuredGenerationOptions<TResult> = {
  input: Record<string, string>;
  prompt: PromptTemplate;
  fallbackPrompt: PromptTemplate;
  outputSchema: object;
  schemaName: string;
  operationLabel: string;
  policy?: StructuredGenerationPolicy;
  modelOptions?: StructuredModelOptions;
  coerce: (value: unknown) => TResult | null;
  parseRawResponse: (rawResponse: string) => TResult;
  logger?: LoggerService;
};
```

- [ ] **Step 2: Implement policy execution**

Map policy to attempts:

```ts
const policy = options.policy ?? "schema_first";
const attempts =
  policy === "raw_json_only"
    ? ["raw_json"]
    : policy === "function_first"
      ? ["function_calling", "json_schema", "raw_json"]
      : ["json_schema", "function_calling", "raw_json"];
```

- [ ] **Step 3: Update Summary**

In `RagSummaryService.generateStructuredSummary()`, replace:

```ts
skipJsonSchema: true,
skipFunctionCalling: true,
```

with:

```ts
policy: 'raw_json_only',
```

- [ ] **Step 4: Update tests**

Replace the assertion for `skipJsonSchema` and `skipFunctionCalling` with:

```ts
expect(ragStructuredGenerationService.generate).toHaveBeenCalledWith(
  expect.objectContaining({
    policy: "raw_json_only",
  }),
);
```

- [ ] **Step 5: Verify**

Run:

```bash
cd sks-backend
npm test -- --runInBand rag-summary.service.spec.ts
```

Expected: PASS.

---

### Task 5: Refactor Summary to Keyed Artifact Cache

**Files:**

- Modify: `sks-backend/src/modules/rag/services/rag-summary.service.ts`
- Modify: `sks-backend/src/modules/rag/services/rag-summary.service.spec.ts`

- [ ] **Step 1: Add a failing test for changed custom instruction**

Add a summary test equivalent to the current mind-map instruction test:

```ts
it("does not reuse a custom summary when the instruction changes", async () => {
  const cachedSummaryState = {
    activeSlot: "custom" as const,
    versions: {
      custom: {
        title: "Old custom summary",
        overview: richOverview,
        key_points: richKeyPoints,
        conclusion: richConclusion,
        language: "en" as const,
        generatedAt: "2026-05-06T00:00:00.000Z",
        sources: [],
        slot: "custom" as const,
        instruction: "Focus on chapter one.",
      },
    },
  };

  ragArtifactCacheService.getSummaryState.mockReturnValueOnce(
    cachedSummaryState,
  );
  await service.generateSummary(
    "doc-1",
    "user-1",
    "en",
    false,
    "Focus on chapter two.",
  );

  expect(ragIndexingService.ensureDocumentIndexed).toHaveBeenCalledWith(
    "doc-1",
  );
  expect(ragArtifactCacheService.saveSummary).toHaveBeenCalled();
});
```

- [ ] **Step 2: Build cache key before cache lookup**

Use:

```ts
const cacheKey = buildArtifactCacheKey({
  artifactType: "summary",
  documentId,
  contentHash: document.contentHash,
  language,
  mode: requestedInstruction ? "custom" : "default",
  instruction: requestedInstruction,
  artifactVersion: SUMMARY_ARTIFACT_VERSION,
});
```

- [ ] **Step 3: Prefer keyed artifact cache**

Read `ragArtifactCacheService.readArtifact<SummaryArtifact>(userDocument, cacheKey.key)`. Use legacy `getSummaryState()` only as a compatibility fallback for old artifacts.

- [ ] **Step 4: Write both keyed artifact and legacy response state during transition**

After generating a summary, call `writeArtifact()` and keep `saveSummary()` for response compatibility until frontend no longer needs `versions`.

- [ ] **Step 5: Verify**

Run:

```bash
cd sks-backend
npm test -- --runInBand rag-summary.service.spec.ts rag-artifact-cache.service.spec.ts
```

Expected: PASS.

---

### Task 6: Refactor Mind Map Generation Contract

**Files:**

- Modify: `sks-backend/src/modules/rag/services/rag-mind-map.service.ts`
- Modify: `sks-backend/src/modules/rag/services/rag-mind-map-tree.service.ts`
- Modify: `sks-backend/src/modules/rag/services/rag-mind-map.service.spec.ts`

- [x] **Step 1: Add failing tests for no saved fallback**

Add tests proving that when primary and repair both fail quality, service throws and does not save:

```ts
it("does not save a source-driven fallback when primary and repair fail quality", async () => {
  ragStructuredGenerationService.generate
    .mockResolvedValueOnce({
      title: "Weak map",
      summary: "Weak summary",
      branches: [{ label: "Topic", summary: "Weak", children: [] }],
    })
    .mockResolvedValueOnce({
      title: "Still weak",
      summary: "Still weak",
      branches: [{ label: "Topic", summary: "Weak", children: [] }],
    });

  ragMindMapValidationService.describeMindMapAcceptanceIssues.mockReturnValue(
    "The draft is too shallow.",
  );

  await expect(
    service.getDocumentMindMap("doc-1", "user-1", "en", true),
  ).rejects.toThrow(
    "Mind map generation could not produce a reliable structure",
  );

  expect(ragArtifactCacheService.saveMindMap).not.toHaveBeenCalled();
});
```

- [x] **Step 2: Stop masking missing study notes**

In `RagMindMapTreeService.buildMindMapTreeNode()`, remove the automatic fallback:

```ts
const studyNote = node.studyNote
  ? this.normalizeMindMapNodeStudyNoteDraft(
      node.studyNote,
      label,
      summary,
      language,
    )
  : null;
```

Return `studyNote` only when present. Validation must happen before saving.

- [x] **Step 3: Remove saved source-driven fallback from main mind-map flow**

Replace the catch block after repair failure with:

```ts
throw new ServiceUnavailableException(
  "Mind map generation could not produce a reliable structure from this document. Please regenerate or use a more specific instruction.",
);
```

Do not call `buildSourceDrivenMindMapDraft()` in the artifact generation path.

- [x] **Step 4: Use keyed cache**

Use `buildArtifactCacheKey()` with `artifactType: 'mind_map'`, document content hash, language, mode, instruction, and `MIND_MAP_ARTIFACT_VERSION`.

- [x] **Step 5: Update neutral fixtures**

Replace subject-specific labels such as Vietnamese economic integration examples with neutral fixture labels:

```ts
label: 'Selected concept',
summary: 'The selected concept is explained through causes and effects.',
pathLabels: ['Parent topic', 'Selected concept'],
siblingLabels: ['Related concept'],
```

- [x] **Step 6: Verify**

Run:

```bash
cd sks-backend
npm test -- --runInBand rag-mind-map.service.spec.ts
```

Expected: PASS.

---

### Task 7: Add Q&A Modes

**Files:**

- Modify: `sks-backend/src/modules/rag/dtos/ask-rag.dto.ts`
- Modify: `sks-backend/src/modules/rag/services/rag-question-answering.service.ts`
- Modify: `sks-backend/src/modules/rag/rag.service.ts`
- Modify: `sks-backend/src/modules/rag/rag.controller.ts`
- Modify: `sks-backend/src/modules/rag/services/rag-question-answering.service.spec.ts`

- [x] **Step 1: Add DTO mode**

```ts
import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

export const RAG_ASK_MODES = [
  "document_strict",
  "document_assisted",
  "general_chat",
] as const;

export type RagAskMode = (typeof RAG_ASK_MODES)[number];

export class AskRagDto {
  @IsString()
  @MinLength(2)
  @MaxLength(1000)
  question: string;

  @IsOptional()
  @IsIn([...RAG_ASK_MODES])
  mode?: RagAskMode;
}
```

- [x] **Step 2: Preserve route while adding optional behavior**

Pass `dto.mode ?? 'document_strict'` through controller and service. This changes default behavior toward document-grounded answers, so update frontend only if it relied on general chat behavior inside document ask.

- [x] **Step 3: Split prompts**

Use three prompt templates:

```ts
const DOCUMENT_STRICT_PROMPT = [
  "You are an academic assistant inside a document workspace.",
  "Answer using ONLY the provided document context.",
  "If the context does not contain enough evidence, say that the document context is not sufficient.",
  "Do not use outside knowledge.",
].join("\n");

const DOCUMENT_ASSISTED_PROMPT = [
  "Use the document context first.",
  "You may add general knowledge only after clearly separating it from document-grounded facts.",
].join("\n");

const GENERAL_CHAT_PROMPT = [
  "Answer as a general assistant. Document context is not required.",
].join("\n");
```

- [x] **Step 4: Enforce evidence quality**

If mode is `document_strict` and retrieved chunks are empty or weak, return an answer with sources `[]` and do not call Gemini with general knowledge.

- [x] **Step 5: Verify**

Run:

```bash
cd sks-backend
npm test -- --runInBand rag-question-answering.service.spec.ts
```

Expected: PASS.

---

### Task 8: Refactor Study GPS Around Learning Structure

**Files:**

- Modify: `sks-backend/src/modules/rag/services/rag-study-gps.service.ts`
- Modify: `sks-backend/src/modules/rag/services/rag-study-gps.service.spec.ts` if missing, create it.

- [x] **Step 1: Add behavior tests**

Test that generated plan:

```ts
expect(result.plan.dailyRoute).toHaveLength(dto.daysLeft);
expect(result.plan.dailyRoute[0].tasks.join(" ")).not.toMatch(
  /chunk|excerpt|reference/i,
);
expect(result.plan.dailyRoute[0].tasks.join(" ")).toMatch(
  /concept|cause|effect|definition|workflow|section/i,
);
```

- [x] **Step 2: Replace representative excerpt context with learning structure context**

Use `RagContextBuilderService.buildStudyGpsContext()` and pass a context containing:

```text
Learning structure:
- Document title
- Sections
- Candidate concepts
- Difficulty hints
- Important excerpts for grounding
```

- [x] **Step 3: Remove generic deterministic fallback as saved plan**

If generation fails or validates as generic, throw:

```ts
throw new ServiceUnavailableException(
  "Study GPS could not create a reliable learning route from the selected documents. Please regenerate or choose clearer source documents.",
);
```

- [x] **Step 4: Verify**

Run:

```bash
cd sks-backend
npm test -- --runInBand rag-study-gps.service.spec.ts
```

Expected: PASS.

---

### Task 9: Full RAG Verification

**Files:**

- No new files.

- [x] **Step 1: Run targeted unit tests**

```bash
cd sks-backend
npm test -- --runInBand rag-artifact-key.util.spec.ts rag-artifact-cache.service.spec.ts rag-context-builder.service.spec.ts rag-summary.service.spec.ts rag-mind-map.service.spec.ts rag-question-answering.service.spec.ts rag-study-gps.service.spec.ts
```

Expected: PASS.

- [x] **Step 2: Run backend build**

```bash
cd sks-backend
npm run build
```

Expected: PASS.

- [x] **Step 3: Run lint after review**

```bash
cd sks-backend
npm run lint
```

Expected: PASS or only pre-existing unrelated warnings. Note that the script uses `--fix`, so review `git diff` afterward.

- [x] **Step 4: Review diff**

```bash
git diff -- sks-backend/src/modules/rag docs/superpowers/plans/2026-05-06-rag-architecture-refactor.md
```

Expected: only focused RAG architecture/test changes and this plan.

---

## Risks

- Cache migration must preserve old `summaryByLanguage` and `mindMapByLanguage` entries until the UI no longer depends on `versions`.
- Defaulting Q&A to `document_strict` changes behavior. If product wants old behavior, default to `document_assisted` and expose strict mode in UI.
- Removing fallback mind maps and Study GPS plans will surface clear errors where the UI previously showed weak artifacts. Frontend error states may need polish.
- No database migration is needed because artifact storage remains inside existing `extraAttributes` jsonb.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-06-rag-architecture-refactor.md`. Two execution options:

1. Subagent-Driven (recommended) - dispatch a fresh subagent per task, review between tasks, fast iteration.
2. Inline Execution - execute tasks in this session using executing-plans, batch execution with checkpoints.
