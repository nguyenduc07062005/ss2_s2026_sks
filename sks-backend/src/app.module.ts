import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { existsSync } from 'fs';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LlmModule } from './common/llm/llm.module';
import { DatabaseModule } from './database/database.module';
import { AuthenticationModule } from './modules/authentication/authentication.module';
import { DocumentModule } from './modules/document/document.module';
import { FolderModule } from './modules/folder/folder.module';
import { RagModule } from './modules/rag/rag.module';

const resolveEnvFilePaths = (): string[] => {
  const candidates = [
    join(process.cwd(), 'sks-backend', '.env'),
    join(process.cwd(), '.env'),
  ];

  return candidates.filter((envPath) => existsSync(envPath));
};

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: resolveEnvFilePaths(),
      isGlobal: true,
    }),
    EventEmitterModule.forRoot(),
    DatabaseModule,
    AuthenticationModule,
    DocumentModule,
    FolderModule,
    LlmModule,
    RagModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
