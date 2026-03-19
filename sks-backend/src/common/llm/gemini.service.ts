import { Injectable } from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GeminiService {
  private ai: GoogleGenAI;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    this.ai = new GoogleGenAI({ apiKey });
  }

  async generateText(prompt: string) {
    const result = await this.ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });
    return result.text;
  }

  async createEmbedding(text: string) {
    const response = await this.ai.models.embedContent({
      model: 'gemini-embedding-001',
      contents: [{ role: 'user', parts: [{ text }] }],
    });

    if (!response.embeddings || response.embeddings.length === 0) {
      throw new Error('lỗi embedding');
    }

    return response.embeddings[0].values;
  }
}
