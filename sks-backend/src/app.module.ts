import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { LlmModule } from './common/llm/llm.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, 
    }),
    DatabaseModule,
    LlmModule,

  ],
})
export class AppModule {}
