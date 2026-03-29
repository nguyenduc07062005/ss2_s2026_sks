import {
  DataSource,
  DeleteResult,
  DeepPartial,
  EntityTarget,
  FindOneOptions,
  FindOptionsWhere,
  Repository,
} from 'typeorm';
import { BaseEntity } from '../entities/base.entity';

export abstract class BaseRepository<T extends BaseEntity> {
  protected repository: Repository<T>;

  constructor(
    protected readonly dataSource: DataSource,
    protected readonly entity: EntityTarget<T>,
  ) {
    this.repository = this.dataSource.getRepository(this.entity);
  }

  async findById(id: string): Promise<T | null> {
    return this.repository.findOne({ where: { id } as FindOptionsWhere<T> });
  }

  async findOne(options: FindOneOptions<T>): Promise<T | null> {
    return this.repository.findOne(options);
  }

  async create(data: DeepPartial<T>): Promise<T> {
    const entity = this.repository.create(data);
    return this.repository.save(entity);
  }

  getRepository(): Repository<T> {
    return this.repository;
  }

  async update(id: string, data: DeepPartial<T>): Promise<T | null> {
    await this.repository.update(id as never, data as never);
    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result: DeleteResult = await this.repository.delete(id as never);
    return (result.affected ?? 0) > 0;
  }
}
