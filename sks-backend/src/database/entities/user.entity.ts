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

  @Column({ name: 'is_email_verified', default: false })
  isEmailVerified: boolean;

  @Column({ name: 'email_verified_at', type: 'timestamp', nullable: true })
  emailVerifiedAt: Date | null;

  @Column({
    name: 'email_verification_token_hash',
    type: 'varchar',
    nullable: true,
  })
  emailVerificationTokenHash: string | null;

  @Column({
    name: 'email_verification_token_expires_at',
    type: 'timestamp',
    nullable: true,
  })
  emailVerificationTokenExpiresAt: Date | null;

  @Column({
    name: 'reset_password_token_hash',
    type: 'varchar',
    nullable: true,
  })
  resetPasswordTokenHash: string | null;

  @Column({
    name: 'reset_password_token_expires_at',
    type: 'timestamp',
    nullable: true,
  })
  resetPasswordTokenExpiresAt: Date | null;

  /** Relations */
  @OneToMany(() => UserDocument, (userDocument) => userDocument.user)
  userDocuments: UserDocument[];

  @OneToMany(() => Folder, (folder) => folder.owner)
  folders: Folder[];
}
