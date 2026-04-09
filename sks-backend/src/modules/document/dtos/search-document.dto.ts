import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class SearchDocumentDto {
  @IsString()
  q: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @Min(1)
  limit?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @Min(1)
  page?: number;

  @IsOptional()
  @IsUUID()
  folderId?: string;
}
