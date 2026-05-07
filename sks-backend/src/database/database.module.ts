import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Document } from './entities/document.entity';
import { Chunk } from './entities/chunks.entity';
import { UserDocument } from './entities/user-document.entity';
import { Folder } from './entities/folder.entity';
import { DocumentAskHistory } from './entities/document-ask-history.entity';
import { QuizChatHistory } from './entities/quiz-chat-history.entity';
import { StudyGpsDayChatMessage } from './entities/study-gps-day-chat-message.entity';
import { StudyGpsPlan } from './entities/study-gps-plan.entity';
import { UserRepository } from './repositories/user.repository';
import { DocumentRepository } from './repositories/document.repository';
import { ChunkRepository } from './repositories/chunks.repository';
import { UserDocumentRepository } from './repositories/user-document.repository';
import { FolderRepository } from './repositories/folder.repository';
import { DocumentAskHistoryRepository } from './repositories/document-ask-history.repository';
import { QuizChatHistoryRepository } from './repositories/quiz-chat-history.repository';
import { StudyGpsDayChatMessageRepository } from './repositories/study-gps-day-chat-message.repository';
import { StudyGpsPlanRepository } from './repositories/study-gps-plan.repository';

const isConfigEnabled = (value?: string): boolean =>
  ['true', '1', 'yes'].includes((value ?? '').trim().toLowerCase());

@Global()
@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const databaseUrl = config.get<string>('DATABASE_URL')?.trim();
        const useSsl = isConfigEnabled(config.get<string>('DATABASE_SSL'));
        const connectionOptions = databaseUrl
          ? {
              url: databaseUrl,
              ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
            }
          : {
              host: config.get<string>('DATABASE_HOST') ?? 'localhost',
              port: Number(config.get<string>('DATABASE_PORT') ?? '5432'),
              username: config.get<string>('DATABASE_USERNAME') ?? 'postgres',
              password: config.get<string>('DATABASE_PASSWORD') ?? 'postgres',
              database: config.get<string>('DATABASE_NAME') ?? 'sks',
            };

        return {
          type: 'postgres' as const,
          ...connectionOptions,
          entities: [
            User,
            Document,
            Chunk,
            UserDocument,
            Folder,
            DocumentAskHistory,
            QuizChatHistory,
            StudyGpsPlan,
            StudyGpsDayChatMessage,
          ],
          synchronize: isConfigEnabled(config.get<string>('DATABASE_SYNC')),
          logging: isConfigEnabled(config.get<string>('DATABASE_LOGGING')),
        };
      },
    }),
    TypeOrmModule.forFeature([
      User,
      Document,
      Chunk,
      UserDocument,
      Folder,
      DocumentAskHistory,
      QuizChatHistory,
      StudyGpsPlan,
      StudyGpsDayChatMessage,
    ]),
  ],
  providers: [
    UserRepository,
    DocumentRepository,
    ChunkRepository,
    UserDocumentRepository,
    FolderRepository,
    DocumentAskHistoryRepository,
    QuizChatHistoryRepository,
    StudyGpsPlanRepository,
    StudyGpsDayChatMessageRepository,
  ],
  exports: [
    TypeOrmModule,
    UserRepository,
    DocumentRepository,
    ChunkRepository,
    UserDocumentRepository,
    FolderRepository,
    DocumentAskHistoryRepository,
    QuizChatHistoryRepository,
    StudyGpsPlanRepository,
    StudyGpsDayChatMessageRepository,
  ],
})
export class DatabaseModule {}
