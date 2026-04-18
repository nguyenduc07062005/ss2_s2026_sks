import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import { AskRagDto } from './dtos/ask-rag.dto';
import { GenerateSummaryDto } from './dtos/generate-summary.dto';
import { RagService } from './rag.service';
import { RagMindMapService } from './services/rag-mind-map.service';
import { RagSummaryService } from './services/rag-summary.service';
import { JwtAuthGuard } from '../authentication/jwt/jwt-auth.guard';

@Controller('rag')
@UseGuards(JwtAuthGuard)
export class RagController {
  constructor(
    private readonly ragService: RagService,
    private readonly ragMindMapService: RagMindMapService,
    private readonly ragSummaryService: RagSummaryService,
  ) {}

  private getUserId(req: ExpressRequest) {
    return (req as ExpressRequest & { user: { userId: string } }).user.userId;
  }

  @HttpCode(HttpStatus.OK)
  @Post('documents/:documentId/ask')
  async askDocument(
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Body() dto: AskRagDto,
    @Request() req: ExpressRequest,
  ) {
    const ownerId = this.getUserId(req);
    const result = await this.ragService.askDocument(
      documentId,
      ownerId,
      dto.question,
    );

    return {
      message: 'Document question answered successfully',
      ...result,
    };
  }

  @HttpCode(HttpStatus.OK)
  @Get('documents/:documentId/ask/history')
  async getDocumentAskHistory(
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Request() req: ExpressRequest,
  ) {
    const ownerId = this.getUserId(req);
    const items = await this.ragService.getDocumentAskHistory(
      documentId,
      ownerId,
    );

    return {
      message: 'Document ask history retrieved successfully',
      items,
    };
  }

  @HttpCode(HttpStatus.OK)
  @Delete('documents/:documentId/ask/history')
  async clearDocumentAskHistory(
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Request() req: ExpressRequest,
  ) {
    const ownerId = this.getUserId(req);
    const cleared = await this.ragService.clearDocumentAskHistory(
      documentId,
      ownerId,
    );

    return {
      message: 'Document ask history cleared successfully',
      cleared,
    };
  }

  @HttpCode(HttpStatus.OK)
  @Post('documents/:documentId/summary')
  async getDocumentSummary(
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Body() body: GenerateSummaryDto,
    @Request() req: ExpressRequest,
  ) {
    const ownerId = this.getUserId(req);
    const result = await this.ragSummaryService.generateSummary(
      documentId,
      ownerId,
      body.language ?? 'en',
      body.forceRefresh ?? false,
      body.instruction,
      body.slot,
    );

    return {
      message: 'Document summary generated successfully',
      ...result,
    };
  }

  @HttpCode(HttpStatus.OK)
  @Post('documents/:documentId/mindmap')
  async getDocumentMindMap(
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Body() body: GenerateSummaryDto,
    @Request() req: ExpressRequest,
  ) {
    const ownerId = this.getUserId(req);
    const result = await this.ragMindMapService.getDocumentMindMap(
      documentId,
      ownerId,
      body?.language ?? 'en',
      body?.forceRefresh ?? false,
    );

    return {
      message: 'Document mind map generated successfully',
      ...result,
    };
  }

  @HttpCode(HttpStatus.OK)
  @Post('documents/:documentId/diagram')
  async getDocumentDiagram(
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Request() req: ExpressRequest,
  ) {
    const ownerId = this.getUserId(req);
    const result = await this.ragService.getDocumentDiagram(
      documentId,
      ownerId,
    );

    return {
      message: 'Document diagram generated successfully',
      ...result,
    };
  }
}
