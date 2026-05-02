import { Injectable } from '@nestjs/common';
import { DataSource, DeepPartial } from 'typeorm';
import { BaseRepository } from './base.repository';
import { StudyGpsPlan } from '../entities/study-gps-plan.entity';

@Injectable()
export class StudyGpsPlanRepository extends BaseRepository<StudyGpsPlan> {
  constructor(private readonly ds: DataSource) {
    super(ds, StudyGpsPlan);
  }

  async findByUserId(userId: string): Promise<StudyGpsPlan | null> {
    return this.repository.findOne({
      where: { user: { id: userId } },
    });
  }

  async saveActivePlan(
    userId: string,
    data: Omit<DeepPartial<StudyGpsPlan>, 'user'>,
  ): Promise<StudyGpsPlan> {
    const currentPlan = await this.findByUserId(userId);
    const nextPayload: DeepPartial<StudyGpsPlan> = {
      ...data,
      user: { id: userId },
    };

    if (currentPlan) {
      this.repository.merge(currentPlan, nextPayload);
      return this.repository.save(currentPlan);
    }

    return this.repository.save(this.repository.create(nextPayload));
  }

  async clearByUserId(userId: string): Promise<boolean> {
    const result = await this.repository
      .createQueryBuilder()
      .delete()
      .from(StudyGpsPlan)
      .where('user_id = :userId', { userId })
      .execute();

    return (result.affected ?? 0) > 0;
  }
}
