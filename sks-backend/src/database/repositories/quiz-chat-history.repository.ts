import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { BaseRepository } from './base.repository';
import { QuizChatHistory } from '../entities/quiz-chat-history.entity';

@Injectable()
export class QuizChatHistoryRepository extends BaseRepository<QuizChatHistory> {
  constructor(private readonly ds: DataSource) {
    super(ds, QuizChatHistory);
  }

  async findRecentByUser(
    userId: string,
    limit: number,
  ): Promise<QuizChatHistory[]> {
    return this.repository
      .createQueryBuilder('history')
      .where('history.user_id = :userId', { userId })
      .orderBy('history.created_at', 'DESC')
      .addOrderBy('history.id', 'DESC')
      .limit(limit)
      .getMany();
  }

  async trimToLatestByUser(userId: string, keepCount: number): Promise<number> {
    if (keepCount <= 0) {
      return this.clearByUser(userId);
    }

    const entriesToKeep = await this.repository
      .createQueryBuilder('history')
      .select('history.id', 'id')
      .where('history.user_id = :userId', { userId })
      .orderBy('history.created_at', 'DESC')
      .addOrderBy('history.id', 'DESC')
      .limit(keepCount)
      .getRawMany<{ id: string }>();
    const keepIds = entriesToKeep
      .map((entry) => entry.id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);

    if (keepIds.length === 0) {
      return this.clearByUser(userId);
    }

    const result = await this.repository
      .createQueryBuilder()
      .delete()
      .from(QuizChatHistory)
      .where('user_id = :userId', { userId })
      .andWhere('id NOT IN (:...keepIds)', { keepIds })
      .execute();

    return result.affected ?? 0;
  }

  async clearByUser(userId: string): Promise<number> {
    const result = await this.repository
      .createQueryBuilder()
      .delete()
      .from(QuizChatHistory)
      .where('user_id = :userId', { userId })
      .execute();

    return result.affected ?? 0;
  }
}
