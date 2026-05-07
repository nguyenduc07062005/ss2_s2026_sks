import 'dotenv/config';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { User } from './entities/user.entity';
import { Document } from './entities/document.entity';
import { Chunk } from './entities/chunks.entity';
import { UserDocument } from './entities/user-document.entity';
import { Folder } from './entities/folder.entity';
import { DocumentAskHistory } from './entities/document-ask-history.entity';
import { QuizChatHistory } from './entities/quiz-chat-history.entity';
import { StudyGpsDayChatMessage } from './entities/study-gps-day-chat-message.entity';
import { StudyGpsPlan } from './entities/study-gps-plan.entity';

const isConfigEnabled = (value?: string): boolean =>
  ['true', '1', 'yes'].includes((value ?? '').trim().toLowerCase());

const databaseUrl = process.env.DATABASE_URL?.trim();
const useSsl = isConfigEnabled(process.env.DATABASE_SSL);
const connectionOptions = databaseUrl
  ? {
      url: databaseUrl,
      ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
    }
  : {
      host: process.env.DATABASE_HOST || 'localhost',
      port: Number(process.env.DATABASE_PORT || '5432'),
      username: process.env.DATABASE_USERNAME || 'postgres',
      password: process.env.DATABASE_PASSWORD || 'postgres',
      database: process.env.DATABASE_NAME || 'sks',
    };

export const AppDataSource = new DataSource({
  type: 'postgres',
  ...connectionOptions,
  synchronize: false,
  logging: isConfigEnabled(process.env.DATABASE_LOGGING),
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
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  migrationsTableName: 'migrations',
});
