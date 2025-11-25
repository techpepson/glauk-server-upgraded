import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { QuestionType, QuizDifficulty } from '../enum/enum';

export class QuizDto {
  @IsString()
  @IsNotEmpty()
  courseArea: string;

  @IsEnum(QuizDifficulty)
  @IsNotEmpty()
  difficultyLevel: QuizDifficulty;

  @IsString()
  @IsNotEmpty()
  course: string;

  @IsEnum(QuestionType)
  @IsNotEmpty()
  questionType: QuestionType;

  @IsNumber()
  @IsNotEmpty()
  numberOfQuestions: number;

  @IsString()
  @IsOptional()
  additionalNotes: string;
}

export class QuizResponseDto {
  @IsNumber()
  @IsNotEmpty()
  gradePoint: number;

  @IsString()
  @IsNotEmpty()
  grade: string;

  @IsInt()
  @IsNotEmpty()
  correctAnswers: number;

  @IsInt()
  @IsNotEmpty()
  totalQuestions: number;

  @IsString()
  @IsOptional()
  remarks: string;
}
