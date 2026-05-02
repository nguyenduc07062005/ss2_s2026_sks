import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import type {
  StudyGpsDocumentRef,
  StudyGpsGoal,
  StudyGpsLevel,
  StudyGpsPlanContent,
  SummaryLanguage,
} from 'src/modules/rag/types/rag.types';

@Entity('study_gps_plans')
export class StudyGpsPlan extends BaseEntity {
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'goal', type: 'text' })
  goal: StudyGpsGoal;

  @Column({ name: 'level', type: 'text' })
  level: StudyGpsLevel;

  @Column({ name: 'language', type: 'text' })
  language: SummaryLanguage;

  @Column({ name: 'days_left', type: 'int' })
  daysLeft: number;

  @Column({ name: 'hours_per_day', type: 'int' })
  hoursPerDay: number;

  @Column({ name: 'document_refs', type: 'jsonb' })
  documents: StudyGpsDocumentRef[];

  @Column({ name: 'plan', type: 'jsonb' })
  plan: StudyGpsPlanContent;

  @Column({ name: 'generated_at', type: 'timestamp' })
  generatedAt: Date;
}
