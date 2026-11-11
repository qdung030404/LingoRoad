import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { ApiResponse } from "../../common/interfaces/api-response.interface";
import { AssessmentMatrixService } from "./services/assessment-matrix.service";
import { AssessmentPracticeService } from "./services/assessment-practice.service";
import { EvaluateCefrWritingUseCase } from "./services/evaluate-cefr-writing.use-case";
import { GetPracticeGroupsQueryDto } from "./dto/get-practice-groups-query.dto";
import { GetItemsByDescriptorQueryDto } from "./dto/get-items-by-descriptor-query.dto";
import { GetWritingItemsQueryDto } from "./dto/get-writing-items-query.dto";
import {
  CefrWritingEvaluationResultDto,
  EvaluateCefrWritingDto,
} from "../ml/dto/evaluate-cefr-writing.dto";
import { ParseSkillCodePipe } from "./pipes/parse-skill-code.pipe";
import { CefrMatrixOverviewResponse } from "./dto/cefr-matrix-response.dto";
import { AssessmentSafeGroupDto } from "./dto/assessment-safe-group.dto";
import { AssessmentSafeItemDto } from "./dto/assessment-safe-item.dto";
import { CefrLevel } from "@prisma/client";

export interface AssessmentResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface PaginatedMeta {
  total: number;
  limit: number;
  offset: number;
}

export interface PaginatedResponse<T> {
  success: boolean;
  message: string;
  data: T[];
  meta: PaginatedMeta;
}

@Controller(["api/v1/assessment", "assessment"])
@UseGuards(ThrottlerGuard)
export class AssessmentController {
  constructor(
    private readonly matrixService: AssessmentMatrixService,
    private readonly practiceService: AssessmentPracticeService,
    private readonly writingUseCase: EvaluateCefrWritingUseCase,
  ) {}

  /**
   * Lấy cấu trúc toàn diện của Ma trận năng lực CEFR 6 bậc (A1 - C2) và 4 kỹ năng,
   * bao gồm danh sách Can-Do Descriptors và số lượng bài tập tương ứng trong hệ thống.
   * Endpoint này công khai phục vụ tra cứu khung đánh giá chung.
   */
  @Get("matrix")
  @HttpCode(HttpStatus.OK)
  async getMatrixOverview(): Promise<
    AssessmentResponse<CefrMatrixOverviewResponse>
  > {
    const result = await this.matrixService.getMatrixOverview();
    return {
      success: true,
      message: "Lấy ma trận năng lực CEFR thành công",
      data: result,
    };
  }

  /**
   * Lấy danh sách các nhóm bài tập luyện tập (Item Groups) theo kỹ năng và bậc CEFR.
   * TUYỆT ĐỐI KHÔNG trả về correctOption, explanation hay transcript (Zero Leak Policy).
   * Yêu cầu xác thực tài khoản JWT để bảo vệ ngân hàng đề khỏi scraping tự động.
   */
  @Get("practice/groups")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getPracticeGroups(
    @Query() query: GetPracticeGroupsQueryDto,
  ): Promise<PaginatedResponse<AssessmentSafeGroupDto>> {
    const result = await this.practiceService.getPracticeGroups(query);
    return {
      success: true,
      message: "Lấy danh sách đề luyện tập thành công",
      data: result.data,
      meta: {
        total: result.total,
        limit: result.limit,
        offset: result.offset,
      },
    };
  }

  /**
   * Lấy chi tiết một nhóm bài tập luyện tập cụ thể theo ID.
   * Dữ liệu trả về đã được lược bỏ đáp án để học viên làm bài.
   * Yêu cầu xác thực tài khoản JWT.
   */
  @Get("practice/groups/:id")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getPracticeGroupById(
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<AssessmentResponse<AssessmentSafeGroupDto>> {
    const result = await this.practiceService.getPracticeGroupById(id);
    return {
      success: true,
      message: "Lấy chi tiết nhóm đề luyện tập thành công",
      data: result,
    };
  }

  /**
   * Tra cứu câu hỏi theo mã Can-Do Descriptor (phục vụ giáo viên/quản trị viên hoặc gợi ý luyện tập bù hổng).
   * Yêu cầu xác thực tài khoản JWT để bảo vệ kho câu hỏi khỏi scraping.
   */
  @Get("descriptors/:skillCode")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getItemsByDescriptor(
    @Param("skillCode", ParseSkillCodePipe) skillCode: string,
    @Query() query: GetItemsByDescriptorQueryDto,
  ): Promise<PaginatedResponse<AssessmentSafeItemDto>> {
    const result = await this.matrixService.getItemsByDescriptor(
      skillCode,
      query.cefrLevel,
      { limit: query.limit, offset: query.offset },
    );
    return {
      success: true,
      message: "Tra cứu câu hỏi theo chuẩn Can-Do thành công",
      data: result.data,
      meta: {
        total: result.total,
        limit: result.limit,
        offset: result.offset,
      },
    };
  }

  /**
   * Lấy danh sách đề bài luyện viết tự luận từ ngân hàng đề CEFR trong Database.
   * Yêu cầu xác thực tài khoản JWT.
   */
  @Get("writing/items")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getWritingItems(
    @Query() query: GetWritingItemsQueryDto,
  ): Promise<AssessmentResponse<{ items: AssessmentSafeItemDto[]; total: number }>> {
    const result = await this.practiceService.getWritingPracticeItems(
      query.cefrLevel,
      {
        limit: query.limit,
        offset: query.offset,
      },
    );
    return {
      success: true,
      message: "Lấy danh sách đề bài viết từ ngân hàng đề thành công",
      data: result,
    };
  }

  /**
   * Đánh giá tự động bài thi viết tự luận theo 4 tiêu chí CEFR (Automated Writing Evaluation).
   * Yêu cầu xác thực tài khoản JWT và chặn bài viết quá ngắn (< 20 từ).
   */
  @Post("writing/evaluate")
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async evaluateWriting(
    @Body() dto: EvaluateCefrWritingDto,
  ): Promise<AssessmentResponse<CefrWritingEvaluationResultDto>> {
    const result = await this.writingUseCase.execute(dto);
    return {
      success: true,
      message: "Đánh giá bài viết theo chuẩn CEFR thành công",
      data: result,
    };
  }
}
