import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { SUMMARY_LANGUAGES, SUMMARY_VERSION_SLOTS } from '../types/rag.types';
import type { SummaryLanguage, SummaryVersionSlot } from '../types/rag.types';

export class GenerateSummaryDto {
  @IsOptional()
  @IsIn([...SUMMARY_LANGUAGES])
  language?: SummaryLanguage;

  @IsOptional()
  @IsBoolean()
  forceRefresh?: boolean;

  @IsOptional()
  @IsIn([...SUMMARY_VERSION_SLOTS])
  slot?: SummaryVersionSlot;

  @IsOptional()
  @IsString()
  @MaxLength(1500)
  instruction?: string;
}
