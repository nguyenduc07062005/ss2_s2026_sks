import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { RagStudyGpsService } from './rag-study-gps.service';
import type { GenerateStudyGpsDto } from '../dtos/generate-study-gps.dto';
import type { StudyGpsPlanContent } from '../types/rag.types';

describe('RagStudyGpsService', () => {
  const dto: GenerateStudyGpsDto = {
    documentIds: ['doc-1'],
    goal: 'exam',
    level: 'average',
    daysLeft: 2,
    hoursPerDay: 2,
    language: 'en',
  };

  const generatedPlan: StudyGpsPlanContent = {
    dailyRoute: [
      {
        day: 1,
        goal: 'Build the foundation concepts',
        tasks: [
          'Review the definition of the core concept and its cause-effect relationship.',
          'Map the section workflow from foundation to application.',
        ],
      },
      {
        day: 2,
        goal: 'Practice application and comparison',
        tasks: [
          'Compare the concept examples and explain their effects.',
          'Use the evaluation section to practice the argument workflow.',
        ],
      },
    ],
  };

  const ragIndexingService = {
    ensureDocumentIndexed: jest.fn<Promise<void>, [string, unknown?]>(),
  };
  const ragDocumentContextService = {};
  const ragContextBuilderService = {
    buildStudyGpsContext: jest.fn<
      Promise<{
        text: string;
        chunks: Array<{
          chunkIndex: number;
          chunkText: string;
          pageNumber: number | null;
          sectionTitle: string | null;
        }>;
        meta: unknown;
      }>,
      [Array<{ id: string; title: string }>]
    >(),
  };
  const ragQuestionAnsweringService = {};
  const ragStructuredGenerationService = {
    generate: jest.fn<Promise<StudyGpsPlanContent>, [unknown]>(),
  };
  const userDocumentRepository = {
    findByUserAndDocument: jest.fn<Promise<unknown>, [string, string]>(),
  };
  const studyGpsPlanRepository = {
    findByUserId: jest.fn<Promise<unknown>, [string]>(),
    clearByUserId: jest.fn<Promise<boolean>, [string]>(),
    saveActivePlan: jest.fn<Promise<unknown>, [string, unknown]>(),
  };
  const studyGpsDayChatMessageRepository = {
    findRecentByPlanAndDay: jest.fn(),
    findByPlanAndDay: jest.fn(),
    createMessage: jest.fn(),
    trimToLatestByPlanAndDay: jest.fn(),
    clearByPlanAndDay: jest.fn(),
  };

  let service: RagStudyGpsService;

  beforeEach(() => {
    jest.resetAllMocks();

    ragIndexingService.ensureDocumentIndexed.mockResolvedValue(undefined);
    userDocumentRepository.findByUserAndDocument.mockResolvedValue({
      id: 'user-doc-1',
      documentName: 'Learning Document',
      document: {
        id: 'doc-1',
        title: 'Original Document Title',
      },
    });
    ragContextBuilderService.buildStudyGpsContext.mockResolvedValue({
      text: [
        'Learning structure:',
        '- Learning Document',
        '  Sections: Foundations, Application, Evaluation',
        '  Concepts: core concept, cause-effect relationship, section workflow',
        '',
        'Important excerpts:',
        '[Foundations] The core concept definition explains causes and effects.',
      ].join('\n'),
      chunks: [
        {
          chunkIndex: 0,
          chunkText:
            'The core concept definition explains causes, effects, and the workflow across sections.',
          pageNumber: 1,
          sectionTitle: 'Foundations',
        },
      ],
      meta: {},
    });
    ragStructuredGenerationService.generate.mockResolvedValue(generatedPlan);
    studyGpsPlanRepository.saveActivePlan.mockImplementation(
      (_ownerId, payload) =>
        Promise.resolve({
          id: 'plan-1',
          ...(payload as Record<string, unknown>),
          generatedAt: new Date('2026-05-06T00:00:00.000Z'),
          updatedAt: new Date('2026-05-06T00:00:00.000Z'),
        }),
    );

    service = new RagStudyGpsService(
      ragIndexingService as never,
      ragDocumentContextService as never,
      ragContextBuilderService as never,
      ragQuestionAnsweringService as never,
      ragStructuredGenerationService as never,
      userDocumentRepository as never,
      studyGpsPlanRepository as never,
      studyGpsDayChatMessageRepository as never,
    );
  });

  it('generates and saves a learning-structure-based route', async () => {
    const result = await service.generateStudyGpsPlan('user-1', dto);
    const firstDayTasks = result.plan.dailyRoute[0]?.tasks.join(' ') ?? '';

    expect(ragIndexingService.ensureDocumentIndexed).toHaveBeenCalledWith(
      'doc-1',
      { waitIfIndexing: true },
    );
    expect(ragContextBuilderService.buildStudyGpsContext).toHaveBeenCalledWith([
      { id: 'doc-1', title: 'Learning Document' },
    ]);
    const generationRequest = ragStructuredGenerationService.generate.mock
      .calls[0]?.[0] as
      | {
          input?: {
            context?: string;
          };
        }
      | undefined;

    expect(generationRequest?.input?.context).toContain('Learning structure:');
    expect(result.plan.dailyRoute).toHaveLength(dto.daysLeft);
    expect(firstDayTasks).not.toMatch(/chunk|excerpt|reference/i);
    expect(firstDayTasks).toMatch(
      /concept|cause|effect|definition|workflow|section/i,
    );
    expect(studyGpsPlanRepository.saveActivePlan).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        goal: 'exam',
        level: 'average',
        language: 'en',
        daysLeft: 2,
        hoursPerDay: 2,
        documents: [{ id: 'doc-1', title: 'Learning Document' }],
        plan: generatedPlan,
      }),
    );
  });

  it('waits for background indexing before building a route', async () => {
    await service.generateStudyGpsPlan('user-1', dto);

    expect(ragIndexingService.ensureDocumentIndexed).toHaveBeenCalledWith(
      'doc-1',
      { waitIfIndexing: true },
    );
  });

  it('accepts concrete document-specific tasks without requiring fixed keywords', async () => {
    ragStructuredGenerationService.generate.mockResolvedValueOnce({
      dailyRoute: [
        {
          day: 1,
          goal: 'Follow the JWT login path',
          tasks: [
            'Trace how login creates access tokens and validates protected requests.',
            'Connect Passport strategy setup with guard behavior in protected endpoints.',
          ],
        },
        {
          day: 2,
          goal: 'Prepare auth troubleshooting',
          tasks: [
            'Compare expired-token responses with missing-token responses in the API.',
            'Build a short checklist for ownership checks around document access.',
          ],
        },
      ],
    });

    const result = await service.generateStudyGpsPlan('user-1', dto);

    expect(result.plan.dailyRoute).toHaveLength(dto.daysLeft);
    expect(studyGpsPlanRepository.saveActivePlan).toHaveBeenCalled();
  });

  it('does not save a deterministic fallback when generation fails', async () => {
    ragStructuredGenerationService.generate.mockRejectedValueOnce(
      new Error('model unavailable'),
    );

    await expect(
      service.generateStudyGpsPlan('user-1', dto),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(studyGpsPlanRepository.saveActivePlan).not.toHaveBeenCalled();
  });

  it('rejects generic generated routes instead of padding fallback days', async () => {
    ragStructuredGenerationService.generate.mockResolvedValueOnce({
      dailyRoute: [
        {
          day: 1,
          goal: 'Study the material',
          tasks: ['Read carefully and check your understanding.'],
        },
      ],
    });

    await expect(
      service.generateStudyGpsPlan('user-1', dto),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(studyGpsPlanRepository.saveActivePlan).not.toHaveBeenCalled();
  });

  it('rejects selected documents with no indexed learning context', async () => {
    ragContextBuilderService.buildStudyGpsContext.mockResolvedValueOnce({
      text: '',
      chunks: [],
      meta: {},
    });

    await expect(
      service.generateStudyGpsPlan('user-1', dto),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(ragStructuredGenerationService.generate).not.toHaveBeenCalled();
    expect(studyGpsPlanRepository.saveActivePlan).not.toHaveBeenCalled();
  });
});
