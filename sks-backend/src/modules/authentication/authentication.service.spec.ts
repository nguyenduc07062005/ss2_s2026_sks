import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { MailService } from 'src/common/mail/mail.service';
import { AuthenticationService } from './authentication.service';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

type UserRecord = {
  id?: string;
  email?: string;
  password?: string;
  name?: string | null;
  role?: string;
  isActive?: boolean;
  isEmailVerified?: boolean;
  emailVerifiedAt?: Date | null;
  emailVerificationTokenHash?: string | null;
  emailVerificationTokenExpiresAt?: Date | null;
  resetPasswordTokenHash?: string | null;
  resetPasswordTokenExpiresAt?: Date | null;
};

type AuthFindOptions = {
  where?: {
    emailVerificationTokenHash?: string;
    resetPasswordTokenHash?: string;
  };
};

type OrmRepositoryMock = {
  findOne: jest.Mock<Promise<UserRecord | null>, [unknown]>;
  save: jest.Mock<Promise<UserRecord>, [UserRecord]>;
};

type UserRepositoryMock = {
  create: jest.Mock<Promise<UserRecord>, [UserRecord]>;
  delete: jest.Mock<Promise<boolean>, [string]>;
  findById: jest.Mock<Promise<UserRecord | null>, [string]>;
  findOne: jest.Mock<Promise<UserRecord | null>, [unknown]>;
  getRepository: jest.Mock<OrmRepositoryMock, []>;
  update: jest.Mock<Promise<UserRecord | null>, [string, UserRecord]>;
};

type JwtServiceMock = {
  signAsync: jest.Mock<Promise<string>, [unknown]>;
};

type MailServiceMock = {
  sendEmailVerificationEmail: jest.Mock<Promise<void>, [string, string, Date]>;
  sendPasswordResetEmail: jest.Mock<Promise<void>, [string, string, Date]>;
};

const getFirstCallArg = <T>(mock: jest.Mock<unknown, [T]>): T => {
  const call = mock.mock.calls[0];
  if (!call) {
    throw new Error('Expected mock to have been called.');
  }

  return call[0];
};

const getFirstMailUrl = (
  mock: jest.Mock<Promise<void>, [string, string, Date]>,
): string => {
  const call = mock.mock.calls[0];
  if (!call) {
    throw new Error('Expected mail mock to have been called.');
  }

  return call[1];
};

