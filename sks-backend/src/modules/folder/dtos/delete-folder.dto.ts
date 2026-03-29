import { IsUUID } from 'class-validator';

export class DeleteFolderDto {
  @IsUUID()
  folderId: string;
}
