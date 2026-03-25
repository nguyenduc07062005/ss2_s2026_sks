import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UserRepository } from './repositories/user.repository';

@Global()
@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        host: config.get<string>('DATABASE_HOST') ?? 'localhost',
        port: Number(config.get<string>('DATABASE_PORT') ?? '5432'),
        username: config.get<string>('DATABASE_USERNAME') ?? 'postgres',
        password: config.get<string>('DATABASE_PASSWORD') ?? 'postgres',
        database: config.get<string>('DATABASE_NAME') ?? 'sks',
        entities: [User],
        synchronize:
          (config.get<string>('DATABASE_SYNC') ?? 'false') === 'true',
        logging: (config.get<string>('DATABASE_LOGGING') ?? 'false') === 'true',
      }),
    }),
    TypeOrmModule.forFeature([User]),
  ],
  providers: [UserRepository],
  exports: [TypeOrmModule, UserRepository],
})
export class DatabaseModule {}
