import { Module } from '@nestjs/common';
import { GeminiService } from './gemini.service';
import { LLM_GENERATION_SERVICE } from './llm-generation.types';
import { LlmController } from './llm.controller';
import { MimoGenerationService } from './mimo-generation.service';

@Module({
  providers: [
    GeminiService,
    MimoGenerationService,
    {
      provide: LLM_GENERATION_SERVICE,
      useExisting: MimoGenerationService,
    },
  ],
  controllers: [LlmController],
  exports: [GeminiService, MimoGenerationService, LLM_GENERATION_SERVICE],
})
export class LlmModule {}
