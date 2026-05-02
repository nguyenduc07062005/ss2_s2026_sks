import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateDocumentNoteDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  noteId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsString()
  @MaxLength(20000)
  content: string;
}
