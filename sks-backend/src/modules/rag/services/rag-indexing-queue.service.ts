import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { RagIndexingService } from './rag-indexing.service';
import { toErrorMessage } from '../shared-rag.util';

export type DocumentUploadedEvent = {
  documentId: string;
};

const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 2000;

@Injectable()
export class RagIndexingQueueService {
  private readonly logger = new Logger(RagIndexingQueueService.name);

  constructor(private readonly ragIndexingService: RagIndexingService) {}

  /**
   * Triggered automatically when a document is uploaded.
   * Runs fully in background — the HTTP response has already been returned to the user.
   * Retries up to MAX_RETRIES times with exponential backoff on failure.
   */
  @OnEvent('document.uploaded', { async: true })
  async handleDocumentUploaded(event: DocumentUploadedEvent): Promise<void> {
    const { documentId } = event;
    this.logger.log(`Background indexing queued for document ${documentId}`);

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const result =
          await this.ragIndexingService.indexDocumentBackground(documentId);
        this.logger.log(
          `Background indexing complete for document ${documentId}: ` +
            `${result.indexedChunks}/${result.totalChunks} chunks indexed`,
        );
        return;
      } catch (error) {
        const message = toErrorMessage(error);

        if (attempt < MAX_RETRIES) {
          const delayMs = RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
          this.logger.warn(
            `Background indexing attempt ${attempt}/${MAX_RETRIES} failed ` +
              `for document ${documentId}: ${message}. Retrying in ${delayMs}ms…`,
          );
          await this.sleep(delayMs);
        } else {
          this.logger.error(
            `Background indexing permanently failed for document ${documentId} ` +
              `after ${MAX_RETRIES} attempts: ${message}`,
          );
        }
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
