import { DocumentController } from './document.controller';
import type { DocumentDto } from './dtos/document.dto';
import type { DocumentService } from './document.service';
import type { RagService } from '../rag/rag.service';

describe('DocumentController', () => {
  it('returns uploaded documents without waiting for indexing', async () => {
    const uploadedDocument = {
      id: 'document-id',
      ownerId: 'owner-id',
      title: 'Research paper',
      fileName: 'research-paper.pdf',
      totalChunks: 12,
    };
    const updatedList = {
      total: 1,
      currentPage: 1,
      totalPages: 1,
      documents: [
        {
          id: uploadedDocument.id,
          title: uploadedDocument.title,
          status: 'processed',
        },
      ],
    };
    const uploadDocument = jest.fn().mockResolvedValue(uploadedDocument);
    const getDocuments = jest.fn().mockResolvedValue(updatedList);
    const ensureDocumentIndexed = jest.fn().mockResolvedValue(undefined);
    const documentService = {
      uploadDocument,
      getDocuments,
    } as unknown as jest.Mocked<DocumentService>;
    const ragService = {
      ensureDocumentIndexed,
    } as unknown as jest.Mocked<RagService>;
    const controller = new DocumentController(documentService, ragService);
    const file = {
      originalname: 'research-paper.pdf',
      mimetype: 'application/pdf',
      buffer: Buffer.from('content'),
      size: 7,
    } as Express.Multer.File;
    const dto: DocumentDto = {};
    const request = {
      user: { userId: 'owner-id' },
    } as never;

    await expect(controller.upload(file, dto, request)).resolves.toEqual({
      message: 'Document uploaded. AI indexing is running in the background.',
      uploaded: uploadedDocument,
      updatedList,
    });
    expect(uploadDocument).toHaveBeenCalledWith(
      file,
      { title: 'research-paper.pdf' },
      'owner-id',
    );
    expect(ensureDocumentIndexed).not.toHaveBeenCalled();
  });
});
