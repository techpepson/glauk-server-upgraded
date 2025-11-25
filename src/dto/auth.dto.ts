import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class AuthDto {
  @IsString()
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  userName?: string;

  @IsString()
  phone: string;

  @IsNumber()
  @IsOptional()
  targetGpa: number;

  @IsString()
  @IsOptional()
  major: string;

  @IsString()
  @IsOptional()
  profileImage: string;

  @IsBoolean()
  @IsOptional()
  preferEmailNotification: boolean;

  @IsBoolean()
  @IsOptional()
  preferPushNotification: boolean;

  @IsBoolean()
  @IsOptional()
  preferQuizReminders: boolean;

  @IsBoolean()
  @IsOptional()
  preferLeaderboardUpdates: boolean;
}

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password: string;
}

export class AccountUpdateDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  userName?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsNumber()
  @IsOptional()
  targetGpa?: number;

  @IsString()
  @IsOptional()
  major?: string;

  @IsString()
  @IsOptional()
  profileImage?: string;

  @IsBoolean()
  @IsOptional()
  preferEmailNotification?: boolean;

  @IsBoolean()
  @IsOptional()
  preferPushNotification?: boolean;

  @IsBoolean()
  @IsOptional()
  preferQuizReminders?: boolean;

  @IsBoolean()
  @IsOptional()
  preferLeaderboardUpdates?: boolean;
}
