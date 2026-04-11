import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Document } from './entities/document.entity';
import { Chunk } from './entities/chunks.entity';
import { UserDocument } from './entities/user-document.entity';
import { Folder } from './entities/folder.entity';
import { DocumentAskHistory } from './entities/document-ask-history.entity';
import { UserRepository } from './repositories/user.repository';
import { DocumentRepository } from './repositories/document.repository';
import { ChunkRepository } from './repositories/chunks.repository';
import { UserDocumentRepository } from './repositories/user-document.repository';
import { FolderRepository } from './repositories/folder.repository';
import { DocumentAskHistoryRepository } from './repositories/document-ask-history.repository';

@Global()
@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        host: config.get<string>('DATABASE_HOST') ?? 'localhost',
        port: Number(config.get<string>('DATABASE_PORT') ?? '5432'),
        username: config.get<string>('DATABASE_USERNAME') ?? 'postgres',
        password: config.get<string>('DATABASE_PASSWORD') ?? 'postgres',
        database: config.get<string>('DATABASE_NAME') ?? 'sks',
        entities: [
          User,
          Document,
          Chunk,
          UserDocument,
          Folder,
          DocumentAskHistory,
        ],
        synchronize:
          (config.get<string>('DATABASE_SYNC') ?? 'false') === 'true',
        logging: (config.get<string>('DATABASE_LOGGING') ?? 'false') === 'true',
      }),
    }),
    TypeOrmModule.forFeature([
      User,
      Document,
      Chunk,
      UserDocument,
      Folder,
      DocumentAskHistory,
    ]),
  ],
  providers: [
    UserRepository,
    DocumentRepository,
    ChunkRepository,
    UserDocumentRepository,
    FolderRepository,
    DocumentAskHistoryRepository,
  ],
  exports: [
    TypeOrmModule,
    UserRepository,
    DocumentRepository,
    ChunkRepository,
    UserDocumentRepository,
    FolderRepository,
    DocumentAskHistoryRepository,
  ],
})
export class DatabaseModule {}
