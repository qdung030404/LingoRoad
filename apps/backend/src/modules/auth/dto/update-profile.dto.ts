import { isIP } from 'node:net';
import { Transform } from 'class-transformer';
import { LearningPurpose } from '@prisma/client';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  registerDecorator,
  ValidateIf,
  ValidationOptions,
} from 'class-validator';

function isSafeAvatarUrlString(value: unknown): boolean {
  if (typeof value !== 'string' || !value) return false;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:') return false;
    if (parsed.username !== '' || parsed.password !== '') return false;
    const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (
      !host ||
      host === 'localhost' ||
      host.endsWith('.local') ||
      host.endsWith('.internal') ||
      !host.includes('.')
    ) {
      return false;
    }
    return isIP(host) === 0;
  } catch {
    return false;
  }
}

function IsSafeAvatarUrl(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isSafeAvatarUrl',
      target: object.constructor,
      propertyName,
      options: {
        message: 'URL ảnh đại diện phải dùng https với tên miền công khai hợp lệ.',
        ...validationOptions,
      },
      validator: {
        validate: (value: unknown) => isSafeAvatarUrlString(value),
      },
    });
  };
}

export class UpdateProfileDto {
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined && value !== null)
  @IsString()
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsSafeAvatarUrl()
  @MaxLength(500)
  avatarUrl?: string | null;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsEnum(LearningPurpose)
  learningPurpose?: LearningPurpose;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsIn(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'])
  targetCefr?: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsInt()
  @Min(5)
  @Max(120)
  dailyGoalMinutes?: number;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(6)
  @ArrayUnique()
  @IsIn(['GRAMMAR', 'VOCABULARY', 'READING', 'LISTENING', 'SPEAKING', 'WRITING'], { each: true })
  preferredKinds?: ('GRAMMAR' | 'VOCABULARY' | 'READING' | 'LISTENING' | 'SPEAKING' | 'WRITING')[];

  @IsOptional()
  @IsIn(['A1', 'A2', 'B1', 'B2'])
  selfAssessedCefr?: 'A1' | 'A2' | 'B1' | 'B2' | null;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsInt()
  @Min(0)
  expectedVersion?: number;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsBoolean()
  reminderEnabled?: boolean;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  reminderTime?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsInt()
  @Min(0)
  expectedReminderVersion?: number;
}
