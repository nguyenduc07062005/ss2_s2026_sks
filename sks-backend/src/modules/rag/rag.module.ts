import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LlmModule } from 'src/common/llm/llm.module';
import { DatabaseModule } from 'src/database/database.module';
import { Document } from 'src/database/entities/document.entity';
import { DocumentAskHistory } from 'src/database/entities/document-ask-history.entity';
import { Folder } from 'src/database/entities/folder.entity';
import { UserDocument } from 'src/database/entities/user-document.entity';
import { ChunkRepository } from 'src/database/repositories/chunks.repository';
import { DocumentAskHistoryRepository } from 'src/database/repositories/document-ask-history.repository';
import { DocumentRepository } from 'src/database/repositories/document.repository';
import { FolderRepository } from 'src/database/repositories/folder.repository';
import { UserDocumentRepository } from 'src/database/repositories/user-document.repository';
import { RagController } from './rag.controller';
import { RagService } from './rag.service';
import { RagArtifactCacheService } from './services/rag-artifact-cache.service';
import { RagDocumentContextService } from './services/rag-document-context.service';
import { RagIndexingService } from './services/rag-indexing.service';
import { RagMindMapService } from './services/rag-mind-map.service';
import { RagQuestionAnsweringService } from './services/rag-question-answering.service';
import { RagSearchService } from './services/rag-search.service';
import { RagSummaryService } from './services/rag-summary.service';
import { RagStructuredGenerationService } from './services/rag-structured-generation.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Document,
      Folder,
      UserDocument,
      DocumentAskHistory,
    ]),
    LlmModule,
    DatabaseModule,
  ],
  controllers: [RagController],
  providers: [
    RagService,
    RagMindMapService,
    RagSummaryService,
    RagArtifactCacheService,
    RagDocumentContextService,
    RagIndexingService,
    RagQuestionAnsweringService,
    RagSearchService,
    RagStructuredGenerationService,
    DocumentRepository,
    ChunkRepository,
    FolderRepository,
    UserDocumentRepository,
    DocumentAskHistoryRepository,
  ],
  exports: [RagService, RagMindMapService, RagSummaryService],
})
export class RagModule {}
