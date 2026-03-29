import { Entity, Column, ManyToMany, JoinTable, OneToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Chunk } from './chunks.entity';
import { UserDocument } from './user-document.entity';

@Entity('document')
export class Document extends BaseEntity {
  @Column({ name: 'title', type: 'text', nullable: true })
  title: string;

  @Column({ name: 'metadata', type: 'jsonb', nullable: true })
  metadata: {
    topic?: string;
    field?: string;
    keywords?: string[];
    methodology?: string;
    [key: string]: any;
  };

  @Column({ name: 'doc_date', type: 'date', nullable: true })
  docDate: Date;

  @Column({ name: 'extra_attributes', type: 'jsonb', nullable: true })
  extraAttributes: Record<string, any>;

  @Column({ name: 'file_ref', type: 'text', nullable: true })
  fileRef: string;

  @Column({ name: 'file_size', type: 'bigint', nullable: true })
  fileSize: number;

  @Column({ name: 'content_hash', type: 'text', nullable: true })
  contentHash: string;

  @Column({ name: 'status', type: 'text', default: 'pending' })
  status: string;

  /** Relations */
  @ManyToMany(() => Chunk, (chunk) => chunk.documents)
  @JoinTable({
    name: 'document_chunks',
    joinColumn: {
      name: 'document_id',
      referencedColumnName: 'id',
    },
    inverseJoinColumn: {
      name: 'chunk_id',
      referencedColumnName: 'id',
    },
  })
  chunks: Chunk[];

  @OneToMany(() => UserDocument, (userDocument) => userDocument.document)
  userDocuments: UserDocument[];
}
