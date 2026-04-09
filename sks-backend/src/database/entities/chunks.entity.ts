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

  @Column({ name: 'embedding', type: 'vector', length: 3072, nullable: true })
  embedding: number[] | string | null;

  @Column({ name: 'embedding_model', type: 'text', nullable: true })
  embeddingModel: string | null;

  @Column({ name: 'page_number', type: 'int', nullable: true })
  pageNumber: number | null;

  @Column({ name: 'section_title', type: 'text', nullable: true })
  sectionTitle: string | null;
}
