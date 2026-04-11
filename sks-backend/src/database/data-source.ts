import 'dotenv/config';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { User } from './entities/user.entity';
import { Document } from './entities/document.entity';
import { Chunk } from './entities/chunks.entity';
import { UserDocument } from './entities/user-document.entity';
import { Folder } from './entities/folder.entity';
import { DocumentAskHistory } from './entities/document-ask-history.entity';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: Number(process.env.DATABASE_PORT || '5432'),
  username: process.env.DATABASE_USERNAME || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'postgres',
  database: process.env.DATABASE_NAME || 'sks',
  synchronize: false,
  logging: (process.env.DATABASE_LOGGING || 'false') === 'true',
  entities: [User, Document, Chunk, UserDocument, Folder, DocumentAskHistory],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  migrationsTableName: 'migrations',
});
