import { Module } from '@nestjs/common';
import { FolderController } from './folder.controller';
import { FolderService } from './folder.service';
import { FolderRepository } from 'src/database/repositories/folder.repository';
import { DocumentRepository } from 'src/database/repositories/document.repository';
import { UserDocumentRepository } from 'src/database/repositories/user-document.repository';

@Module({
  controllers: [FolderController],
  providers: [
    FolderService,
    FolderRepository,
    DocumentRepository,
    UserDocumentRepository,
  ],
  exports: [FolderService],
})
export class FolderModule {}
