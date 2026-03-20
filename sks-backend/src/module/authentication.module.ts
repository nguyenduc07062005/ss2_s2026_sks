import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { User } from 'src/database/entities/user.entity';

import { AuthenticationService } from './authentication.service';
import { AuthenticationController } from './authentication.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]), // Cho phép Module này đâm vào bảng User
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        // Lấy mã bí mật từ file .env. Nếu không có thì dùng pass tạm thời
        secret: configService.get<string>('JWT_SECRET', 'sks_secret_key_2026'), 
        signOptions: { expiresIn: '1d' }, // Token hết hạn sau 1 ngày
      }),
    }),
  ],
  providers: [AuthenticationService],
  controllers: [AuthenticationController],
})
export class AuthenticationModule {}
