import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, IsNull } from 'typeorm';
import { Folder } from 'src/database/entities/folder.entity';
import { UserDocument } from 'src/database/entities/user-document.entity';
import { FolderRepository } from 'src/database/repositories/folder.repository';
import { DocumentRepository } from 'src/database/repositories/document.repository';
import { UserDocumentRepository } from 'src/database/repositories/user-document.repository';
import { CreateFolderDto } from './dtos/create-folder.dto';
import { UpdateFolderDto } from './dtos/update-folder.dto';
import { MoveFolderDto } from './dtos/move-folder.dto';

@Injectable()
export class FolderService {
  constructor(
    private readonly folderRepository: FolderRepository,
    private readonly documentRepository: DocumentRepository,
    private readonly userDocumentRepository: UserDocumentRepository,
    private readonly dataSource: DataSource,
  ) {}

  async ensureRootFolder(ownerId: string): Promise<Folder> {
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

  async getFolders(ownerId: string) {
    await this.ensureRootFolder(ownerId);
    const folders = await this.folderRepository.findByOwner(ownerId);
    const folderMap = new Map<string, Folder>();

    folders.forEach((folder) => {
      folder.children = [];
      folderMap.set(folder.id, folder);
    });

    for (const folder of folders) {
      if (folder.parentId) {
        const parent = folderMap.get(folder.parentId);
        if (parent) {
          parent.children.push(folder);
        }
      }
    }

    const roots = folders.filter((folder) => !folder.parentId);

    return {
      total: roots.length,
      folders: roots,
    };
  }

  async getFolderById(folderId: string, ownerId: string): Promise<Folder> {
    const folder = await this.folderRepository.findOne({
      where: { id: folderId, ownerId },
      relations: ['children', 'userDocuments'],
    });

    if (!folder) {
      throw new NotFoundException('Folder not found');
    }

    return folder;
  }

  async createFolder(dto: CreateFolderDto, ownerId: string): Promise<Folder> {
    const parentId = dto.parentId || (await this.ensureRootFolder(ownerId)).id;

    if (dto.parentId) {
      const parent = await this.folderRepository.findOne({
        where: { id: dto.parentId, ownerId },
      });

      if (!parent) {
        throw new BadRequestException('Invalid parent folder');
      }
    }

    const duplicate = await this.folderRepository.findOne({
      where: {
        ownerId,
        parentId: parentId ?? IsNull(),
        name: dto.name,
      },
    });

    if (duplicate) {
      throw new BadRequestException(
        'A folder with this name already exists in this location',
      );
    }

    return this.folderRepository.create({
      ownerId,
      name: dto.name,
      parentId,
    });
  }

  async updateFolder(dto: UpdateFolderDto, ownerId: string): Promise<Folder> {
    const folder = await this.getFolderById(dto.folderId, ownerId);

    let parentId = folder.parentId;
    if (dto.parentId !== undefined) {
      if (dto.parentId === dto.folderId) {
        throw new BadRequestException('Folder cannot be its own parent');
      }

      const parent = await this.folderRepository.findOne({
        where: { id: dto.parentId, ownerId },
      });

      if (!parent) {
        throw new BadRequestException('Invalid parent folder');
      }

      parentId = dto.parentId;
    }

    const duplicate = await this.folderRepository.findOne({
      where: {
        ownerId,
        parentId: parentId ?? IsNull(),
        name: dto.name,
      },
    });

    if (duplicate && duplicate.id !== dto.folderId) {
      throw new BadRequestException(
        'A folder with this name already exists in this location',
      );
    }

    const updated = await this.folderRepository.update(dto.folderId, {
      name: dto.name,
      parentId,
    });

    if (!updated) {
      throw new NotFoundException('Folder not found');
    }

    return updated;
  }

  async moveFolder(dto: MoveFolderDto, ownerId: string): Promise<Folder> {
    const folder = await this.getFolderById(dto.folderId, ownerId);

    if (!folder.parentId) {
      throw new BadRequestException('Cannot move root folder');
    }

    const nextParentId =
      dto.newParentId || (await this.ensureRootFolder(ownerId)).id;

    if (nextParentId === dto.folderId) {
      throw new BadRequestException('Cannot move folder into itself');
    }

    const nextParent = await this.folderRepository.findOne({
      where: { id: nextParentId, ownerId },
    });

    if (!nextParent) {
      throw new BadRequestException('Invalid parent folder');
    }

    const isDescendant = await this.isDescendant(
      dto.folderId,
      nextParentId,
      ownerId,
    );
    if (isDescendant) {
      throw new BadRequestException(
        'Cannot move folder into one of its descendants',
      );
    }

    const updated = await this.folderRepository.update(dto.folderId, {
      parentId: nextParentId,
    });

    if (!updated) {
      throw new NotFoundException('Folder not found');
    }

    return updated;
  }

  async deleteFolder(ownerId: string, folderId: string) {
    const folder = await this.getFolderById(folderId, ownerId);

    if (!folder.parentId) {
      throw new BadRequestException('Cannot delete root folder');
    }

    const parentId = folder.parentId;

    await this.dataSource.transaction(async (manager) => {
      await manager.query(
        `UPDATE user_documents SET folder_id = $1 WHERE folder_id = $2 AND user_id = $3`,
        [parentId, folderId, ownerId],
      );

      await manager
        .getRepository(Folder)
        .createQueryBuilder()
        .update(Folder)
        .set({ parentId })
        .where('parent_id = :folderId AND owner_id = :ownerId', {
          folderId,
          ownerId,
        })
        .execute();

      await manager.getRepository(Folder).delete({ id: folderId, ownerId });
    });

    return { message: 'Folder deleted successfully' };
  }

  async addDocumentToFolder(
    folderId: string,
    documentId: string,
    ownerId: string,
  ) {
    const folder = await this.folderRepository.findOne({
      where: { id: folderId, ownerId },
    });

    if (!folder) {
      throw new NotFoundException('Folder not found');
    }

    const document = await this.documentRepository.findByIdAndOwner(
      documentId,
      ownerId,
    );

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    const updated = await this.userDocumentRepository
      .getRepository()
      .createQueryBuilder()
      .update(UserDocument)
      .set({ folder: { id: folderId } })
      .where('user_id = :ownerId AND document_id = :documentId', {
        ownerId,
        documentId,
      })
      .execute();

    if ((updated.affected ?? 0) === 0) {
      throw new NotFoundException('Document relation not found');
    }

    return { message: 'Document added to folder successfully' };
  }

  async removeDocumentFromFolder(
    folderId: string,
    documentId: string,
    ownerId: string,
  ) {
    const rootFolder = await this.ensureRootFolder(ownerId);

    const updated = await this.userDocumentRepository
      .getRepository()
      .createQueryBuilder()
      .update(UserDocument)
      .set({ folder: { id: rootFolder.id } })
      .where(
        'user_id = :ownerId AND document_id = :documentId AND folder_id = :folderId',
        {
          ownerId,
          documentId,
          folderId,
        },
      )
      .execute();

    if ((updated.affected ?? 0) === 0) {
      throw new NotFoundException('Document not found in this folder');
    }

    return { message: 'Document removed from folder successfully' };
  }

  async getDocumentsByFolder(
    folderId: string,
    ownerId: string,
    page: number = 1,
    limit: number = 5,
  ) {
    const folder = await this.folderRepository.findOne({
      where: { id: folderId, ownerId },
    });

    if (!folder) {
      throw new NotFoundException('Folder not found');
    }

    const offset = (page - 1) * limit;
    const query = this.userDocumentRepository
      .getRepository()
      .createQueryBuilder('userDocument')
      .leftJoinAndSelect('userDocument.document', 'document')
      .leftJoin('userDocument.user', 'user')
      .leftJoin('userDocument.folder', 'folder')
      .where('user.id = :ownerId', { ownerId })
      .orderBy('document.createdAt', 'DESC')
      .skip(offset)
      .take(limit);

    if (!folder.parentId) {
      query.andWhere('(folder.id = :folderId OR userDocument.folder IS NULL)', {
        folderId,
      });
    } else {
      query.andWhere('folder.id = :folderId', { folderId });
    }

    const [userDocuments, total] = await query.getManyAndCount();

    return {
      total,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      documents: userDocuments.map((userDoc) => ({
        ...userDoc.document,
        title: userDoc.documentName || userDoc.document?.title,
        isFavorite: userDoc.isFavorite,
        formattedFileSize: this.formatFileSize(userDoc.document?.fileSize || 0),
      })),
    };
  }

  private async isDescendant(
    sourceFolderId: string,
    targetParentId: string,
    ownerId: string,
  ): Promise<boolean> {
    const allFolders = await this.folderRepository.findByOwner(ownerId);
    const childrenMap = new Map<string, string[]>();

    allFolders.forEach((folder) => {
      if (!folder.parentId) {
        return;
      }

      const current = childrenMap.get(folder.parentId) || [];
      current.push(folder.id);
      childrenMap.set(folder.parentId, current);
    });

    const stack = [...(childrenMap.get(sourceFolderId) || [])];
    while (stack.length > 0) {
      const current = stack.pop() as string;
      if (current === targetParentId) {
        return true;
      }

      stack.push(...(childrenMap.get(current) || []));
    }

    return false;
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
