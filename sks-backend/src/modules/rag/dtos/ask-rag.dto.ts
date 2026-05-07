import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export const RAG_ASK_MODES = [
  'document_strict',
  'document_assisted',
  'general_chat',
] as const;

export type RagAskMode = (typeof RAG_ASK_MODES)[number];

export class AskRagDto {
  @IsString()
  @MinLength(2)
  @MaxLength(1000)
  question: string;

  @IsOptional()
  @IsIn([...RAG_ASK_MODES])
  mode?: RagAskMode;
}
