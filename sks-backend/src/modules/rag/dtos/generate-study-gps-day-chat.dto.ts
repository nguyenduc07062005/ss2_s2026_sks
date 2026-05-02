import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

const STUDY_GPS_DAY_CHAT_ROLES = ['user', 'assistant'] as const;

class StudyGpsDayChatHistoryItemDto {
  @IsIn([...STUDY_GPS_DAY_CHAT_ROLES])
  role!: (typeof STUDY_GPS_DAY_CHAT_ROLES)[number];

  @IsString()
  @MaxLength(4000)
  content!: string;
}

export class GenerateStudyGpsDayChatDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  day!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  message!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => StudyGpsDayChatHistoryItemDto)
  history?: StudyGpsDayChatHistoryItemDto[];
}

export class StartStudyGpsDayChatDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  day!: number;
}
