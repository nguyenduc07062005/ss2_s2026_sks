import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { SUMMARY_LANGUAGES } from '../types/rag.types';
import type { SummaryLanguage } from '../types/rag.types';

export class GenerateMindMapNodeNoteDto {
  @IsIn([...SUMMARY_LANGUAGES])
  language!: SummaryLanguage;

  @IsString()
  @MaxLength(180)
  label!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  summary?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  @MaxLength(180, { each: true })
  pathLabels?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  @MaxLength(180, { each: true })
  childLabels?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  @MaxLength(180, { each: true })
  siblingLabels?: string[];
}
