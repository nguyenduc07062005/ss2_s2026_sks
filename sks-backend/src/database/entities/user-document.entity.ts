import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { Document } from './document.entity';
import { Folder } from './folder.entity';

@Entity('user_documents')
export class UserDocument extends BaseEntity {
  @ManyToOne(() => User, (user) => user.userDocuments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Document, (document) => document.userDocuments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'document_id' })
  document: Document;

  @ManyToOne(() => Folder, (folder) => folder.userDocuments, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'folder_id' })
  folder: Folder | null;

  @Column({ name: 'document_name', type: 'varchar', nullable: true })
  documentName: string;

  @Column({ name: 'is_favorite', default: false })
  isFavorite: boolean;

  @Column({ name: 'extra_attributes', type: 'jsonb', nullable: true })
  extraAttributes: Record<string, any> | null;
}
