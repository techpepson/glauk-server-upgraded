import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CourseDTO {
  @IsString()
  @IsNotEmpty()
  courseName: string;

  @IsString()
  @IsOptional()
  courseDescription: string;

  @IsString()
  @IsNotEmpty()
  courseCode: string;

  @IsNumber({})
  @IsNotEmpty()
  courseCredits: number;

  @IsString()
  @IsOptional()
  courseInstructorEmail: string;
}

export class CourseUpdateDTO {
  @IsString()
  @IsOptional()
  courseName: string;

  @IsString()
  @IsOptional()
  courseDescription: string;

  @IsString()
  @IsOptional()
  courseCode: string;

  @IsNumber()
  @IsOptional()
  courseCredits: number;

  @IsString()
  @IsOptional()
  courseInstructorEmail: string;

  @IsString()
  courseId: string;
}
