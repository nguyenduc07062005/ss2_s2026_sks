import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import {
  STUDY_GPS_GOALS,
  STUDY_GPS_LEVELS,
  SUMMARY_LANGUAGES,
} from '../types/rag.types';
import type {
  StudyGpsGoal,
  StudyGpsLevel,
  SummaryLanguage,
} from '../types/rag.types';

export class GenerateStudyGpsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(8)
  @IsUUID('4', { each: true })
  documentIds: string[];

  @IsIn([...STUDY_GPS_GOALS])
  goal: StudyGpsGoal;

  @IsIn([...STUDY_GPS_LEVELS])
  level: StudyGpsLevel;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  daysLeft: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  hoursPerDay: number;

  @IsOptional()
  @IsIn([...SUMMARY_LANGUAGES])
  language?: SummaryLanguage;
}
