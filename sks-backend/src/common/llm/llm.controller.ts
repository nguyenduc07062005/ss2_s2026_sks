import { Controller, Get, Query } from '@nestjs/common';
import { GeminiService } from './gemini.service';

@Controller('llm')
export class LlmController {
  constructor(private readonly geminiService: GeminiService) {}

  @Get('test')
  async testAi(@Query('prompt') prompt: string) {
    const response = await this.geminiService.generateText(prompt);
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
