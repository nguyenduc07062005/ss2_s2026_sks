import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { BaseRepository } from './base.repository';
import { UserDocument } from '../entities/user-document.entity';

@Injectable()
export class UserDocumentRepository extends BaseRepository<UserDocument> {
  constructor(private readonly ds: DataSource) {
    super(ds, UserDocument);
  }

  async findByUserAndDocument(
    userId: string,
    documentId: string,
  ): Promise<UserDocument | null> {
    return this.repository.findOne({
      where: { user: { id: userId }, document: { id: documentId } },
      relations: ['document'],
    });
  }

  async toggleFavorite(
    userId: string,
    documentId: string,
  ): Promise<UserDocument> {
    const userDocument = await this.repository.findOne({
      where: { user: { id: userId }, document: { id: documentId } },
    });

    if (!userDocument) {
      throw new Error('UserDocument not found');
    }

    userDocument.isFavorite = !userDocument.isFavorite;
    return this.repository.save(userDocument);
  }

  async getFavorites(userId: string): Promise<UserDocument[]> {
    return this.repository.find({
      where: { user: { id: userId }, isFavorite: true },
      relations: ['document', 'folder'],
    });
  }
}
