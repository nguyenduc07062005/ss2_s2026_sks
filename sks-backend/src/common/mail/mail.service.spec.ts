import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import { MailService } from './mail.service';

jest.mock('nodemailer', () => ({
  __esModule: true,
  default: {
    createTransport: jest.fn(),
  },
}));

type ConfigMap = Record<string, string | undefined>;

const createConfigService = (config: ConfigMap): ConfigService =>
  ({
    get: jest.fn((key: string) => config[key]),
  }) as unknown as ConfigService;

describe('MailService', () => {
  const createTransportMock = nodemailer.createTransport as jest.Mock;
  const fetchMock = jest.fn<Promise<Response>, [string, RequestInit?]>();

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = fetchMock as typeof fetch;
    fetchMock.mockResolvedValue({
      ok: true,
      status: 201,
      text: jest.fn<Promise<string>, []>(() => Promise.resolve('')),
    } as unknown as Response);
  });

  it('sends email through Brevo API when configured', async () => {
    const service = new MailService(
      createConfigService({
        MAIL_PROVIDER: 'brevo',
        BREVO_API_KEY: 'brevo-test-key',
        MAIL_FROM: 'SKS Smart Knowledge System <noreply@example.com>',
      }),
    );

    await service.sendPasswordResetEmail(
      'student@example.com',
      'https://smartknowledge.example/reset-password',
      new Date('2026-05-20T10:00:00Z'),
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, requestInit] = fetchMock.mock.calls[0];
    expect(requestInit?.method).toBe('POST');
    expect(requestInit?.headers).toMatchObject({
      'api-key': 'brevo-test-key',
      'content-type': 'application/json',
    });

    expect(typeof requestInit?.body).toBe('string');
    const body = JSON.parse(requestInit?.body as string) as {
      sender: { name: string; email: string };
      to: Array<{ email: string }>;
      subject: string;
      textContent: string;
      htmlContent: string;
    };

    expect(body.sender).toEqual({
      name: 'SKS Smart Knowledge System',
      email: 'noreply@example.com',
    });
    expect(body.to).toEqual([{ email: 'student@example.com' }]);
    expect(body.subject).toBe('Reset your SKS password');
    expect(body.textContent).toContain(
      'https://smartknowledge.example/reset-password',
    );
    expect(body.htmlContent).toContain('Reset your SKS password');
  });

  it('uses SMTP as the default provider', async () => {
    const sendMail = jest.fn<Promise<void>, [unknown]>(() => Promise.resolve());
    createTransportMock.mockReturnValue({ sendMail });

    const service = new MailService(
      createConfigService({
        SMTP_HOST: 'smtp.example.com',
        SMTP_PORT: '465',
        SMTP_SECURE: 'true',
        SMTP_USER: 'noreply@example.com',
        SMTP_PASS: 'smtp-pass',
        MAIL_FROM: 'SKS Smart Knowledge System <noreply@example.com>',
      }),
    );

    await service.sendEmailVerificationEmail(
      'student@example.com',
      'https://smartknowledge.example/complete-registration',
      new Date('2026-05-20T10:00:00Z'),
    );

    expect(createTransportMock).toHaveBeenCalledWith({
      host: 'smtp.example.com',
      port: 465,
      secure: true,
      auth: {
        user: 'noreply@example.com',
        pass: 'smtp-pass',
      },
    });
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'SKS Smart Knowledge System <noreply@example.com>',
        to: 'student@example.com',
        subject: 'Verify your SKS email and set a password',
      }),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails fast when Brevo is selected without required config', async () => {
    const service = new MailService(
      createConfigService({
        MAIL_PROVIDER: 'brevo',
        MAIL_FROM: 'SKS Smart Knowledge System <noreply@example.com>',
      }),
    );

    await expect(
      service.sendPasswordResetEmail(
        'student@example.com',
        'https://smartknowledge.example/reset-password',
        new Date('2026-05-20T10:00:00Z'),
      ),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
