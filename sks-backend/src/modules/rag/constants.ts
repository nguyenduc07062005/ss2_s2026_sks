export const SOURCE_SNIPPET_LENGTH = 280;

export const EMBEDDING_MODEL = 'gemini-embedding-001';
export const EMBEDDING_DIMENSION = 3072;
export const EMBEDDING_BATCH_SIZE = Math.max(
  1,
  Number(process.env.EMBEDDING_BATCH_SIZE) || 5,
);

export const DEFAULT_SEARCH_LIMIT = 10;
export const DEFAULT_RELATED_LIMIT = 6;
export const SEMANTIC_SCORE_THRESHOLD = 0.58;
export const FALLBACK_TRIGGER_THRESHOLD = 0.72;
export const SEMANTIC_STRONG_MATCH_THRESHOLD = 0.78;
export const SEMANTIC_VERY_STRONG_MATCH_THRESHOLD = 0.86;
export const SEARCH_CONCEPT_LIMIT = 4;

export const DEFAULT_RETRIEVAL_LIMIT = 8;
export const RECENT_ASK_HISTORY_TURNS = 4;
export const MAX_DOCUMENT_ASK_HISTORY_ITEMS = 6;
export const RECENT_ANSWER_CONTEXT_LENGTH = 280;

export const MAX_SUMMARY_CONTEXT_CHUNKS = 18;
export const SUMMARY_ARTIFACT_VERSION = 3;

export const QUIZ_CHUNKS_PER_DOCUMENT = 8;
export const MAX_QUIZ_DOCUMENTS = 8;
export const MAX_QUIZ_CHAT_HISTORY_ITEMS = 20;
export const RECENT_QUIZ_CHAT_TURNS = 8;

export const STUDY_GPS_CHUNKS_PER_DOCUMENT = 7;
export const STUDY_GPS_CONTEXT_SNIPPET_LENGTH = 900;
export const RECENT_STUDY_GPS_DAY_CHAT_MESSAGES = 10;
export const MAX_STUDY_GPS_DAY_CHAT_MESSAGES = 40;
export const STUDY_GPS_RECENT_CONTEXT_TURNS = 8;

/**
 * Unified stopword set covering English and Vietnamese (transliterated).
 * Used by both document-context search and concept-extraction search.
 */
export const CONTEXT_SEARCH_STOPWORDS = new Set([
  // English function words
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'for',
  'from',
  'how',
  'in',
  'into',
  'is',
  'it',
  'its',
  'of',
  'on',
  'only',
  'or',
  'should',
  'that',
  'the',
  'their',
  'this',
  'to',
  'using',
  'what',
  'when',
  'where',
  'which',
  'with',
  'within',
  // English query/meta words
  'answer',
  'answers',
  'include',
  'includes',
  'including',
  'inside',
  'mention',
  'mentioned',
  'mentions',
  'specific',
  // Vietnamese function words (transliterated, no diacritics)
  'la',
  'va',
  've',
  'voi',
  'cua',
  'cho',
  'cac',
  'nhung',
  'trong',
  'ngoai',
  'mot',
  'nay',
  'do',
]);
