import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import * as crypto from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';

type StoredDocumentFile = {
  buffer: Buffer;
  contentType: string;
  fileName: string;
  contentLength?: number;
};

type StorageDriver = 'disk' | 'r2';

@Injectable()
export class DocumentStorageService {
  private readonly logger = new Logger(DocumentStorageService.name);
  private readonly uploadsDirectory = path.resolve(
    process.env.UPLOADS_DIR || 'uploads',
  );
  private readonly driver: StorageDriver;
  private readonly r2Bucket = process.env.CLOUDFLARE_R2_BUCKET || '';
  private readonly s3Client: S3Client | null;

  constructor() {
    const configuredDriver = process.env.DOCUMENT_STORAGE_DRIVER?.toLowerCase();
    this.driver = configuredDriver === 'r2' ? 'r2' : 'disk';
    this.s3Client = this.driver === 'r2' ? this.createR2Client() : null;
  }

  async saveFile(file: Express.Multer.File, ownerId: string): Promise<string> {
    const fileName = this.toSafeFileName(file.originalname);
    const uniqueName = `${crypto.randomUUID()}-${fileName}`;

    if (this.driver === 'r2') {
      const key = `uploads/${ownerId}/${uniqueName}`;
      await this.putR2Object(key, file.buffer, file.mimetype);
      return `r2://${this.r2Bucket}/${key}`;
    }

    await fs.mkdir(this.uploadsDirectory, { recursive: true });
    const filePath = path.join(this.uploadsDirectory, uniqueName);
    await fs.writeFile(filePath, file.buffer);
    return filePath;
  }

  async getFile(fileRef: string): Promise<StoredDocumentFile> {
    if (this.isR2FileRef(fileRef)) {
      return this.getR2File(fileRef);
    }

    try {
      const buffer = await fs.readFile(fileRef);
      const fileName = path.basename(fileRef);

      return {
        buffer,
        fileName,
        contentType: this.getContentType(fileName),
        contentLength: buffer.length,
      };
    } catch {
      this.logger.error(`File missing on disk: ${fileRef}`);
      throw new BadRequestException('Document file not found on server');
    }
  }

  async deleteFile(fileRef: string): Promise<void> {
    if (this.isR2FileRef(fileRef)) {
      await this.deleteR2File(fileRef);
      return;
    }

    await fs.rm(fileRef, { force: true });
  }

  private createR2Client(): S3Client {
    const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID;
    const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;

    if (!accountId || !this.r2Bucket || !accessKeyId || !secretAccessKey) {
      throw new Error(
        'Cloudflare R2 storage is enabled but required R2 environment variables are missing.',
      );
    }

    return new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  private async putR2Object(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<void> {
    if (!this.s3Client) {
      throw new Error('R2 client is not configured.');
    }

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.r2Bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  private async getR2File(fileRef: string): Promise<StoredDocumentFile> {
    if (!this.s3Client) {
      throw new Error('R2 client is not configured.');
    }

    const { bucket, key } = this.parseR2FileRef(fileRef);

    try {
      const response = await this.s3Client.send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: key,
        }),
      );
      const buffer = await this.streamToBuffer(response.Body);
      const fileName = path.posix.basename(key);

      return {
        buffer,
        fileName,
        contentType: response.ContentType || this.getContentType(fileName),
        contentLength: response.ContentLength,
      };
    } catch {
      this.logger.error(`File missing in R2: ${fileRef}`);
      throw new BadRequestException('Document file not found on server');
    }
  }

  private async deleteR2File(fileRef: string): Promise<void> {
    if (!this.s3Client) {
      throw new Error('R2 client is not configured.');
    }

    const { bucket, key } = this.parseR2FileRef(fileRef);
    await this.s3Client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );
  }

  private isR2FileRef(fileRef: string): boolean {
    return fileRef.startsWith('r2://');
  }

  private parseR2FileRef(fileRef: string): { bucket: string; key: string } {
    const value = fileRef.slice('r2://'.length);
    const slashIndex = value.indexOf('/');

    if (slashIndex <= 0 || slashIndex === value.length - 1) {
      throw new BadRequestException('Invalid document file reference');
    }

    return {
      bucket: value.slice(0, slashIndex),
      key: value.slice(slashIndex + 1),
    };
  }

  private toSafeFileName(fileName: string): string {
    const baseName = path.basename(fileName || 'document');
    const safeName = baseName
      .replace(/[<>:"/\\|?*]/g, '_')
      .split('')
      .map((char) => (char.charCodeAt(0) < 32 ? '_' : char))
      .join('')
      .trim();

    return safeName || 'document';
  }

  private getContentType(fileName: string): string {
    const extension = path.extname(fileName).toLowerCase();

    switch (extension) {
      case '.pdf':
        return 'application/pdf';
      case '.docx':
        return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      case '.txt':
        return 'text/plain; charset=utf-8';
      default:
        return 'application/octet-stream';
    }
  }

  private async streamToBuffer(body: unknown): Promise<Buffer> {
    if (!body) {
      return Buffer.alloc(0);
    }

    const chunks: Buffer[] = [];

    for await (const chunk of body as AsyncIterable<Uint8Array | string>) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
  }
}
