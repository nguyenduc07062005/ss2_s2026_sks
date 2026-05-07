import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LlmModule } from 'src/common/llm/llm.module';
import { DatabaseModule } from 'src/database/database.module';
import { Document } from 'src/database/entities/document.entity';
import { DocumentAskHistory } from 'src/database/entities/document-ask-history.entity';
import { Folder } from 'src/database/entities/folder.entity';
import { QuizChatHistory } from 'src/database/entities/quiz-chat-history.entity';
import { StudyGpsDayChatMessage } from 'src/database/entities/study-gps-day-chat-message.entity';
import { StudyGpsPlan } from 'src/database/entities/study-gps-plan.entity';
import { UserDocument } from 'src/database/entities/user-document.entity';
import { ChunkRepository } from 'src/database/repositories/chunks.repository';
import { DocumentAskHistoryRepository } from 'src/database/repositories/document-ask-history.repository';
import { DocumentRepository } from 'src/database/repositories/document.repository';
import { FolderRepository } from 'src/database/repositories/folder.repository';
import { QuizChatHistoryRepository } from 'src/database/repositories/quiz-chat-history.repository';
import { StudyGpsDayChatMessageRepository } from 'src/database/repositories/study-gps-day-chat-message.repository';
import { StudyGpsPlanRepository } from 'src/database/repositories/study-gps-plan.repository';
import { UserDocumentRepository } from 'src/database/repositories/user-document.repository';
import { RagController } from './rag.controller';
import { RagService } from './rag.service';
import { RagArtifactCacheService } from './services/rag-artifact-cache.service';
import { RagContextBuilderService } from './services/rag-context-builder.service';
import { RagDocumentContextService } from './services/rag-document-context.service';
import { RagIndexingService } from './services/rag-indexing.service';
import { RagIndexingQueueService } from './services/rag-indexing-queue.service';
import { RagQuestionAnsweringService } from './services/rag-question-answering.service';
import { RagQuizService } from './services/rag-quiz.service';
import { RagSearchExplanationService } from './services/rag-search-explanation.service';
import { RagSearchService } from './services/rag-search.service';
import { RagSummaryService } from './services/rag-summary.service';
import { RagStructuredGenerationService } from './services/rag-structured-generation.service';
import { RagStudyGpsService } from './services/rag-study-gps.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Document,
      Folder,
      UserDocument,
      DocumentAskHistory,
      QuizChatHistory,
      StudyGpsPlan,
      StudyGpsDayChatMessage,
    ]),
    LlmModule,
    DatabaseModule,
  ],
  controllers: [RagController],
  providers: [
    RagService,
    RagSummaryService,
    RagArtifactCacheService,
    RagContextBuilderService,
    RagDocumentContextService,
    RagIndexingService,
    RagIndexingQueueService,
    RagQuestionAnsweringService,
    RagQuizService,
    RagSearchExplanationService,
    RagSearchService,
    RagStructuredGenerationService,
    RagStudyGpsService,
    DocumentRepository,
    ChunkRepository,
    FolderRepository,
    UserDocumentRepository,
    DocumentAskHistoryRepository,
    QuizChatHistoryRepository,
    StudyGpsPlanRepository,
    StudyGpsDayChatMessageRepository,
  ],
  exports: [RagService, RagSummaryService, RagStudyGpsService, RagQuizService],
})
export class RagModule {}
