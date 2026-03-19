import { Module } from '@nestjs/common';
import { GeminiService } from './gemini.service';
import { LlmController } from './llm.controller';

@Module({
  providers: [GeminiService],
  controllers: [LlmController],
  exports: [GeminiService],
})
export class LlmModule {}
