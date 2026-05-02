import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { StudyGpsPlan } from './study-gps-plan.entity';
import { User } from './user.entity';
import type { RagSource } from 'src/modules/rag/types/rag.types';

@Entity('study_gps_day_chat_messages')
export class StudyGpsDayChatMessage extends BaseEntity {
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => StudyGpsPlan, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'plan_id' })
  plan: StudyGpsPlan;

  @Column({ name: 'day', type: 'int' })
  day: number;

  @Column({ name: 'role', type: 'text' })
  role: 'user' | 'assistant';

  @Column({ name: 'content', type: 'text' })
  content: string;

  @Column({ name: 'sources', type: 'jsonb', nullable: true })
  sources: RagSource[] | null;
}
