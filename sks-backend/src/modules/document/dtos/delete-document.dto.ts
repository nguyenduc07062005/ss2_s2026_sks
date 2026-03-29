import { IsUUID } from 'class-validator';

export class DeleteDocumentDto {
  @IsUUID('4', { message: 'Invalid document ID' })
  documentId: string;
}
