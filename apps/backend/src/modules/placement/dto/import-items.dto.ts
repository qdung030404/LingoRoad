import { IsArray, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class RawItemDto {
  @IsString()
  @IsNotEmpty()
  skillCode: string;

  @IsString()
  @IsNotEmpty()
  cefrLevel: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  stem?: string;

  @IsOptional()
  @IsString()
  prompt?: string;

  @IsArray()
  options: string[];

  @IsOptional()
  @IsString()
  correctAnswer?: string;

  @IsOptional()
  @IsString()
  correctOption?: string;

  @IsOptional()
  @IsString()
  explanation?: string;

  @IsOptional()
  @IsString()
  audioUrl?: string;

  @IsOptional()
  @IsNumber()
  a?: number;

  @IsOptional()
  @IsNumber()
  b?: number;

  @IsOptional()
  @IsNumber()
  c?: number;

  @IsOptional()
  @IsNumber()
  irtA?: number;

  @IsOptional()
  @IsNumber()
  irtB?: number;

  @IsOptional()
  @IsNumber()
  irtC?: number;
}
