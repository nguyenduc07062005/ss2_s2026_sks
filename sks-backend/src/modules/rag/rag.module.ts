import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LlmModule } from 'src/common/llm/llm.module';
import { DatabaseModule } from 'src/database/database.module';
import { Document } from 'src/database/entities/document.entity';
import { Folder } from 'src/database/entities/folder.entity';
import { UserDocument } from 'src/database/entities/user-document.entity';
import { ChunkRepository } from 'src/database/repositories/chunks.repository';
import { DocumentRepository } from 'src/database/repositories/document.repository';
import { FolderRepository } from 'src/database/repositories/folder.repository';
import { UserDocumentRepository } from 'src/database/repositories/user-document.repository';
import { RagController } from './rag.controller';
import { RagService } from './rag.service';
import { RagArtifactCacheService } from './services/rag-artifact-cache.service';
import { RagDocumentContextService } from './services/rag-document-context.service';
import { RagIndexingService } from './services/rag-indexing.service';
import { RagSummaryService } from './services/rag-summary.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Document, Folder, UserDocument]),
    LlmModule,
    DatabaseModule,
  ],
  controllers: [RagController],
  providers: [
    RagService,
    RagSummaryService,
    RagArtifactCacheService,
    RagDocumentContextService,
    RagIndexingService,
    DocumentRepository,
    ChunkRepository,
    FolderRepository,
    UserDocumentRepository,
  ],
  exports: [RagService, RagSummaryService],
})
export class RagModule {}
