import { IsUUID } from 'class-validator';

export class AddDocumentToFolderDto {
  @IsUUID()
  folderId: string;

  @IsUUID()
  documentId: string;
}
