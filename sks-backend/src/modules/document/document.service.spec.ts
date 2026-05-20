import { BadRequestException } from '@nestjs/common';
import { DocumentService } from './document.service';

describe('DocumentService', () => {
  const createService = () => {
    const documentRepository = {
      findOne: jest.fn(),
      findByContentHashAndUser: jest.fn(),
    };
    const chunkRepository = {};
    const userDocumentRepository = {
      create: jest.fn(),
    };
    const folderRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
    };
    const dataSource = {};
    const eventEmitter = {
      emit: jest.fn(),
    };
    const documentStorageService = {
      saveFile: jest.fn(),
    };
    const service = new DocumentService(
      documentRepository as never,
      chunkRepository as never,
      userDocumentRepository as never,
      folderRepository as never,
      dataSource as never,
      eventEmitter as never,
      documentStorageService as never,
    );

    return {
      documentRepository,
      documentStorageService,
      eventEmitter,
      folderRepository,
      service,
      userDocumentRepository,
    };
  };

  const createFile = (): Express.Multer.File =>
    ({
      originalname: 'shared.pdf',
      mimetype: 'application/pdf',
      buffer: Buffer.from('same file bytes'),
      size: 15,
    }) as Express.Multer.File;

  const existingDocument = {
    id: 'document-1',
    title: 'Shared document',
    fileRef: 'shared.pdf',
    chunks: [{ id: 'chunk-1' }],
  };

  it('does not link a duplicate document before validating the target folder', async () => {
    const {
      documentRepository,
      documentStorageService,
      folderRepository,
      service,
      userDocumentRepository,
    } = createService();
    documentRepository.findOne.mockResolvedValue(existingDocument);
    documentRepository.findByContentHashAndUser.mockResolvedValue(null);
    folderRepository.findOne.mockResolvedValue(null);

    await expect(
      service.uploadDocument(
        createFile(),
        { title: 'Shared copy', folderId: 'missing-folder' },
        'user-2',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(userDocumentRepository.create).not.toHaveBeenCalled();
    expect(documentStorageService.saveFile).not.toHaveBeenCalled();
  });

  it('links a duplicate document to the validated folder for another user', async () => {
    const {
      documentRepository,
      eventEmitter,
      folderRepository,
      service,
      userDocumentRepository,
    } = createService();
    documentRepository.findOne.mockResolvedValue(existingDocument);
    documentRepository.findByContentHashAndUser.mockResolvedValue(null);
    folderRepository.findOne.mockResolvedValue({ id: 'folder-1' });
    userDocumentRepository.create.mockResolvedValue({ id: 'user-document-1' });

    await expect(
      service.uploadDocument(
        createFile(),
        { title: 'Shared copy', folderId: 'folder-1' },
        'user-2',
      ),
    ).resolves.toEqual({
      id: 'document-1',
      ownerId: 'user-2',
      title: 'Shared document',
      fileName: 'shared.pdf',
      totalChunks: 1,
    });

    expect(userDocumentRepository.create).toHaveBeenCalledWith({
      user: { id: 'user-2' },
      document: { id: 'document-1' },
      folder: { id: 'folder-1' },
      documentName: 'Shared copy',
      isFavorite: false,
    });
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });
});
