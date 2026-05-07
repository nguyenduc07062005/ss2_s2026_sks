import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsUUID,
} from 'class-validator';
import {
  QUIZ_DIFFICULTIES,
  QUIZ_QUESTION_COUNTS,
  QUIZ_QUESTION_TYPES,
  SUMMARY_LANGUAGES,
} from '../types/rag.types';
import type {
  QuizDifficulty,
  QuizQuestionCount,
  QuizQuestionType,
  SummaryLanguage,
} from '../types/rag.types';
import { MAX_QUIZ_DOCUMENTS } from '../constants';

export class GenerateQuizDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_QUIZ_DOCUMENTS)
  @IsUUID('4', { each: true })
  documentIds!: string[];

  @IsIn([...SUMMARY_LANGUAGES])
  language!: SummaryLanguage;

  @IsIn([...QUIZ_QUESTION_COUNTS])
  questionCount!: QuizQuestionCount;

  @IsIn([...QUIZ_DIFFICULTIES])
  difficulty!: QuizDifficulty;

  @IsIn([...QUIZ_QUESTION_TYPES])
  questionType!: QuizQuestionType;

  @IsOptional()
  @IsBoolean()
  forceRefresh?: boolean;
}
