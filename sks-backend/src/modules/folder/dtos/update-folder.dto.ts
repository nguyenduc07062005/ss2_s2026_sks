import { IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateFolderDto {
  @IsUUID()
  folderId: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;
}
