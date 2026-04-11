import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { Document } from './document.entity';
import type { RagSource } from 'src/modules/rag/types/rag.types';

@Entity('document_ask_history')
export class DocumentAskHistory extends BaseEntity {
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Document, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'document_id' })
  document: Document;

  @Column({ name: 'question', type: 'text' })
  question: string;

  @Column({ name: 'answer', type: 'text' })
  answer: string;

  @Column({ name: 'sources', type: 'jsonb', nullable: true })
  sources: RagSource[] | null;
}
