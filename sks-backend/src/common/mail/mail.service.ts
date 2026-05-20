import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';

type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
};

type BrevoConfig = {
  apiKey: string;
  sender: {
    name: string;
    email: string;
  };
};

type MailProvider = 'smtp' | 'brevo';

type MailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

const parseBoolean = (
  value: string | undefined,
  fallback: boolean,
): boolean => {
  if (!value?.trim()) {
    return fallback;
  }

  return value.trim().toLowerCase() === 'true';
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const isEmailLike = (value: string): boolean =>
  /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value);

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  constructor(private readonly configService: ConfigService) {}

  async sendEmailVerificationEmail(
    recipientEmail: string,
    verificationUrl: string,
    expiresAt: Date,
  ): Promise<void> {
    const safeVerificationUrl = escapeHtml(verificationUrl);
    const expiresAtLabel = this.formatExpiry(expiresAt);

    await this.sendMail({
      to: recipientEmail,
      subject: 'Verify your SKS email and set a password',
      text: [
        'Welcome to SKS Smart Knowledge System.',
        '',
        `Open this link to verify your email and set a password: ${verificationUrl}`,
        '',
        `This link expires at ${expiresAtLabel}.`,
        'If you did not create an SKS account, you can ignore this email.',
      ].join('\n'),
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937">
          <h2 style="color:#0891b2">Verify your SKS email</h2>
          <p>Welcome to SKS Smart Knowledge System.</p>
          <p>
            <a href="${safeVerificationUrl}" style="display:inline-block;background:#0891b2;color:#ffffff;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:700">
              Verify email and set password
            </a>
          </p>
          <p>Or copy this link into your browser:</p>
          <p style="word-break:break-all;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px">${safeVerificationUrl}</p>
          <p>This link expires at <strong>${escapeHtml(expiresAtLabel)}</strong>.</p>
          <p>If you did not create an SKS account, you can ignore this email.</p>
        </div>
      `,
    });
  }

  async sendPasswordResetEmail(
    recipientEmail: string,
    resetUrl: string,
    expiresAt: Date,
  ): Promise<void> {
    const safeResetUrl = escapeHtml(resetUrl);
    const expiresAtLabel = this.formatExpiry(expiresAt);

    await this.sendMail({
      to: recipientEmail,
      subject: 'Reset your SKS password',
      text: [
        'We received a request to reset your SKS password.',
        '',
        `Open this link to create a new password: ${resetUrl}`,
        '',
        `This link expires at ${expiresAtLabel}.`,
        'If you did not request a password reset, you can ignore this email.',
      ].join('\n'),
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937">
          <h2 style="color:#0891b2">Reset your SKS password</h2>
          <p>We received a request to reset your SKS password.</p>
          <p>
            <a href="${safeResetUrl}" style="display:inline-block;background:#0891b2;color:#ffffff;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:700">
              Create a new password
            </a>
          </p>
          <p>Or copy this link into your browser:</p>
          <p style="word-break:break-all;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px">${safeResetUrl}</p>
          <p>This link expires at <strong>${escapeHtml(expiresAtLabel)}</strong>.</p>
          <p>If you did not request a password reset, you can ignore this email.</p>
        </div>
      `,
    });
  }

  private async sendMail(message: MailMessage): Promise<void> {
    const provider = this.getMailProvider();

    if (provider === 'brevo') {
      await this.sendBrevoMail(message);
      return;
    }

    const smtpConfig = this.getSmtpConfig();
    const transporter = this.getTransporter(smtpConfig);
    await transporter.sendMail({
      from: smtpConfig.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  }

  private async sendBrevoMail(message: MailMessage): Promise<void> {
    const config = this.getBrevoConfig();

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'api-key': config.apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: config.sender,
        to: [{ email: message.to }],
        subject: message.subject,
        textContent: message.text,
        htmlContent: message.html,
      }),
    });

    if (!response.ok) {
      const responseText = await response.text().catch(() => '');
      this.logger.error(
        `Brevo email delivery failed with status ${response.status}: ${this.truncateLogValue(responseText)}`,
      );
      throw new ServiceUnavailableException(
        'Email service is temporarily unavailable.',
      );
    }
  }

  private getMailProvider(): MailProvider {
    const provider =
      this.configService.get<string>('MAIL_PROVIDER')?.trim().toLowerCase() ||
      'smtp';

    if (provider === 'smtp' || provider === 'brevo') {
      return provider;
    }

    this.logger.error(`Unsupported MAIL_PROVIDER: ${provider}`);
    throw new ServiceUnavailableException('Email service is not configured.');
  }

  private getTransporter(config: SmtpConfig): Transporter {
    if (this.transporter) {
      return this.transporter;
    }

    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.pass,
      },
    });

    return this.transporter;
  }

  private getSmtpConfig(): SmtpConfig {
    const host = this.configService.get<string>('SMTP_HOST')?.trim() || '';
    const port = Number(this.configService.get<string>('SMTP_PORT') || '465');
    const secure = parseBoolean(
      this.configService.get<string>('SMTP_SECURE'),
      port === 465,
    );
    const user = this.configService.get<string>('SMTP_USER')?.trim() || '';
    const pass = this.configService.get<string>('SMTP_PASS') || '';
    const configuredFrom =
      this.configService.get<string>('MAIL_FROM')?.trim() || '';

    if (!host || !Number.isFinite(port) || !user || !pass) {
      this.logger.error('SMTP is not configured.');
      throw new ServiceUnavailableException('Email service is not configured.');
    }

    return {
      host,
      port,
      secure,
      user,
      pass,
      from: configuredFrom || `SKS Smart Knowledge System <${user}>`,
    };
  }

  private getBrevoConfig(): BrevoConfig {
    const apiKey =
      this.configService.get<string>('BREVO_API_KEY')?.trim() || '';
    const sender = this.parseMailFrom(
      this.configService.get<string>('MAIL_FROM')?.trim() || '',
    );

    if (!apiKey || !sender) {
      this.logger.error('Brevo email API is not configured.');
      throw new ServiceUnavailableException('Email service is not configured.');
    }

    return { apiKey, sender };
  }

  private parseMailFrom(value: string): BrevoConfig['sender'] | null {
    const fallbackName = 'SKS Smart Knowledge System';
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      return null;
    }

    const fullMatch = trimmedValue.match(/^"?([^"<]*)"?\s*<([^<>]+)>$/);
    if (fullMatch) {
      const [, rawName, rawEmail] = fullMatch;
      const email = rawEmail.trim();
      if (!isEmailLike(email)) {
        return null;
      }

      return {
        name: rawName.trim() || fallbackName,
        email,
      };
    }

    if (isEmailLike(trimmedValue)) {
      return {
        name: fallbackName,
        email: trimmedValue,
      };
    }

    return null;
  }

  private truncateLogValue(value: string): string {
    const normalizedValue = value.replace(/\s+/g, ' ').trim();
    return normalizedValue.length > 300
      ? `${normalizedValue.slice(0, 300)}...`
      : normalizedValue;
  }

  private formatExpiry(expiresAt: Date): string {
    return expiresAt.toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }
}
