import {
  buildArtifactCacheKey,
  hashArtifactInstruction,
} from './rag-artifact-key.util';

describe('rag artifact cache key', () => {
  it('changes when instruction changes', () => {
    const base = {
      artifactType: 'summary' as const,
      documentId: 'doc-1',
      contentHash: 'content-hash-1',
      language: 'en' as const,
      mode: 'custom' as const,
      artifactVersion: 3,
    };

    expect(
      buildArtifactCacheKey({ ...base, instruction: 'Focus on causes.' }).key,
    ).not.toBe(
      buildArtifactCacheKey({ ...base, instruction: 'Focus on effects.' }).key,
    );
  });

  it('uses a stable empty instruction hash for default artifacts', () => {
    expect(hashArtifactInstruction(null)).toBe(hashArtifactInstruction(''));
    expect(hashArtifactInstruction('   ')).toBe(hashArtifactInstruction(null));
  });

  it('changes when content hash or artifact version changes', () => {
    const base = {
      artifactType: 'summary' as const,
      documentId: 'doc-1',
      contentHash: 'content-hash-1',
      language: 'vi' as const,
      mode: 'default' as const,
      instruction: null,
      artifactVersion: 3,
    };

    expect(buildArtifactCacheKey(base).key).not.toBe(
      buildArtifactCacheKey({ ...base, contentHash: 'content-hash-2' }).key,
    );
    expect(buildArtifactCacheKey(base).key).not.toBe(
      buildArtifactCacheKey({ ...base, artifactVersion: 19 }).key,
    );
  });
});