describe('AuthenticationService email confirmation flow', () => {
  const genericResetMessage =
    'If an account exists for this email, a password reset link has been sent.';
  const hashMock = bcrypt.hash as unknown as jest.Mock<
    Promise<string>,
    [string, number]
  >;
  const compareMock = bcrypt.compare as unknown as jest.Mock<
    Promise<boolean>,
    [string, string]
  >;

  let userRepository: UserRepositoryMock;
  let ormRepository: OrmRepositoryMock;
  let jwtService: JwtServiceMock;
  let mailService: MailServiceMock;
  let service: AuthenticationService;

  beforeEach(() => {
    ormRepository = {
      findOne: jest.fn<Promise<UserRecord | null>, [unknown]>(),
      save: jest.fn<Promise<UserRecord>, [UserRecord]>((user) =>
        Promise.resolve(user),
      ),
    };
    userRepository = {
      create: jest.fn<Promise<UserRecord>, [UserRecord]>((data) =>
        Promise.resolve({ id: 'user-1', ...data }),
      ),
      delete: jest.fn<Promise<boolean>, [string]>(() => Promise.resolve(true)),
      findById: jest.fn<Promise<UserRecord | null>, [string]>(),
      findOne: jest.fn<Promise<UserRecord | null>, [unknown]>(),
      getRepository: jest.fn<OrmRepositoryMock, []>(() => ormRepository),
      update: jest.fn<Promise<UserRecord | null>, [string, UserRecord]>(),
    };
    jwtService = {
      signAsync: jest.fn<Promise<string>, [unknown]>(() =>
        Promise.resolve('jwt-token'),
      ),
    };
    mailService = {
      sendEmailVerificationEmail: jest.fn<
        Promise<void>,
        [string, string, Date]
      >(() => Promise.resolve()),
      sendPasswordResetEmail: jest.fn<Promise<void>, [string, string, Date]>(
        () => Promise.resolve(),
      ),
    };
    service = new AuthenticationService(
      userRepository as never,
      jwtService as unknown as JwtService,
      mailService as unknown as MailService,
      { get: jest.fn() } as unknown as ConfigService,
    );

    hashMock.mockResolvedValue('hashed-value');
    compareMock.mockResolvedValue(false);
  });

  it('starts registration with name and email, stores a hashed verification token, and sends the email', async () => {
    const result = await service.register({
      email: ' Student@Example.COM ',
      name: ' Student User ',
    });

    expect(result).toEqual({
      message:
        'Registration started. Please check your email to set your password.',
    });

    const createdUser = getFirstCallArg(userRepository.create);
    expect(createdUser.email).toBe('student@example.com');
    expect(createdUser.name).toBe('Student User');
    expect(createdUser.isActive).toBe(true);
    expect(createdUser.isEmailVerified).toBe(false);
    expect(createdUser.password).toEqual(expect.any(String));
    expect(createdUser.emailVerificationTokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(createdUser.emailVerificationTokenExpiresAt).toBeInstanceOf(Date);

    expect(mailService.sendEmailVerificationEmail).toHaveBeenCalledWith(
      'student@example.com',
      expect.stringContaining('/complete-registration?token='),
      expect.any(Date),
    );
    const verificationUrl = getFirstMailUrl(
      mailService.sendEmailVerificationEmail,
    );
    expect(verificationUrl).not.toContain(
      createdUser.emailVerificationTokenHash ?? '',
    );
  });

  it('completes registration with a valid token and consumes the token', async () => {
    const pendingUser: UserRecord = {
      id: 'user-1',
      email: 'student@example.com',
      isActive: true,
      isEmailVerified: false,
    };
    ormRepository.findOne.mockResolvedValue(pendingUser);
    hashMock.mockResolvedValueOnce('hashed-password');

    await expect(
      service.completeRegistration({
        token: 'registration-token',
        password: 'StrongPass123!',
      }),
    ).resolves.toEqual({
      message: 'Registration completed successfully.',
    });

    const findOptions = getFirstCallArg(
      ormRepository.findOne,
    ) as AuthFindOptions;
    expect(findOptions.where?.emailVerificationTokenHash).toMatch(
      /^[a-f0-9]{64}$/,
    );

    const savedUser = getFirstCallArg(ormRepository.save);
    expect(savedUser.password).toBe('hashed-password');
    expect(savedUser.isEmailVerified).toBe(true);
    expect(savedUser.emailVerifiedAt).toBeInstanceOf(Date);
    expect(savedUser.emailVerificationTokenHash).toBeNull();
    expect(savedUser.emailVerificationTokenExpiresAt).toBeNull();
  });

  it('rejects login when the email has not been verified', async () => {
    userRepository.findOne.mockResolvedValue({
      id: 'user-1',
      email: 'student@example.com',
      password: 'hashed-password',
      role: 'user',
      isActive: true,
      isEmailVerified: false,
    });
    compareMock.mockResolvedValue(true);

    await expect(
      service.login({
        email: 'student@example.com',
        password: 'StrongPass123!',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('sends a reset email for active verified users without leaking the raw token', async () => {
    const user: UserRecord = {
      id: 'user-1',
      email: 'student@example.com',
      isActive: true,
      isEmailVerified: true,
    };
    userRepository.findOne.mockResolvedValue(user);

    await expect(
      service.forgotPassword({ email: ' STUDENT@example.com ' }),
    ).resolves.toEqual({
      message: genericResetMessage,
    });

    const savedUser = getFirstCallArg(ormRepository.save);
    expect(savedUser.resetPasswordTokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(savedUser.resetPasswordTokenExpiresAt).toBeInstanceOf(Date);

    expect(mailService.sendPasswordResetEmail).toHaveBeenCalledWith(
      'student@example.com',
      expect.stringContaining('/reset-password?token='),
      expect.any(Date),
    );
    expect(getFirstMailUrl(mailService.sendPasswordResetEmail)).not.toContain(
      savedUser.resetPasswordTokenHash ?? '',
    );
  });

  it('returns the generic reset response when the email is unknown', async () => {
    userRepository.findOne.mockResolvedValue(null);

    await expect(
      service.forgotPassword({ email: 'missing@example.com' }),
    ).resolves.toEqual({
      message: genericResetMessage,
    });
    expect(mailService.sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('resets the password with a valid token and consumes the reset token', async () => {
    const user: UserRecord = {
      id: 'user-1',
      password: 'old-hashed-password',
      isActive: true,
      isEmailVerified: true,
      resetPasswordTokenHash: 'old-token-hash',
      resetPasswordTokenExpiresAt: new Date(Date.now() + 60_000),
    };
    ormRepository.findOne.mockResolvedValue(user);
    compareMock.mockResolvedValue(false);
    hashMock.mockResolvedValueOnce('new-hashed-password');

    await expect(
      service.resetPassword({
        token: 'reset-token',
        password: 'NewStrongPass123!',
      }),
    ).resolves.toEqual({
      message: 'Password has been reset successfully.',
    });

    const savedUser = getFirstCallArg(ormRepository.save);
    expect(savedUser.password).toBe('new-hashed-password');
    expect(savedUser.resetPasswordTokenHash).toBeNull();
    expect(savedUser.resetPasswordTokenExpiresAt).toBeNull();
  });

  it('rejects reset password when the new password matches the old password', async () => {
    ormRepository.findOne.mockResolvedValue({
      id: 'user-1',
      isActive: true,
      isEmailVerified: true,
      password: 'old-hashed-password',
    });
    compareMock.mockResolvedValue(true);

    await expect(
      service.resetPassword({
        token: 'reset-token',
        password: 'SameStrongPass123!',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('updates the current user display name and returns the profile shape', async () => {
    const user: UserRecord = {
      id: 'user-1',
      email: 'student@example.com',
      name: 'Old Name',
      role: 'user',
      isActive: true,
      isEmailVerified: true,
    };
    userRepository.findById.mockResolvedValue(user);

    await expect(
      service.updateProfile('user-1', { name: '  New Name  ' }),
    ).resolves.toEqual({
      id: 'user-1',
      email: 'student@example.com',
      name: 'New Name',
      role: 'user',
      isActive: true,
      isEmailVerified: true,
    });

    const savedUser = getFirstCallArg(ormRepository.save);
    expect(savedUser.name).toBe('New Name');
  });

  it('changes password when the current password is valid', async () => {
    const user: UserRecord = {
      id: 'user-1',
      email: 'student@example.com',
      password: 'old-hashed-password',
      isActive: true,
      isEmailVerified: true,
      resetPasswordTokenHash: 'reset-token-hash',
      resetPasswordTokenExpiresAt: new Date(Date.now() + 60_000),
    };
    userRepository.findById.mockResolvedValue(user);
    compareMock.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    hashMock.mockResolvedValueOnce('new-hashed-password');

    await expect(
      service.changePassword('user-1', {
        currentPassword: 'CurrentPass123!',
        newPassword: 'NewStrongPass123!',
      }),
    ).resolves.toEqual({
      message: 'Password updated successfully.',
    });

    const savedUser = getFirstCallArg(ormRepository.save);
    expect(savedUser.password).toBe('new-hashed-password');
    expect(savedUser.resetPasswordTokenHash).toBeNull();
    expect(savedUser.resetPasswordTokenExpiresAt).toBeNull();
  });

  it('rejects password change when the current password is invalid', async () => {
    userRepository.findById.mockResolvedValue({
      id: 'user-1',
      password: 'old-hashed-password',
      isActive: true,
      isEmailVerified: true,
    });
    compareMock.mockResolvedValue(false);

    await expect(
      service.changePassword('user-1', {
        currentPassword: 'WrongPass123!',
        newPassword: 'NewStrongPass123!',
      }),
    ).rejects.toThrow(UnauthorizedException);
    expect(ormRepository.save).not.toHaveBeenCalled();
  });
});
