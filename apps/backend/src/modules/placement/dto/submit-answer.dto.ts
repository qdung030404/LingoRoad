import { IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class SubmitAnswerDto {
  @IsUUID()
  @IsNotEmpty()
  itemId: string;

  @IsInt()
  @Min(0)
  itemIndex: number;

  @IsString()
  @IsNotEmpty()
  selectedOption: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  responseTimeMs?: number;
}
