import { Test, TestingModule } from "@nestjs/testing";
import { ThrottlerGuard } from "@nestjs/throttler";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { AssessmentController } from "./assessment.controller";
import { AssessmentMatrixService } from "./services/assessment-matrix.service";
import { AssessmentPracticeService } from "./services/assessment-practice.service";
import { AssessmentSkill, CefrLevel, ItemUsageScope } from "@prisma/client";

describe("AssessmentController", () => {
  let controller: AssessmentController;
  let matrixService: jest.Mocked<Partial<AssessmentMatrixService>>;
  let practiceService: jest.Mocked<Partial<AssessmentPracticeService>>;

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
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AssessmentController],
      providers: [
        { provide: AssessmentMatrixService, useValue: matrixService },
        { provide: AssessmentPracticeService, useValue: practiceService },
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
});
