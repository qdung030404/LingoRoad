import {
  BadGatewayException,
  BadRequestException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { MlClientService } from "../../ml/ml-client.service";
import { AssessmentItemGroupRepository } from "../repositories/assessment-item-group.repository";
import {
  CefrWritingEvaluationResultDto,
  EvaluateCefrWritingDto,
  EvaluationLevelStatus,
  GrammarChecklistStatus,
} from "../../ml/dto/evaluate-cefr-writing.dto";

@Injectable()
export class EvaluateCefrWritingUseCase {
  private readonly logger = new Logger(EvaluateCefrWritingUseCase.name);
  private static readonly MIN_WORD_COUNT = 20;

  constructor(
    private readonly mlClientService: MlClientService,
    private readonly repository: AssessmentItemGroupRepository,
  ) {}

  /**
   * Đếm số từ thực tế trong bài viết bằng cách phân tách khoảng trắng.
   */
  private countWords(text: string): number {
    return text.trim().split(/\s+/).filter(Boolean).length;
  }

  /**
   * Đánh giá bài viết định tính theo trình độ (Level-adaptive) và Checklist ngữ pháp.
   */
  async execute(
    dto: EvaluateCefrWritingDto,
  ): Promise<CefrWritingEvaluationResultDto> {
    const wordCount = this.countWords(dto.essay);

    if (wordCount < EvaluateCefrWritingUseCase.MIN_WORD_COUNT) {
      throw new BadRequestException(
        `Bài viết quá ngắn (${wordCount} từ). Bài viết cần tối thiểu ${EvaluateCefrWritingUseCase.MIN_WORD_COUNT} từ để hệ thống AI có đủ ngữ cảnh đánh giá theo chuẩn CEFR.`,
      );
    }

    // Tier 1 Defense: Retrieve trusted prompt and CEFR level from DB if itemId is supplied
    let taskPrompt = dto.taskPrompt;
    let targetCefr = dto.targetCefr;
    let rawTaskType = dto.taskType || "TASK_2";
    let targetGrammars = dto.targetGrammars || [];

    if (dto.itemId) {
      const item = await this.repository.findItemById(dto.itemId);
      if (!item) {
        throw new NotFoundException(
          `Không tìm thấy đề bài viết với mã itemId: ${dto.itemId}`,
        );
      }
      taskPrompt = item.prompt;
      targetCefr = item.cefrLevel;
      if (item.skillCode) {
        rawTaskType = item.skillCode;
      }
      if (
        (!targetGrammars || targetGrammars.length === 0) &&
        item.rubricCriteria &&
        typeof item.rubricCriteria === "object" &&
        Array.isArray((item.rubricCriteria as Record<string, unknown>).targetGrammars)
      ) {
        targetGrammars = (item.rubricCriteria as { targetGrammars: string[] }).targetGrammars;
      }
    }

    if (!taskPrompt || !taskPrompt.trim()) {
      throw new BadRequestException(
        "Đề bài viết không hợp lệ. Vui lòng cung cấp itemId hoặc taskPrompt hợp lệ.",
      );
    }

    try {
      const upperTaskType = rawTaskType.toUpperCase();
      const normalizedTaskType: 'TASK_1' | 'TASK_2' =
        upperTaskType.includes('TASK_1') ||
        upperTaskType.includes('LETTER') ||
        upperTaskType.includes('EMAIL')
          ? 'TASK_1'
          : 'TASK_2';

      const mlResult = await this.mlClientService.evaluateCefrWriting({
        task_type: normalizedTaskType,
        task_prompt: taskPrompt,
        essay: dto.essay,
        target_cefr: targetCefr,
        target_grammars: targetGrammars,
      });

      return {
        levelEvaluation: {
          status: mlResult.level_evaluation.status as unknown as EvaluationLevelStatus,
          summaryVi: mlResult.level_evaluation.summary_vi,
          encouragementVi: mlResult.level_evaluation.encouragement_vi,
        },
        grammarChecklist: (mlResult.grammar_checklist || []).map((item) => ({
          grammarPoint: item.grammar_point,
          status: item.status as unknown as GrammarChecklistStatus,
          evidenceSentence: item.evidence_sentence,
          feedbackVi: item.feedback_vi,
        })),
        improvementSteps: mlResult.improvement_steps || [],
        feedback: (mlResult.feedback || []).map((item) => ({
          originalSentence: item.original_sentence,
          issueVi: item.issue_vi,
          suggestion: item.suggestion,
          explanationVi: item.explanation_vi,
        })),
        overallCommentVi: mlResult.overall_comment_vi,
      };
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Đánh giá bài viết qua dịch vụ ML thất bại: ${message}`,
      );
      throw new BadGatewayException(
        "Hệ thống AI đánh giá bài viết tạm thời không khả dụng. Vui lòng thử lại sau.",
      );
    }
  }
}
