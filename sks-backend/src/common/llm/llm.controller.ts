import { Controller, Get, Inject, Query } from '@nestjs/common';
import { GeminiService } from './gemini.service';
import {
  LLM_GENERATION_SERVICE,
  type LlmGenerationService,
} from './llm-generation.types';

@Controller('llm')
export class LlmController {
  constructor(
    private readonly geminiService: GeminiService,
    @Inject(LLM_GENERATION_SERVICE)
    private readonly generationService: LlmGenerationService,
  ) {}

  @Get('test')
  async testAi(@Query('prompt') prompt: string) {
    const response = await this.generationService.generateText(prompt);
    return {
      success: true,
      prompt,
      response,
    };
  }

  @Get('test-embedding')
  async testEmbedding(@Query('text') text: string) {
    const embedding = await this.geminiService.createEmbedding(text);

    if (!embedding) {
      return { success: false, message: 'lỗi embedding' };
    }

    return {
      success: true,
      text,
      embeddingSize: embedding.length,
      preview: embedding.slice(0, 5),
    };
  }
}
