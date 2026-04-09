import {
  Controller,
  BadRequestException,
  Post,
  Patch,
  UploadedFile,
  UseInterceptors,
  Body,
  HttpCode,
  HttpStatus,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
  Delete,
  Request,
  Res,
  Query,
} from '@nestjs/common';
import type { Request as ExpressRequest, Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { DocumentService } from './document.service';
import { DocumentDto } from './dtos/document.dto';
import { DeleteDocumentDto } from './dtos/delete-document.dto';
import { SearchDocumentDto } from './dtos/search-document.dto';
import { UpdateDocumentNameDto } from './dtos/update-document-name.dto';
import { JwtAuthGuard } from '../authentication/jwt/jwt-auth.guard';
import { RagService } from '../rag/rag.service';

@Controller('documents')
export class DocumentController {
  private static readonly supportedMimeTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
  ];

  constructor(
    private readonly documentService: DocumentService,
    private readonly ragService: RagService,
  ) {}

  private getUserId(req: ExpressRequest): string {
    return (req as ExpressRequest & { user: { userId: string } }).user.userId;
  }

  // --- Upload document ---
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, callback) => {
        if (DocumentController.supportedMimeTypes.includes(file.mimetype)) {
          callback(null, true);
          return;
        }

        callback(
          new Error('Only PDF, DOCX, or TXT files are supported.'),
          false,
        );
      },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() createDocumentDto: DocumentDto,
    @Request() req: ExpressRequest,
  ): Promise<any> {
    const ownerId = this.getUserId(req);

    if (!file) {
      throw new BadRequestException(
        'A valid PDF, DOCX, or TXT file is required.',
      );
    }

    if (!createDocumentDto.title) {
      createDocumentDto.title = file.originalname;
    }

    const uploaded = await this.documentService.uploadDocument(
      file,
      createDocumentDto,
      ownerId,
    );
    await this.ragService.ensureDocumentIndexed(uploaded.id);
    const updatedList = await this.documentService.getDocuments(ownerId);

    return {
      message: 'Document uploaded and list refreshed successfully',
      uploaded,
      updatedList,
    };
  }

  // --- Get all documents for logged-in user ---
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @Get()
  async getDocuments(
    @Request() req: ExpressRequest,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '5',
  ) {
    const ownerId = this.getUserId(req);
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 5;
    const result = await this.documentService.getDocuments(
      ownerId,
      pageNum,
      limitNum,
    );
    return {
      message: 'Documents retrieved successfully',
      total: result.total,
      currentPage: result.currentPage,
      totalPages: result.totalPages,
      documents: result.documents,
    };
  }

  // --- Delete document ---
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @Delete('delete')
  async deleteDocument(
    @Request() req: ExpressRequest,
    @Body() deleteDto: DeleteDocumentDto,
  ) {
    const ownerId = this.getUserId(req);
    const result = await this.documentService.deleteDocument(
      ownerId,
      deleteDto.documentId,
    );
    return result;
  }

  // --- Toggle favorite ---
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @Post(':documentId/toggle-favorite')
  async toggleFavorite(
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Request() req: ExpressRequest,
  ) {
    const userId = this.getUserId(req);
    const result = await this.documentService.toggleFavorite(
      userId,
      documentId,
    );
    return {
      message: 'Favorite toggled successfully',
      data: result,
    };
  }

  // --- Get favorite documents ---
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @Get('favorites')
  async getFavorites(@Request() req: ExpressRequest) {
    const userId = this.getUserId(req);
    const result = await this.documentService.getFavorites(userId);
    return {
      message: 'Favorites retrieved successfully',
      favorites: result,
    };
  }

  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @Get('search')
  async searchDocuments(
    @Query() searchDto: SearchDocumentDto,
    @Request() req: ExpressRequest,
  ) {
    const ownerId = this.getUserId(req);
    const result = await this.ragService.searchDocuments(
      searchDto.q || '',
      ownerId,
      {
        folderId: searchDto.folderId,
        page: Number(searchDto.page) || 1,
        limit: Number(searchDto.limit) || 10,
      },
    );

    return result;
  }

  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @Get(':id/related')
  async getRelatedDocuments(
    @Param('id', ParseUUIDPipe) documentId: string,
    @Request() req: ExpressRequest,
    @Query('limit') limit: string = '6',
  ) {
    const ownerId = this.getUserId(req);
    const result = await this.ragService.getRelatedDocuments(
      documentId,
      ownerId,
      Number(limit) || 6,
    );

    return {
      message: 'Related documents retrieved successfully',
      total: result.total,
      documents: result.documents,
    };
  }

  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async getDocumentById(
    @Param('id', ParseUUIDPipe) documentId: string,
    @Request() req: ExpressRequest,
  ) {
    const ownerId = this.getUserId(req);
    const document = await this.documentService.getDocumentDetails(
      documentId,
      ownerId,
    );

    return {
      message: 'Document retrieved successfully',
      document,
    };
  }

  // --- Serve document file ---
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @Get(':id/file')
  async getDocumentFile(
    @Param('id', ParseUUIDPipe) documentId: string,
    @Request() req: ExpressRequest,
    @Res() res: Response,
  ) {
    const ownerId = this.getUserId(req);
    const filePath = await this.documentService.getDocumentFilePath(
      documentId,
      ownerId,
    );
    res.sendFile(filePath);
  }

  // --- Update document name ---
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @Patch(':documentId/update-name')
  async updateDocumentName(
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Body() updateDto: UpdateDocumentNameDto,
    @Request() req: ExpressRequest,
  ) {
    const userId = this.getUserId(req);
    const result = await this.documentService.updateDocumentName(
      userId,
      documentId,
      updateDto.newDocumentName,
    );
    return result;
  }
}
