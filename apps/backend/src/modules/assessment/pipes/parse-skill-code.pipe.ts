import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from "@nestjs/common";

@Injectable()
export class ParseSkillCodePipe implements PipeTransform<string, string> {
  private static readonly SKILL_CODE_PATTERN = /^[a-z_]+(\.[a-z_]+)+$/;

  transform(value: string, _metadata: ArgumentMetadata): string {
    if (!value || !ParseSkillCodePipe.SKILL_CODE_PATTERN.test(value)) {
      throw new BadRequestException(
        `Định dạng mã kỹ năng không hợp lệ: "${value}". Định dạng chuẩn: "<skill>.<descriptor>" (ví dụ: reading.skimming).`,
      );
    }
    return value;
  }
}
