import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { BaseRepository } from './base.repository';
import { Chunk } from '../entities/chunks.entity';

@Injectable()
export class ChunkRepository extends BaseRepository<Chunk> {
  constructor(private readonly ds: DataSource) {
    super(ds, Chunk);
  }

  async findByDocument(documentId: string): Promise<Chunk[]> {
    return this.repository.find({
      where: { documents: { id: documentId } },
      order: { chunkIndex: 'ASC' },
    });
  }
}
