import { IsUUID } from 'class-validator';

export class RemoveDocumentFromFolderDto {
  @IsUUID()
  folderId: string;

  @IsUUID()
  documentId: string;
}
