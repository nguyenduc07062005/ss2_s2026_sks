import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes, createHash } from 'crypto';
import { MoreThan } from 'typeorm';
import { MailService } from 'src/common/mail/mail.service';
import { UserRole } from 'src/database/entities/user.entity';
import { UserRepository } from 'src/database/repositories/user.repository';
import { ChangePasswordDto } from './dtos/change-password.dto';
import { CompleteRegistrationDto } from './dtos/complete-registration.dto';
import { CreateUserDto } from './dtos/create-user.dto';
import { ForgotPasswordDto } from './dtos/forgot-password.dto';
import { LoginDto } from './dtos/login.dto';
import { ResetPasswordDto } from './dtos/reset-password.dto';
import { UpdateProfileDto } from './dtos/update-profile.dto';

const EMAIL_VERIFICATION_TOKEN_TTL_MINUTES = 24 * 60;
const RESET_PASSWORD_TOKEN_TTL_MINUTES = 15;
const REGISTRATION_STARTED_MESSAGE =
  'Registration started. Please check your email to set your password.';
const REGISTRATION_COMPLETED_MESSAGE = 'Registration completed successfully.';
const GENERIC_RESET_MESSAGE =
  'If an account exists for this email, a password reset link has been sent.';
const PASSWORD_RESET_MESSAGE = 'Password has been reset successfully.';
const PASSWORD_UPDATED_MESSAGE = 'Password updated successfully.';

@Injectable()
export class AuthenticationService {
  private readonly logger = new Logger(AuthenticationService.name);

  constructor(
    private readonly userRepository: UserRepository,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: CreateUserDto) {
    const email = this.normalizeEmail(dto.email);
    const name = dto.name.trim();
    const existingUser = await this.userRepository.findOne({
      where: { email },
    });

    if (existingUser?.isEmailVerified) {
      throw new BadRequestException('Email already in use');
    }

    if (existingUser && !existingUser.isActive) {
      throw new BadRequestException('This account has been deactivated');
    }

    const verificationToken = this.generateToken();
    const emailVerificationTokenHash = this.hashToken(verificationToken);
    const emailVerificationTokenExpiresAt = this.addMinutes(
      EMAIL_VERIFICATION_TOKEN_TTL_MINUTES,
    );
    const verificationUrl = this.buildFrontendUrl(
      '/complete-registration',
      verificationToken,
    );

    if (existingUser) {
      const previousState = {
        name: existingUser.name,
        emailVerificationTokenHash: existingUser.emailVerificationTokenHash,
        emailVerificationTokenExpiresAt:
          existingUser.emailVerificationTokenExpiresAt,
      };

      existingUser.name = name;
      existingUser.emailVerificationTokenHash = emailVerificationTokenHash;
      existingUser.emailVerificationTokenExpiresAt =
        emailVerificationTokenExpiresAt;

      await this.userRepository.getRepository().save(existingUser);

      try {
        await this.mailService.sendEmailVerificationEmail(
          email,
          verificationUrl,
          emailVerificationTokenExpiresAt,
        );
      } catch (error) {
        existingUser.name = previousState.name;
        existingUser.emailVerificationTokenHash =
          previousState.emailVerificationTokenHash;
        existingUser.emailVerificationTokenExpiresAt =
          previousState.emailVerificationTokenExpiresAt;
        await this.userRepository.getRepository().save(existingUser);
        throw error;
      }

      return { message: REGISTRATION_STARTED_MESSAGE };
    }

    const dummyPasswordHash = await bcrypt.hash(this.generateToken(), 10);
    const user = await this.userRepository.create({
      email,
      password: dummyPasswordHash,
      name,
      role: UserRole.USER,
      isActive: true,
      isEmailVerified: false,
      emailVerifiedAt: null,
      emailVerificationTokenHash,
      emailVerificationTokenExpiresAt,
      resetPasswordTokenHash: null,
      resetPasswordTokenExpiresAt: null,
    });

    try {
      await this.mailService.sendEmailVerificationEmail(
        email,
        verificationUrl,
        emailVerificationTokenExpiresAt,
      );
    } catch (error) {
      await this.userRepository.delete(user.id);
      throw error;
    }

    return { message: REGISTRATION_STARTED_MESSAGE };
  }

  async completeRegistration(dto: CompleteRegistrationDto) {
    const tokenHash = this.hashToken(dto.token.trim());
    const user = await this.userRepository.getRepository().findOne({
      where: {
        emailVerificationTokenHash: tokenHash,
        emailVerificationTokenExpiresAt: MoreThan(new Date()),
      },
    });

    if (!user || !user.isActive) {
      throw new BadRequestException('Invalid or expired registration token');
    }

    user.password = await bcrypt.hash(dto.password, 10);
    user.isEmailVerified = true;
    user.emailVerifiedAt = new Date();
    user.emailVerificationTokenHash = null;
    user.emailVerificationTokenExpiresAt = null;

    await this.userRepository.getRepository().save(user);

    return { message: REGISTRATION_COMPLETED_MESSAGE };
  }

