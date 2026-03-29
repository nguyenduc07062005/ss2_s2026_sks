import { Column, Entity, OneToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { UserDocument } from './user-document.entity';
import { Folder } from './folder.entity';

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
}

@Entity('users')
export class User extends BaseEntity {
  @Column({ name: 'email', unique: true })
  email: string;

  @Column({ name: 'password' })
  password: string;

  @Column({ name: 'name', nullable: true })
  name: string;

  @Column({
    name: 'role',
    type: 'enum',
    enum: UserRole,
    default: UserRole.USER,
  })
  role: UserRole;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  /** Relations */
  @OneToMany(() => UserDocument, (userDocument) => userDocument.user)
  userDocuments: UserDocument[];

  @OneToMany(() => Folder, (folder) => folder.owner)
  folders: Folder[];
}
