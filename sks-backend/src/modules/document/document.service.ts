import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { DocumentDto } from './dtos/document.dto';
import { Document } from 'src/database/entities/document.entity';
import { Chunk } from 'src/database/entities/chunks.entity';
import { UserDocument } from 'src/database/entities/user-document.entity';
import { DocumentRepository } from 'src/database/repositories/document.repository';
import { ChunkRepository } from 'src/database/repositories/chunks.repository';
import { UserDocumentRepository } from 'src/database/repositories/user-document.repository';
import { FolderRepository } from 'src/database/repositories/folder.repository';

import { DataSource, IsNull } from 'typeorm';

import * as crypto from 'crypto';
import { PDFParse } from 'pdf-parse';
import * as mammoth from 'mammoth';
import { promises as fs } from 'fs';
import * as path from 'path';

type CreatedDocumentResult = {
  id: string;
  title: string | null;
  metadata: Document['metadata'];
  docDate: Date | null;
  extraAttributes: Document['extraAttributes'];
  fileRef: string | null;
  contentHash: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  chunks: Chunk[];
};

type UploadDocumentResult = {
  id: string;
  ownerId: string;
  title: string | null;
  fileName: string | null;
  totalChunks: number;
};

type UserDocumentAccessRow = {
  fileRef: string | null;
};

@Injectable()
export class DocumentService {
  private readonly logger = new Logger(DocumentService.name);
  private readonly uploadsDirectory = path.resolve(process.cwd(), 'uploads');

  constructor(
    private readonly documentRepository: DocumentRepository,
    private readonly chunkRepository: ChunkRepository,
    private readonly userDocumentRepository: UserDocumentRepository,
    private readonly folderRepository: FolderRepository,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Create document record in DB (with chunks)
   */
  async createDocument(
    dto: DocumentDto,
    contentHash?: string,
  ): Promise<CreatedDocumentResult> {
    return this.dataSource.transaction(async (manager) => {
      // Save the document
      const document = manager.create(Document, {
        title: dto.title,
        metadata: dto.metadata || {},
        docDate: dto.docDate || undefined,
        extraAttributes: dto.extraAttributes || {},
        fileRef: dto.fileRef,
        fileSize: dto.fileSize,
        contentHash:
          contentHash ||
          this.generateContentHash(Buffer.from(dto.chunks?.join(' ') || '')),
        status: 'processed',
      });

      const savedDocument = await manager.save(Document, document);

      // Create and save chunks
      const chunks: Chunk[] = (dto.chunks || []).map((chunkText, idx) =>
        manager.create(Chunk, {
          documents: [savedDocument],
          chunkIndex: idx,
          chunkText: chunkText,
          tokenCount: chunkText.split(/\s+/).length,
        }),
      );

      const savedChunks = await manager.save(Chunk, chunks);

      // Link chunks to document
      savedDocument.chunks = savedChunks;
      await manager.save(Document, savedDocument);

      return {
        id: savedDocument.id,
        title: savedDocument.title,
        metadata: savedDocument.metadata,
        docDate: savedDocument.docDate,
        extraAttributes: savedDocument.extraAttributes,
        fileRef: savedDocument.fileRef,
        contentHash: savedDocument.contentHash,
        status: savedDocument.status,
        createdAt: savedDocument.createdAt,
        updatedAt: savedDocument.updatedAt,
        chunks: savedDocument.chunks,
      };
    });
  }

  /**
   * Handle document duplication logic
   */
  private async handleDocumentDuplication(
    contentHash: string,
    ownerId: string,
  ): Promise<Document | null> {
    const existingDoc = await this.documentRepository.findOne({
      where: { contentHash },
      relations: ['chunks'],
    });

    if (!existingDoc) {
      return null;
    }

    // Check if same user already has it
    const userDoc = await this.documentRepository.findByContentHashAndUser(
      contentHash,
      ownerId,
    );
    if (userDoc) {
      throw new BadRequestException('Duplicate file upload');
    } else {
      // Different user – link existing document
      await this.userDocumentRepository.create({
        user: { id: ownerId },
        document: { id: existingDoc.id },
        isFavorite: false,
      });
      return existingDoc;
    }
  }

  /**
   * Extract text from file based on mimetype
   */
  private async extractTextFromFile(
    file: Express.Multer.File,
  ): Promise<string> {
    let text = '';

    switch (file.mimetype) {
      case 'application/pdf': {
        const parser = new PDFParse({ data: new Uint8Array(file.buffer) });
        const pdfResult = await parser.getText();
        text = pdfResult.text;
        break;
      }

      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
        const docxData = await mammoth.extractRawText({ buffer: file.buffer });
        text = docxData.value;
        break;
      }

      case 'text/plain': {
        text = file.buffer.toString('utf-8');
        break;
      }
      default:
        throw new BadRequestException(
          `Unsupported file type: ${file.mimetype}`,
        );
    }

    // Remove null bytes
    text = text.split(String.fromCharCode(0)).join('');

    if (!text.trim()) {
      throw new BadRequestException('Unable to extract text from file');
    }

    return text;
  }

