import { Injectable } from '@nestjs/common';
import { DataSource, IsNull } from 'typeorm';
import { BaseRepository } from './base.repository';
import { Folder } from '../entities/folder.entity';

@Injectable()
export class FolderRepository extends BaseRepository<Folder> {
  constructor(private readonly ds: DataSource) {
    super(ds, Folder);
  }

  async findByOwner(ownerId: string): Promise<Folder[]> {
    return this.repository.find({
      where: { ownerId },
      relations: ['children', 'userDocuments'],
      order: { createdAt: 'ASC' },
    });
  }

  async findRootFolders(ownerId: string): Promise<Folder[]> {
    return this.repository.find({
      where: { ownerId, parentId: IsNull() },
      relations: ['children', 'userDocuments'],
      order: { createdAt: 'ASC' },
    });
  }

  async findWithTree(folderId: string): Promise<Folder | null> {
    return this.repository.findOne({
      where: { id: folderId },
      relations: ['parent', 'children', 'userDocuments'],
    });
  }
}
