import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { MAX_QUIZ_DOCUMENTS } from '../constants';

export class QuizChatDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_QUIZ_DOCUMENTS)
  @IsUUID('4', { each: true })
  documentIds!: string[];

  @IsString()
  @MinLength(2)
  @MaxLength(1600)
  question!: string;
}
