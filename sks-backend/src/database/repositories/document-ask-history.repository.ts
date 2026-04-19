import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { BaseRepository } from './base.repository';
import { DocumentAskHistory } from '../entities/document-ask-history.entity';

@Injectable()
export class DocumentAskHistoryRepository extends BaseRepository<DocumentAskHistory> {
  constructor(private readonly ds: DataSource) {
    super(ds, DocumentAskHistory);
  }

  async findByUserAndDocument(
    userId: string,
    documentId: string,
  ): Promise<DocumentAskHistory[]> {
    return this.repository
      .createQueryBuilder('history')
      .where('history.user_id = :userId', { userId })
      .andWhere('history.document_id = :documentId', { documentId })
      .orderBy('history.created_at', 'ASC')
      .getMany();
  }

  async findRecentByUserAndDocument(
    userId: string,
    documentId: string,
    limit: number,
  ): Promise<DocumentAskHistory[]> {
    return this.repository
      .createQueryBuilder('history')
      .where('history.user_id = :userId', { userId })
      .andWhere('history.document_id = :documentId', { documentId })
      .orderBy('history.created_at', 'DESC')
      .addOrderBy('history.id', 'DESC')
      .limit(limit)
      .getMany();
  }

  async trimToLatestByUserAndDocument(
    userId: string,
    documentId: string,
    keepCount: number,
  ): Promise<number> {
    if (keepCount <= 0) {
      return this.clearByUserAndDocument(userId, documentId);
    }

    const entriesToKeep = await this.repository
      .createQueryBuilder('history')
      .select('history.id', 'id')
      .where('history.user_id = :userId', { userId })
      .andWhere('history.document_id = :documentId', { documentId })
      .orderBy('history.created_at', 'DESC')
      .addOrderBy('history.id', 'DESC')
      .limit(keepCount)
      .getRawMany<{ id: string }>();
    const keepIds = entriesToKeep
      .map((entry) => entry.id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);

    if (keepIds.length === 0) {
      return this.clearByUserAndDocument(userId, documentId);
    }

    const result = await this.repository
      .createQueryBuilder()
      .delete()
      .from(DocumentAskHistory)
      .where('user_id = :userId', { userId })
      .andWhere('document_id = :documentId', { documentId })
      .andWhere('id NOT IN (:...keepIds)', { keepIds })
      .execute();

    return result.affected ?? 0;
  }

  async clearByUserAndDocument(
    userId: string,
    documentId: string,
  ): Promise<number> {
    const result = await this.repository
      .createQueryBuilder()
      .delete()
      .from(DocumentAskHistory)
      .where('user_id = :userId', { userId })
      .andWhere('document_id = :documentId', { documentId })
      .execute();

    return result.affected ?? 0;
  }
}
