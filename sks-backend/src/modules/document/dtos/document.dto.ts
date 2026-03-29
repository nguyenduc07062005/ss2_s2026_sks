import {
  IsOptional,
  IsString,
  IsDateString,
  IsArray,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';

export class MetadataDto {
  @IsOptional()
  @IsString()
  topic?: string;

  @IsOptional()
  @IsString()
  field?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];

  @IsOptional()
  @IsString()
  methodology?: string;

  [key: string]: any;
}

export class DocumentDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsOptional()
  @IsObject()
  @Type(() => MetadataDto)
  metadata?: MetadataDto;

  @IsDateString()
  @IsOptional()
  docDate?: Date;

  @IsOptional()
  @IsObject()
  extraAttributes?: Record<string, any>;

  @IsString()
  @IsOptional()
  fileRef?: string;

  @IsOptional()
  fileSize?: number;

  @IsString()
  @IsOptional()
  folderId?: string;

  @IsArray()
  @IsOptional()
  chunks?: string[];
}
