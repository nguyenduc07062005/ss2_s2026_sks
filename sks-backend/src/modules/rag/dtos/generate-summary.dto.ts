import { IsIn, IsOptional } from 'class-validator';
import { SUMMARY_LANGUAGES } from '../types/rag.types';
import type { SummaryLanguage } from '../types/rag.types';

export class GenerateSummaryDto {
  @IsOptional()
  @IsIn([...SUMMARY_LANGUAGES])
  language?: SummaryLanguage;
}
