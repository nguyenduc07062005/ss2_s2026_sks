import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import { JwtAuthGuard } from '../authentication/jwt/jwt-auth.guard';
import { FolderService } from './folder.service';
import { CreateFolderDto } from './dtos/create-folder.dto';
import { UpdateFolderDto } from './dtos/update-folder.dto';
import { MoveFolderDto } from './dtos/move-folder.dto';
import { DeleteFolderDto } from './dtos/delete-folder.dto';
import { AddDocumentToFolderDto } from './dtos/add-document-to-folder.dto';
import { RemoveDocumentFromFolderDto } from './dtos/remove-document-from-folder.dto';

@Controller('folders')
@UseGuards(JwtAuthGuard)
export class FolderController {
  constructor(private readonly folderService: FolderService) {}

  private getUserId(req: ExpressRequest & { user: { userId: string } }) {
    return req.user.userId;
  }

  @HttpCode(HttpStatus.OK)
  @Get()
  async getFolders(
    @Request() req: ExpressRequest & { user: { userId: string } },
  ) {
    const ownerId = this.getUserId(req);
    const result = await this.folderService.getFolders(ownerId);

    return {
      message: 'Folders retrieved successfully',
      total: result.total,
      folders: result.folders,
    };
  }

  @HttpCode(HttpStatus.OK)
  @Get(':id')
  async getFolderById(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: ExpressRequest & { user: { userId: string } },
  ) {
    const ownerId = this.getUserId(req);
    const folder = await this.folderService.getFolderById(id, ownerId);

    return {
      message: 'Folder retrieved successfully',
      folder,
    };
  }

  @HttpCode(HttpStatus.CREATED)
  @Post()
  async createFolder(
    @Body() dto: CreateFolderDto,
    @Request() req: ExpressRequest & { user: { userId: string } },
  ) {
    const ownerId = this.getUserId(req);
    const folder = await this.folderService.createFolder(dto, ownerId);

    return {
      message: 'Folder created successfully',
      folder,
    };
  }

  @HttpCode(HttpStatus.OK)
  @Patch('update')
  async updateFolder(
    @Body() dto: UpdateFolderDto,
    @Request() req: ExpressRequest & { user: { userId: string } },
  ) {
    const ownerId = this.getUserId(req);
    const folder = await this.folderService.updateFolder(dto, ownerId);

    return {
      message: 'Folder updated successfully',
      folder,
    };
  }

  @HttpCode(HttpStatus.OK)
  @Patch('move')
  async moveFolder(
    @Body() dto: MoveFolderDto,
    @Request() req: ExpressRequest & { user: { userId: string } },
  ) {
    const ownerId = this.getUserId(req);
    const folder = await this.folderService.moveFolder(dto, ownerId);

    return {
      message: 'Folder moved successfully',
      folder,
    };
  }

  @HttpCode(HttpStatus.OK)
  @Delete('delete')
  async deleteFolder(
    @Body() dto: DeleteFolderDto,
    @Request() req: ExpressRequest & { user: { userId: string } },
  ) {
    const ownerId = this.getUserId(req);
    return this.folderService.deleteFolder(ownerId, dto.folderId);
  }

  @HttpCode(HttpStatus.OK)
  @Post('documents/add')
  async addDocumentToFolder(
    @Body() dto: AddDocumentToFolderDto,
    @Request() req: ExpressRequest & { user: { userId: string } },
  ) {
    const ownerId = this.getUserId(req);
    return this.folderService.addDocumentToFolder(
      dto.folderId,
      dto.documentId,
      ownerId,
    );
  }

  @HttpCode(HttpStatus.OK)
  @Delete('documents/remove')
  async removeDocumentFromFolder(
    @Body() dto: RemoveDocumentFromFolderDto,
    @Request() req: ExpressRequest & { user: { userId: string } },
  ) {
    const ownerId = this.getUserId(req);
    return this.folderService.removeDocumentFromFolder(
      dto.folderId,
      dto.documentId,
      ownerId,
    );
  }

  @HttpCode(HttpStatus.OK)
  @Get(':folderId/documents')
  async getDocumentsByFolder(
    @Param('folderId', ParseUUIDPipe) folderId: string,
    @Request() req: ExpressRequest & { user: { userId: string } },
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '5',
  ) {
    const ownerId = this.getUserId(req);
    const result = await this.folderService.getDocumentsByFolder(
      folderId,
      ownerId,
      Number(page) || 1,
      Number(limit) || 5,
    );

    return {
      message: 'Documents retrieved successfully',
      total: result.total,
      currentPage: result.currentPage,
      totalPages: result.totalPages,
      documents: result.documents,
    };
  }
}
