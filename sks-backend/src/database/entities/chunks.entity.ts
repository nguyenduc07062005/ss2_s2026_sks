import { Entity, Column, ManyToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Document } from './document.entity';

@Entity('chunks')
export class Chunk extends BaseEntity {
  @ManyToMany(() => Document, (document) => document.chunks)
  documents: Document[];

  @Column({ name: 'chunk_index', type: 'int' })
  chunkIndex: number;

  @Column({ name: 'chunk_text', type: 'text' })
  chunkText: string;

  @Column({ name: 'token_count', type: 'int' })
  tokenCount: number;
}
