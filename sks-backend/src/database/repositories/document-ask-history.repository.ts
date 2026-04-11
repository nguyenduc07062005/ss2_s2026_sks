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
