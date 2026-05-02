import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { BaseRepository } from './base.repository';
import { StudyGpsDayChatMessage } from '../entities/study-gps-day-chat-message.entity';
import type { RagSource } from 'src/modules/rag/types/rag.types';

@Injectable()
export class StudyGpsDayChatMessageRepository extends BaseRepository<StudyGpsDayChatMessage> {
  constructor(private readonly ds: DataSource) {
    super(ds, StudyGpsDayChatMessage);
  }

  async findByPlanAndDay(
    userId: string,
    planId: string,
    day: number,
  ): Promise<StudyGpsDayChatMessage[]> {
    return this.repository
      .createQueryBuilder('message')
      .where('message.user_id = :userId', { userId })
      .andWhere('message.plan_id = :planId', { planId })
      .andWhere('message.day = :day', { day })
      .orderBy('message.created_at', 'ASC')
      .addOrderBy('message.id', 'ASC')
      .getMany();
  }

  async findRecentByPlanAndDay(
    userId: string,
    planId: string,
    day: number,
    limit: number,
  ): Promise<StudyGpsDayChatMessage[]> {
    return this.repository
      .createQueryBuilder('message')
      .where('message.user_id = :userId', { userId })
      .andWhere('message.plan_id = :planId', { planId })
      .andWhere('message.day = :day', { day })
      .orderBy('message.created_at', 'DESC')
      .addOrderBy('message.id', 'DESC')
      .limit(limit)
      .getMany();
  }

  async createMessage(data: {
    userId: string;
    planId: string;
    day: number;
    role: 'user' | 'assistant';
    content: string;
    sources?: RagSource[] | null;
  }): Promise<StudyGpsDayChatMessage> {
    return this.repository.save(
      this.repository.create({
        user: { id: data.userId },
        plan: { id: data.planId },
        day: data.day,
        role: data.role,
        content: data.content,
        sources: data.sources ?? null,
      }),
    );
  }

  async trimToLatestByPlanAndDay(
    userId: string,
    planId: string,
    day: number,
    keepCount: number,
  ): Promise<number> {
    if (keepCount <= 0) {
      return this.clearByPlanAndDay(userId, planId, day);
    }

    const messagesToKeep = await this.repository
      .createQueryBuilder('message')
      .select('message.id', 'id')
      .where('message.user_id = :userId', { userId })
      .andWhere('message.plan_id = :planId', { planId })
      .andWhere('message.day = :day', { day })
      .orderBy('message.created_at', 'DESC')
      .addOrderBy('message.id', 'DESC')
      .limit(keepCount)
      .getRawMany<{ id: string }>();
    const keepIds = messagesToKeep
      .map((message) => message.id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);

    if (keepIds.length === 0) {
      return this.clearByPlanAndDay(userId, planId, day);
    }

    const result = await this.repository
      .createQueryBuilder()
      .delete()
      .from(StudyGpsDayChatMessage)
      .where('user_id = :userId', { userId })
      .andWhere('plan_id = :planId', { planId })
      .andWhere('day = :day', { day })
      .andWhere('id NOT IN (:...keepIds)', { keepIds })
      .execute();

    return result.affected ?? 0;
  }

  async clearByPlanAndDay(
    userId: string,
    planId: string,
    day: number,
  ): Promise<number> {
    const result = await this.repository
      .createQueryBuilder()
      .delete()
      .from(StudyGpsDayChatMessage)
      .where('user_id = :userId', { userId })
      .andWhere('plan_id = :planId', { planId })
      .andWhere('day = :day', { day })
      .execute();

    return result.affected ?? 0;
  }
}
