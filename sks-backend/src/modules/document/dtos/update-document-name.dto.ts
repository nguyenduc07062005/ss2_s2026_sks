import { IsString, IsNotEmpty } from 'class-validator';

export class UpdateDocumentNameDto {
  @IsString()
  @IsNotEmpty()
  newDocumentName: string;
}
