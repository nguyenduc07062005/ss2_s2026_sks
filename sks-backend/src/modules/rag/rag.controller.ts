import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import { AskRagDto } from './dtos/ask-rag.dto';
import { GenerateMindMapDto } from './dtos/generate-mind-map.dto';
import { GenerateMindMapNodeNoteDto } from './dtos/generate-mind-map-node-note.dto';
import { GenerateSummaryDto } from './dtos/generate-summary.dto';
import {
  GenerateStudyGpsDayChatDto,
  StartStudyGpsDayChatDto,
} from './dtos/generate-study-gps-day-chat.dto';
import { GenerateStudyGpsDto } from './dtos/generate-study-gps.dto';
import { RagService } from './rag.service';
import { RagMindMapService } from './services/rag-mind-map.service';
import { RagStudyGpsService } from './services/rag-study-gps.service';
import { RagSummaryService } from './services/rag-summary.service';
import { JwtAuthGuard } from '../authentication/jwt/jwt-auth.guard';

@Controller('rag')
@UseGuards(JwtAuthGuard)
export class RagController {
  constructor(
    private readonly ragService: RagService,
    private readonly ragMindMapService: RagMindMapService,
    private readonly ragSummaryService: RagSummaryService,
    private readonly ragStudyGpsService: RagStudyGpsService,
  ) {}

  private getUserId(req: ExpressRequest) {
    return (req as ExpressRequest & { user: { userId: string } }).user.userId;
  }

  @HttpCode(HttpStatus.OK)
  @Get('study-gps')
  async getStudyGpsPlan(@Request() req: ExpressRequest) {
    const ownerId = this.getUserId(req);
    const plan = await this.ragStudyGpsService.getActivePlan(ownerId);

    return {
      message: plan
        ? 'Study GPS plan retrieved successfully'
        : 'No Study GPS plan has been generated yet',
      plan,
    };
  }

  @HttpCode(HttpStatus.OK)
  @Post('study-gps')
  async generateStudyGpsPlan(
    @Body() body: GenerateStudyGpsDto,
    @Request() req: ExpressRequest,
  ) {
    const ownerId = this.getUserId(req);
    const plan = await this.ragStudyGpsService.generateStudyGpsPlan(
      ownerId,
      body,
    );

    return {
      message: 'Study GPS plan generated successfully',
      plan,
    };
  }

  @HttpCode(HttpStatus.OK)
  @Delete('study-gps')
  async clearStudyGpsPlan(@Request() req: ExpressRequest) {
    const ownerId = this.getUserId(req);
    const cleared = await this.ragStudyGpsService.clearActivePlan(ownerId);

    return {
      message: cleared
        ? 'Study GPS plan cleared successfully'
        : 'No Study GPS plan was found',
      cleared,
    };
  }

  @HttpCode(HttpStatus.OK)
  @Get('study-gps/day-chat/:day/history')
  async getStudyGpsDayChatHistory(
    @Param('day', ParseIntPipe) day: number,
    @Request() req: ExpressRequest,
  ) {
    const ownerId = this.getUserId(req);
    const result = await this.ragStudyGpsService.getStudyGpsDayChatHistory(
      ownerId,
      day,
    );

    return {
      message: 'Study GPS day chat history retrieved successfully',
      ...result,
    };
  }

  @HttpCode(HttpStatus.OK)
  @Post('study-gps/day-chat/start')
  async startStudyGpsDayChat(
    @Body() body: StartStudyGpsDayChatDto,
    @Request() req: ExpressRequest,
  ) {
    const ownerId = this.getUserId(req);
    const result = await this.ragStudyGpsService.startStudyGpsDayChat(
      ownerId,
      body.day,
    );

    return {
      message: 'Study GPS day chat started successfully',
      ...result,
    };
  }

  @HttpCode(HttpStatus.OK)
  @Post('study-gps/day-chat')
  async sendStudyGpsDayChat(
    @Body() body: GenerateStudyGpsDayChatDto,
    @Request() req: ExpressRequest,
  ) {
    const ownerId = this.getUserId(req);
    const result = await this.ragStudyGpsService.generateStudyGpsDayChat(
      ownerId,
      body,
    );

    return {
      message: 'Study GPS day chat answered successfully',
      ...result,
    };
  }

  @HttpCode(HttpStatus.OK)
  @Delete('study-gps/day-chat/:day/history')
  async clearStudyGpsDayChatHistory(
    @Param('day', ParseIntPipe) day: number,
    @Request() req: ExpressRequest,
  ) {
    const ownerId = this.getUserId(req);
    const cleared = await this.ragStudyGpsService.clearStudyGpsDayChatHistory(
      ownerId,
      day,
    );

    return {
      message: 'Study GPS day chat history cleared successfully',
      cleared,
    };
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
    @Body() body: GenerateMindMapDto,
    @Request() req: ExpressRequest,
  ) {
    const ownerId = this.getUserId(req);
    const result = await this.ragMindMapService.getDocumentMindMap(
      documentId,
      ownerId,
      body?.language ?? 'en',
      body?.forceRefresh ?? false,
      body?.instruction,
      body?.slot,
    );

    return {
      message: 'Document mind map generated successfully',
      ...result,
    };
  }

  @HttpCode(HttpStatus.OK)
  @Post('documents/:documentId/mindmap/node-note')
  async generateMindMapNodeStudyNote(
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Body() body: GenerateMindMapNodeNoteDto,
    @Request() req: ExpressRequest,
  ) {
    const ownerId = this.getUserId(req);
    const result = await this.ragMindMapService.generateMindMapNodeStudyNote(
      documentId,
      ownerId,
      {
        language: body.language ?? 'en',
        label: body.label,
        summary: body.summary,
        pathLabels: body.pathLabels,
        childLabels: body.childLabels,
        siblingLabels: body.siblingLabels,
      },
    );

    return {
      message: 'Mind map node study note generated successfully',
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
