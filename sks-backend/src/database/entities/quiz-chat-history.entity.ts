import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import type { RagSource } from 'src/modules/rag/types/rag.types';

@Entity('quiz_chat_history')
export class QuizChatHistory extends BaseEntity {
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'document_ids', type: 'jsonb' })
  documentIds: string[];

  @Column({ name: 'question', type: 'text' })
  question: string;

  @Column({ name: 'answer', type: 'text' })
  answer: string;

  @Column({ name: 'sources', type: 'jsonb', nullable: true })
  sources: RagSource[] | null;
}
