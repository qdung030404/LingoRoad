import { Test, TestingModule } from "@nestjs/testing";
import { ThrottlerGuard } from "@nestjs/throttler";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { AssessmentController } from "./assessment.controller";
import { AssessmentMatrixService } from "./services/assessment-matrix.service";
import { AssessmentPracticeService } from "./services/assessment-practice.service";
import { EvaluateCefrWritingUseCase } from "./services/evaluate-cefr-writing.use-case";
import { AssessmentSkill, CefrLevel, ItemUsageScope } from "@prisma/client";
import {
  CefrWritingTaskType,
  EvaluationLevelStatus,
} from "../ml/dto/evaluate-cefr-writing.dto";

describe("AssessmentController", () => {
  let controller: AssessmentController;
  let matrixService: jest.Mocked<Partial<AssessmentMatrixService>>;
  let practiceService: jest.Mocked<Partial<AssessmentPracticeService>>;
  let writingUseCase: jest.Mocked<Partial<EvaluateCefrWritingUseCase>>;

  beforeEach(async () => {
    matrixService = {
      getMatrixOverview: jest.fn().mockResolvedValue({
        totalSupportedLevels: 6,
        totalSkills: 4,
        matrix: [],
        summary: { totalGroups: 0, totalItems: 0 },
      }),
      getItemsByDescriptor: jest.fn().mockResolvedValue({
        data: [],
        total: 0,
        limit: 20,
        offset: 0,
      }),
    };

    practiceService = {
      getPracticeGroups: jest.fn().mockResolvedValue({
        total: 0,
        limit: 10,
        offset: 0,
        data: [],
      }),
      getPracticeGroupById: jest.fn().mockResolvedValue({
        id: "mock-id",
        skill: AssessmentSkill.READING,
        title: "Mock Test",
        cefrLevel: CefrLevel.B1,
        partNumber: 1,
        passage: null,
        audioUrl: null,
        usageScope: ItemUsageScope.ALL,
        items: [],
      }),
      getWritingPracticeItems: jest.fn().mockResolvedValue({
        items: [
          {
            id: "item-writing-1",
            skill: AssessmentSkill.WRITING,
            skillCode: "writing.opinion_essay",
            cefrLevel: CefrLevel.B2,
            type: "ESSAY",
            prompt: "Write an essay about AI.",
          },
        ],
        total: 1,
      }),
    };

    writingUseCase = {
      execute: jest.fn().mockResolvedValue({
        levelEvaluation: {
          status: EvaluationLevelStatus.MEETS_EXPECTATIONS,
          summaryVi: "Đạt chuẩn B2",
          encouragementVi: "Tiếp tục cố gắng!",
        },
        grammarChecklist: [],
        improvementSteps: ["Phát triển thêm ý"],
        feedback: [],
        overallCommentVi: "Bài viết khá tốt.",
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AssessmentController],
      providers: [
        { provide: AssessmentMatrixService, useValue: matrixService },
        { provide: AssessmentPracticeService, useValue: practiceService },
        { provide: EvaluateCefrWritingUseCase, useValue: writingUseCase },
      ],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AssessmentController>(AssessmentController);
  });

  it("getMatrixOverview should return wrapped api response", async () => {
    const res = await controller.getMatrixOverview();
    expect(res.success).toBe(true);
    expect(res.data).toBeDefined();
    expect(matrixService.getMatrixOverview).toHaveBeenCalledTimes(1);
  });

  it("getPracticeGroups should return wrapped response with pagination meta", async () => {
    const res = await controller.getPracticeGroups({ limit: 10, offset: 0 });
    expect(res.success).toBe(true);
    expect(res.meta.total).toBe(0);
    expect(practiceService.getPracticeGroups).toHaveBeenCalled();
  });

  it("getPracticeGroupById should return wrapped group detail", async () => {
    const res = await controller.getPracticeGroupById(
      "a0000000-0000-0000-0000-000000000001",
    );
    expect(res.success).toBe(true);
    expect(res.data.id).toBe("mock-id");
  });

  it("getItemsByDescriptor should return wrapped items list with meta and message", async () => {
    const res = await controller.getItemsByDescriptor("reading.skimming", {
      cefrLevel: CefrLevel.B1,
      limit: 20,
      offset: 0,
    });
    expect(res.success).toBe(true);
    expect(res.message).toBe("Tra cứu câu hỏi theo chuẩn Can-Do thành công");
    expect(res.data).toEqual([]);
    expect(res.meta.total).toBe(0);
    expect(matrixService.getItemsByDescriptor).toHaveBeenCalledWith(
      "reading.skimming",
      CefrLevel.B1,
      { limit: 20, offset: 0 },
    );
  });

  it("evaluateWriting should return wrapped evaluation result", async () => {
    const dto = {
      taskType: CefrWritingTaskType.TASK_2,
      taskPrompt: "Write an essay about renewable energy.",
      essay:
        "Renewable energy is vital for our future development. In recent years, countries have invested heavily in solar and wind power to protect the ecosystem.",
      targetCefr: "B2",
    };

    const res = await controller.evaluateWriting(dto);
    expect(res.success).toBe(true);
    expect(res.message).toBe("Đánh giá bài viết theo chuẩn CEFR thành công");
    expect(res.data.levelEvaluation.status).toBe(
      EvaluationLevelStatus.MEETS_EXPECTATIONS,
    );
    expect(res.data.levelEvaluation.summaryVi).toBe("Đạt chuẩn B2");
    expect(writingUseCase.execute).toHaveBeenCalledWith(dto);
  });

  it("getWritingItems should return practice writing items from db with total count", async () => {
    const res = await controller.getWritingItems({
      cefrLevel: CefrLevel.B2,
      limit: 20,
      offset: 0,
    });
    expect(res.success).toBe(true);
    expect(res.message).toBe("Lấy danh sách đề bài viết từ ngân hàng đề thành công");
    expect(res.data.items.length).toBe(1);
    expect(res.data.total).toBe(1);
    expect(res.data.items[0].skillCode).toBe("writing.opinion_essay");
    expect(practiceService.getWritingPracticeItems).toHaveBeenCalledWith(
      CefrLevel.B2,
      { limit: 20, offset: 0 },
    );
  });
});