  async login(dto: LoginDto) {
    const email = this.normalizeEmail(dto.email);
    const user = await this.userRepository.findOne({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('This account has been deactivated');
    }

    if (!user.isEmailVerified) {
      throw new UnauthorizedException(
        'Please verify your email before logging in',
      );
    }

    const payload = {
      sub: user.id,
      role: user.role,
    };

    return {
      accessToken: await this.jwtService.signAsync(payload),
    };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const email = this.normalizeEmail(dto.email);
    const user = await this.userRepository.findOne({
      where: { email },
    });

    if (!user || !user.isActive || !user.isEmailVerified) {
      return { message: GENERIC_RESET_MESSAGE };
    }

    const previousState = {
      resetPasswordTokenHash: user.resetPasswordTokenHash,
      resetPasswordTokenExpiresAt: user.resetPasswordTokenExpiresAt,
    };
    const resetToken = this.generateToken();
    user.resetPasswordTokenHash = this.hashToken(resetToken);
    user.resetPasswordTokenExpiresAt = this.addMinutes(
      RESET_PASSWORD_TOKEN_TTL_MINUTES,
    );

    await this.userRepository.getRepository().save(user);

    try {
      await this.mailService.sendPasswordResetEmail(
        email,
        this.buildFrontendUrl('/reset-password', resetToken),
        user.resetPasswordTokenExpiresAt,
      );
    } catch (error) {
      user.resetPasswordTokenHash = previousState.resetPasswordTokenHash;
      user.resetPasswordTokenExpiresAt =
        previousState.resetPasswordTokenExpiresAt;
      await this.userRepository.getRepository().save(user);
      this.logger.warn(
        `Password reset email failed for user ${user.id}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }

    return { message: GENERIC_RESET_MESSAGE };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const tokenHash = this.hashToken(dto.token.trim());
    const user = await this.userRepository.getRepository().findOne({
      where: {
        resetPasswordTokenHash: tokenHash,
        resetPasswordTokenExpiresAt: MoreThan(new Date()),
      },
    });

    if (!user || !user.isActive || !user.isEmailVerified) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const isSamePassword = await bcrypt.compare(dto.password, user.password);
    if (isSamePassword) {
      throw new BadRequestException(
        'New password must be different from the current password',
      );
    }

    user.password = await bcrypt.hash(dto.password, 10);
    user.resetPasswordTokenHash = null;
    user.resetPasswordTokenExpiresAt = null;

    await this.userRepository.getRepository().save(user);

    return { message: PASSWORD_RESET_MESSAGE };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('This account has been deactivated');
    }

    user.name = dto.name.trim();
    await this.userRepository.getRepository().save(user);

    return this.serializeProfile(user);
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('This account has been deactivated');
    }

    if (!user.isEmailVerified) {
      throw new UnauthorizedException(
        'Please verify your email before changing password',
      );
    }

    const isCurrentPasswordValid = await bcrypt.compare(
      dto.currentPassword,
      user.password,
    );

    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const isSamePassword = await bcrypt.compare(dto.newPassword, user.password);
    if (isSamePassword) {
      throw new BadRequestException(
        'New password must be different from the current password',
      );
    }

    user.password = await bcrypt.hash(dto.newPassword, 10);
    user.resetPasswordTokenHash = null;
    user.resetPasswordTokenExpiresAt = null;

    await this.userRepository.getRepository().save(user);

    return { message: PASSWORD_UPDATED_MESSAGE };
  }

  async getProfile(userId: string) {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new BadRequestException('User not found');
    }

    return this.serializeProfile(user);
  }

  private serializeProfile(user: {
    id: string;
    email: string;
    name: string | null;
    role: UserRole;
    isActive: boolean;
    isEmailVerified: boolean;
  }) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      isEmailVerified: user.isEmailVerified,
    };
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private generateToken(): string {
    return randomBytes(32).toString('hex');
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private addMinutes(minutes: number): Date {
    return new Date(Date.now() + minutes * 60_000);
  }

  private buildFrontendUrl(pathname: string, token: string): string {
    const baseUrl =
      this.configService.get<string>('FRONTEND_URL')?.trim() ||
      'http://localhost:3000';
    const url = new URL(pathname, baseUrl);
    url.searchParams.set('token', token);
    return url.toString();
  }
}