  private async ensureRootFolder(ownerId: string) {
    const existingRoot = await this.folderRepository.findOne({
      where: { ownerId, parentId: IsNull() },
    });

    if (existingRoot) {
      return existingRoot;
    }

    return this.folderRepository.create({
      ownerId,
      name: 'Root',
      parentId: null,
    });
  }

  /**
   * Upload file -> extract text -> chunk -> save to DB
   */
  async uploadDocument(
    file: Express.Multer.File,
    dto: DocumentDto,
    ownerId: string,
  ): Promise<UploadDocumentResult> {
    try {
      if (!file || !file.buffer || file.buffer.length === 0) {
        throw new BadRequestException('File not retrieved or empty');
      }

      if (!dto.title || dto.title.trim().length === 0) {
        dto.title = file.originalname;
      }

      // Generate content hash for deduplication
      const contentHash = this.generateContentHash(file.buffer);

      // Handle duplication
      const duplicateDoc = await this.handleDocumentDuplication(
        contentHash,
        ownerId,
      );
      if (duplicateDoc) {
        let targetFolderId = dto.folderId;
        if (targetFolderId) {
          const folder = await this.folderRepository.findOne({
            where: { id: targetFolderId, ownerId },
          });

          if (!folder) {
            throw new BadRequestException('Invalid folder selected');
          }
        } else {
          targetFolderId = (await this.ensureRootFolder(ownerId)).id;
        }

        const userDocument = await this.userDocumentRepository.findOne({
          where: {
            user: { id: ownerId },
            document: { id: duplicateDoc.id },
          },
          relations: ['folder'],
        });

        if (userDocument) {
          userDocument.folder = { id: targetFolderId } as never;
          userDocument.documentName = dto.title || file.originalname;
          await this.userDocumentRepository.getRepository().save(userDocument);
        }

        return {
          id: duplicateDoc.id,
          ownerId,
          title: duplicateDoc.title,
          fileName: duplicateDoc.fileRef,
          totalChunks: duplicateDoc.chunks.length,
        };
      }

      // Save file to disk
      const uniqueName = `${crypto.randomUUID()}-${file.originalname}`;
      await fs.mkdir(this.uploadsDirectory, { recursive: true });
      const filePath = path.join(this.uploadsDirectory, uniqueName);
      await fs.writeFile(filePath, file.buffer);

      // Extract text from file
      const text = await this.extractTextFromFile(file);

      // Chunk the text
      const chunks = this.chunkText(text, 1000);

      // Create document record
      const documentDto: DocumentDto = {
        title: dto.title || file.originalname,
        metadata: dto.metadata || {},
        docDate: dto.docDate,
        extraAttributes: dto.extraAttributes || {},
        fileRef: filePath,
        fileSize: file.size,
        chunks,
      };

      const createdDoc = await this.createDocument(documentDto, contentHash);

      let targetFolderId = dto.folderId;
      if (targetFolderId) {
        const folder = await this.folderRepository.findOne({
          where: { id: targetFolderId, ownerId },
        });

        if (!folder) {
          throw new BadRequestException('Invalid folder selected');
        }
      } else {
        targetFolderId = (await this.ensureRootFolder(ownerId)).id;
      }

      // Create UserDocument relation
      await this.userDocumentRepository.create({
        user: { id: ownerId },
        document: { id: createdDoc.id },
        folder: { id: targetFolderId },
        documentName: dto.title || file.originalname,
        isFavorite: false,
      });

      return {
        id: createdDoc.id,
        ownerId,
        title: createdDoc.title,
        fileName: createdDoc.fileRef,
        totalChunks: createdDoc.chunks.length,
      };
    } catch (error: unknown) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(
        `Upload document failed: ${this.getErrorMessage(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new BadRequestException(
        'Document upload failed due to server error',
      );
    }
  }

  /**
   * Chunk text into pieces of maxLength characters
   */
  private chunkText(text: string, maxLength: number): string[] {
    const result: string[] = [];
    let current = '';
    const words = text.split(/\s+/);

    for (const word of words) {
      if ((current + ' ' + word).length > maxLength) {
        if (current.trim()) {
          result.push(current.trim());
        }
        current = word;
      } else {
        current += ' ' + word;
      }
    }

    if (current.trim()) {
      result.push(current.trim());
    }
    return result;
  }

  /**
   * Generate SHA-256 content hash
   */
  private generateContentHash(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Get all documents for a user with pagination
   */
  async getDocuments(ownerId: string, page: number = 1, limit: number = 5) {
    try {
      const offset = (page - 1) * limit;

      const queryBuilder = this.dataSource
        .createQueryBuilder(UserDocument, 'userDocument')
        .leftJoin('userDocument.document', 'document')
        .leftJoin('userDocument.user', 'user')
        .leftJoinAndSelect('userDocument.folder', 'folder')
        .select([
          'userDocument.id',
          'userDocument.isFavorite',
          'userDocument.documentName',
          'document.id',
          'document.metadata',
          'document.docDate',
          'document.extraAttributes',
          'document.fileRef',
          'document.fileSize',
          'document.contentHash',
          'document.status',
          'document.createdAt',
          'document.updatedAt',
          'folder.id',
          'folder.name',
        ])
        .where('user.id = :ownerId', { ownerId })
        .orderBy('document.createdAt', 'DESC')
        .skip(offset)
        .take(limit);

      const [userDocuments, total] = await queryBuilder.getManyAndCount();

      const totalPages = Math.ceil(total / limit);

      const documents = userDocuments.map((userDoc) =>
        this.toDocumentSummary(userDoc),
      );

      this.logger.debug(
        `Retrieved ${documents.length} documents for owner ${ownerId}`,
      );

      return {
        total,
        currentPage: page,
        totalPages,
        documents,
      };
    } catch (error: unknown) {
      this.logger.error(
        `Failed to retrieve documents for owner ${ownerId}: ${this.getErrorMessage(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new BadRequestException(
        'Unable to retrieve documents due to server connection issue',
      );
    }
  }

  /**
   * Delete document for a user
   */
  async deleteDocument(
    ownerId: string,
    documentId: string,
  ): Promise<{ message: string }> {
    return this.dataSource.transaction(async (manager) => {
      const documentRepo = manager.getRepository(Document);
      const chunkRepo = manager.getRepository(Chunk);
      const userDocumentRepo = manager.getRepository(UserDocument);

      // Check user access
      const userDocument = await userDocumentRepo
        .createQueryBuilder('userDocument')
        .leftJoin('userDocument.document', 'document')
        .leftJoin('userDocument.user', 'user')
        .select('userDocument.id')
        .addSelect('document.file_ref', 'fileRef')
        .where('document.id = :id AND user.id = :ownerId', {
          id: documentId,
          ownerId,
        })
        .getRawOne<UserDocumentAccessRow>();

      if (!userDocument) {
        throw new NotFoundException('Document not found or not owned by user');
      }

      const fileRef = userDocument.fileRef;

      // Get chunks
      const chunks = await chunkRepo.find({
        where: { documents: { id: documentId } },
        select: ['id'],
      });
      const chunkIds = chunks.map((c) => c.id);

      // Remove UserDocument entry
      await userDocumentRepo.delete({
        user: { id: ownerId },
        document: { id: documentId },
      });

      // Check if other users still have this document
      const remainingUserDocs = await userDocumentRepo.count({
        where: { document: { id: documentId } },
      });

      if (remainingUserDocs > 0) {
        return { message: 'Document removed from your library' };
      }

      // No other users — full deletion
      const chunksToDelete: string[] = [];
      for (const chunkId of chunkIds) {
        const relatedDocs = await chunkRepo
          .createQueryBuilder('chunk')
          .leftJoin('chunk.documents', 'document')
          .where('chunk.id = :chunkId', { chunkId })
          .getCount();

        if (relatedDocs === 1) {
          chunksToDelete.push(chunkId);
        }
      }

      await documentRepo.delete({ id: documentId });

      for (const chunkId of chunksToDelete) {
        await chunkRepo.delete({ id: chunkId });
      }

      // Delete file from disk
      if (fileRef) {
        await fs.rm(fileRef, { force: true });
      }

      return { message: 'Document removed successfully' };
    });
  }

  /**
   * Toggle favorite status
   */
  async toggleFavorite(userId: string, documentId: string) {
    try {
      return await this.userDocumentRepository.toggleFavorite(
        userId,
        documentId,
      );
    } catch (error: unknown) {
      this.logger.error(
        `Failed to toggle favorite: ${this.getErrorMessage(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new BadRequestException('Unable to toggle favorite');
    }
  }

  /**
   * Get favorite documents
   */
  async getFavorites(userId: string) {
    try {
      const favorites = await this.userDocumentRepository.getFavorites(userId);
      return favorites.map((userDoc) => this.toDocumentSummary(userDoc));
    } catch (error: unknown) {
      this.logger.error(
        `Failed to get favorites: ${this.getErrorMessage(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new BadRequestException('Unable to retrieve favorites');
    }
  }

  async searchDocuments(query: string, ownerId: string, limit: number = 10) {
    const keyword = query.trim();

    if (!keyword) {
      return {
        relatedTitleDocuments: [],
        relatedContentDocuments: [],
      };
    }

    try {
      const titleMatches = await this.dataSource
        .createQueryBuilder(UserDocument, 'userDocument')
        .leftJoin('userDocument.document', 'document')
        .leftJoin('userDocument.user', 'user')
        .leftJoinAndSelect('userDocument.folder', 'folder')
        .select([
          'userDocument.id',
          'userDocument.isFavorite',
          'userDocument.documentName',
          'document.id',
          'document.metadata',
          'document.docDate',
          'document.extraAttributes',
          'document.fileRef',
          'document.fileSize',
          'document.contentHash',
          'document.status',
          'document.createdAt',
          'document.updatedAt',
          'folder.id',
          'folder.name',
        ])
        .where('user.id = :ownerId', { ownerId })
        .andWhere(
          "LOWER(COALESCE(userDocument.documentName, document.title, '')) LIKE LOWER(:query)",
          {
            query: `%${keyword}%`,
          },
        )
        .orderBy('document.createdAt', 'DESC')
        .take(limit)
        .getMany();

      const titleDocuments = titleMatches.map((userDoc) =>
        this.toDocumentSummary(userDoc),
      );

      const excludedIds = titleDocuments.map((document) => document.id);

      const chunkMatches = await this.dataSource
        .createQueryBuilder(UserDocument, 'userDocument')
        .leftJoin('userDocument.document', 'document')
        .leftJoin('userDocument.user', 'user')
        .leftJoinAndSelect('userDocument.folder', 'folder')
        .leftJoin('document.chunks', 'chunk')
        .select([
          'userDocument.id',
          'userDocument.isFavorite',
          'userDocument.documentName',
          'document.id',
          'document.metadata',
          'document.docDate',
          'document.extraAttributes',
          'document.fileRef',
          'document.fileSize',
          'document.contentHash',
          'document.status',
          'document.createdAt',
          'document.updatedAt',
          'folder.id',
          'folder.name',
        ])
        .where('user.id = :ownerId', { ownerId })
        .andWhere('LOWER(chunk.chunkText) LIKE LOWER(:query)', {
          query: `%${keyword}%`,
        })
        .andWhere(
          excludedIds.length > 0
            ? 'document.id NOT IN (:...excludedIds)'
            : '1 = 1',
          { excludedIds },
        )
        .groupBy('userDocument.id')
        .addGroupBy('document.id')
        .addGroupBy('folder.id')
        .addGroupBy('folder.name')
        .orderBy('document.createdAt', 'DESC')
        .take(limit)
        .getMany();

      const contentDocuments = chunkMatches.map((userDoc) =>
        this.toDocumentSummary(userDoc),
      );

      return {
        relatedTitleDocuments: titleDocuments,
        relatedContentDocuments: contentDocuments,
      };
    } catch (error: unknown) {
      this.logger.error(
        `Failed to search documents for owner ${ownerId}: ${this.getErrorMessage(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new BadRequestException('Unable to search documents');
    }
  }

  async getRelatedDocuments(
    documentId: string,
    ownerId: string,
    limit: number = 6,
  ) {
    try {
      const sourceDocument = await this.documentRepository.findByIdAndOwner(
        documentId,
        ownerId,
      );

      if (!sourceDocument) {
        throw new NotFoundException('Document not found or not owned by user');
      }

      const sourceTitle = (sourceDocument.title || '').toLowerCase();
      const sourceKeywords = new Set<string>();

      sourceTitle
        .split(/[^a-zA-Z0-9]+/)
        .filter((word) => word.length > 2)
        .forEach((word) => sourceKeywords.add(word));

      const metadataKeywords = Array.isArray(sourceDocument.metadata?.keywords)
        ? sourceDocument.metadata.keywords
        : [];

      metadataKeywords
        .map((keyword) => String(keyword).toLowerCase())
        .filter((keyword) => keyword.length > 2)
        .forEach((keyword) => sourceKeywords.add(keyword));

      if (sourceKeywords.size === 0) {
        return { total: 0, documents: [] };
      }

      const matches = await this.dataSource
        .createQueryBuilder(UserDocument, 'userDocument')
        .leftJoin('userDocument.document', 'document')
        .leftJoin('userDocument.user', 'user')
        .leftJoinAndSelect('userDocument.folder', 'folder')
        .select([
          'userDocument.id',
          'userDocument.isFavorite',
          'userDocument.documentName',
          'document.id',
          'document.metadata',
          'document.docDate',
          'document.extraAttributes',
          'document.fileRef',
          'document.fileSize',
          'document.contentHash',
          'document.status',
          'document.createdAt',
          'document.updatedAt',
          'folder.id',
          'folder.name',
        ])
        .where('user.id = :ownerId', { ownerId })
        .andWhere('document.id != :documentId', { documentId })
        .orderBy('document.createdAt', 'DESC')
        .getMany();

      const ranked = matches
        .map((userDoc) => {
          const title = (
            userDoc.documentName ||
            userDoc.document?.title ||
            ''
          ).toLowerCase();
          const keywords = new Set<string>();

          title
            .split(/[^a-zA-Z0-9]+/)
            .filter((word) => word.length > 2)
            .forEach((word) => keywords.add(word));

          const metadataValues = Array.isArray(
            userDoc.document?.metadata?.keywords,
          )
            ? userDoc.document.metadata.keywords
            : [];

          metadataValues
            .map((keyword) => String(keyword).toLowerCase())
            .filter((keyword) => keyword.length > 2)
            .forEach((keyword) => keywords.add(keyword));

          let score = 0;
          sourceKeywords.forEach((keyword) => {
            if (keywords.has(keyword)) {
              score += 1;
            }
          });

          return {
            ...this.toDocumentSummary(userDoc),
            relatedScore: score,
          };
        })
        .filter((document) => document.relatedScore > 0)
        .sort((left, right) => right.relatedScore - left.relatedScore)
        .slice(0, limit)
        .map((document) => {
          const { relatedScore, ...rest } = document;
          void relatedScore;
          return rest;
        });

      return {
        total: ranked.length,
        documents: ranked,
      };
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(
        `Failed to get related documents for owner ${ownerId}: ${this.getErrorMessage(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new BadRequestException('Unable to retrieve related documents');
    }
  }

  /**
   * Get document details for a user
   * Supports both Document ID and UserDocument ID for robustness
   */
  async getDocumentDetails(documentId: string, ownerId: string) {
    let userDocument = await this.dataSource
      .getRepository(UserDocument)
      .createQueryBuilder('userDocument')
      .leftJoinAndSelect('userDocument.document', 'document')
      .leftJoinAndSelect('userDocument.folder', 'folder')
      .leftJoin('userDocument.user', 'user')
      .where('document.id = :documentId', { documentId })
      .andWhere('user.id = :ownerId', { ownerId })
      .getOne();

    // If not found, try by UserDocument ID
    if (!userDocument) {
      userDocument = await this.dataSource
        .getRepository(UserDocument)
        .createQueryBuilder('userDocument')
        .leftJoinAndSelect('userDocument.document', 'document')
        .leftJoinAndSelect('userDocument.folder', 'folder')
        .leftJoin('userDocument.user', 'user')
        .where('userDocument.id = :documentId', { documentId })
        .andWhere('user.id = :ownerId', { ownerId })
        .getOne();
    }

    if (!userDocument) {
      throw new NotFoundException('Document not found or not owned by user');
    }

    return this.toDocumentSummary(userDocument);
  }

  /**
   * Get document file path for serving
   * Supports both Document ID and UserDocument ID for robustness
   */
  async getDocumentFilePath(
    documentId: string,
    ownerId: string,
  ): Promise<string> {
    // Try to find by Document ID first
    let document = await this.documentRepository.findByIdAndOwner(
      documentId,
      ownerId,
    );

    // If not found, try to find by UserDocument ID
    if (!document) {
      const userDoc = await this.dataSource
        .getRepository(UserDocument)
        .findOne({
          where: { id: documentId, user: { id: ownerId } },
          relations: ['document'],
        });

      if (userDoc?.document) {
        document = userDoc.document;
      }
    }

    if (!document) {
      this.logger.warn(
        `File request failed: Document ${documentId} not found for owner ${ownerId}`,
      );
      throw new NotFoundException('Document not found or not owned by user');
    }

    try {
      await fs.access(document.fileRef);
    } catch {
      this.logger.error(`File missing on disk: ${document.fileRef}`);
      throw new BadRequestException('Document file not found on server');
    }

    return document.fileRef;
  }

  /**
   * Update document name
   */
  async updateDocumentName(
    userId: string,
    documentId: string,
    newName: string,
  ) {
    const userDocument = await this.dataSource
      .getRepository(UserDocument)
      .findOne({
        where: { user: { id: userId }, document: { id: documentId } },
      });

    if (!userDocument) {
      throw new NotFoundException('Document not found or not owned by user');
    }

    userDocument.documentName = newName;
    await this.dataSource.getRepository(UserDocument).save(userDocument);

    return { message: 'Document name updated successfully' };
  }

  private toDocumentSummary(
    userDoc: UserDocument & {
      document: Document;
      folder?: { id?: string; name?: string } | null;
    },
  ) {
    return {
      ...userDoc.document,
      title: userDoc.documentName || userDoc.document?.title,
      isFavorite: userDoc.isFavorite,
      formattedFileSize: this.formatFileSize(userDoc.document?.fileSize || 0),
      folderId: userDoc.folder?.id || null,
      folderName: userDoc.folder?.name || 'Workspace',
    };
  }

  /**
   * Format file size to human readable
   */
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Unknown error';
  }
}
