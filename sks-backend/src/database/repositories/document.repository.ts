import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { BaseRepository } from './base.repository';
import { Document } from '../entities/document.entity';

@Injectable()
export class DocumentRepository extends BaseRepository<Document> {
  constructor(private readonly ds: DataSource) {
    super(ds, Document);
  }

  // Find documents by user (via userDocuments relation)
  async findByOwner(ownerId: string): Promise<Document[]> {
    return this.repository
      .createQueryBuilder('document')
      .leftJoin('document.userDocuments', 'userDocument')
      .leftJoin('userDocument.user', 'user')
      .where('user.id = :ownerId', { ownerId })
      .getMany();
  }

  // Check duplicate by content hash
  async findByContentHash(contentHash: string): Promise<Document | null> {
    return this.repository.findOne({
      where: { contentHash },
    });
  }

  // Find document by content hash and user
  async findByContentHashAndUser(
    contentHash: string,
    userId: string,
  ): Promise<Document | null> {
    return this.repository
      .createQueryBuilder('document')
      .leftJoin('document.userDocuments', 'userDocument')
      .leftJoin('userDocument.user', 'user')
      .where('document.contentHash = :contentHash', { contentHash })
      .andWhere('user.id = :userId', { userId })
      .getOne();
  }

  // Find document by ID and user with chunks
  async findByIdAndOwner(
    id: string,
    ownerId: string,
  ): Promise<Document | null> {
    return this.repository
      .createQueryBuilder('document')
      .leftJoinAndSelect('document.chunks', 'chunks')
      .leftJoin('document.userDocuments', 'userDocument')
      .leftJoin('userDocument.user', 'user')
      .where('document.id = :id', { id })
      .andWhere('user.id = :ownerId', { ownerId })
      .getOne();
  }
}
