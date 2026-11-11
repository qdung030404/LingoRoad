import { ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { NestExpressApplication } from "@nestjs/platform-express";
import request = require("supertest");
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/modules/prisma/prisma.service";
import { HttpExceptionFilter } from "../src/common/filters/http-exception.filter";
import { seedCefrBank } from "../prisma/seed-cefr-bank";

describe("AssessmentModule (E2E Integration & Zero Leakage)", () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let authToken: string;
  let testUserEmail: string;

  beforeAll(async () => {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error("DATABASE_URL is not set for E2E tests.");
    }
    const dbName = new URL(databaseUrl).pathname.slice(1);
    if (
      !dbName.endsWith("_test") &&
      !/^lingoroad_(demo|test)$/.test(dbName)
    ) {
      throw new Error(
        `E2E tests must run on test/demo databases. Current DB: ${dbName}`,
      );
    }

    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication<NestExpressApplication>();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();

    prisma = app.get(PrismaService);
    // Ensure CEFR bank has sample data
    await seedCefrBank(prisma);

    // Register a test user to obtain JWT token for authenticated endpoints
    testUserEmail = `assess-e2e-${Date.now()}@example.com`;
    const regRes = await request(app.getHttpServer())
      .post("/auth/register")
      .send({
        name: "Assessment Tester",
        email: testUserEmail,
        password: "Password123!",
      })
      .expect(201);
    authToken = regRes.body.data.accessToken;
    expect(authToken).toEqual(expect.any(String));
  });

  afterAll(async () => {
    if (prisma && testUserEmail) {
      await prisma.user.deleteMany({ where: { email: testUserEmail } });
    }
    if (app) {
      await app.close();
    }
  });

  describe("GET /api/v1/assessment/matrix", () => {
    it("should return 200 with 24 CEFR cells and overview summary", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/assessment/matrix")
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.totalSupportedLevels).toBe(6);
      expect(res.body.data.totalSkills).toBe(4);
      expect(res.body.data.matrix).toHaveLength(24);
      expect(res.body.data.summary).toBeDefined();
      expect(res.body.data.summary.totalGroups).toBeGreaterThanOrEqual(1);
      expect(res.body.data.summary.totalItems).toBeGreaterThanOrEqual(1);
    });

    it("should support alternative route prefix /assessment/matrix", async () => {
      const res = await request(app.getHttpServer())
        .get("/assessment/matrix")
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.matrix).toHaveLength(24);
    });
  });

  describe("GET /api/v1/assessment/practice/groups", () => {
    it("should return 401 Unauthorized when request lacks JWT bearer token", async () => {
      await request(app.getHttpServer())
        .get("/api/v1/assessment/practice/groups")
        .expect(401);
    });

    it("should return paginated groups and enforce Zero Leakage when authenticated", async () => {
      const res = await request(app.getHttpServer())
        .get(
          "/api/v1/assessment/practice/groups?skill=READING&cefrLevel=B1&limit=5&offset=0",
        )
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.meta).toBeDefined();
      expect(res.body.meta.limit).toBe(5);
      expect(res.body.meta.offset).toBe(0);
      expect(Array.isArray(res.body.data)).toBe(true);

      for (const group of res.body.data) {
        // ZERO LEAK: transcript must NEVER leak to client
        expect(group.transcript).toBeUndefined();

        if (group.items && group.items.length > 0) {
          for (const item of group.items) {
            // ZERO LEAK: correctOption, explanation, and IRT parameters must NEVER leak
            expect(item.correctOption).toBeUndefined();
            expect(item.explanation).toBeUndefined();
            expect(item.irtA).toBeUndefined();
            expect(item.irtB).toBeUndefined();
            expect(item.irtC).toBeUndefined();
          }
        }
      }
    });

    it("should reject invalid query parameters with 400 Bad Request", async () => {
      await request(app.getHttpServer())
        .get("/api/v1/assessment/practice/groups?limit=999")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(400);

      await request(app.getHttpServer())
        .get("/api/v1/assessment/practice/groups?skill=INVALID_SKILL")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(400);
    });
  });

  describe("GET /api/v1/assessment/practice/groups/:id", () => {
    it("should return 401 Unauthorized when request lacks JWT bearer token", async () => {
      await request(app.getHttpServer())
        .get(
          "/api/v1/assessment/practice/groups/00000000-0000-0000-0000-000000000000",
        )
        .expect(401);
    });

    it("should return 400 for malformed UUID", async () => {
      await request(app.getHttpServer())
        .get("/api/v1/assessment/practice/groups/not-a-uuid")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(400);
    });

    it("should return 404 for non-existent group UUID", async () => {
      await request(app.getHttpServer())
        .get(
          "/api/v1/assessment/practice/groups/00000000-0000-0000-0000-000000000000",
        )
        .set("Authorization", `Bearer ${authToken}`)
        .expect(404);
    });

    it("should return group details without leaking confidential fields", async () => {
      const groupsRes = await request(app.getHttpServer())
        .get("/api/v1/assessment/practice/groups?limit=1")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      if (groupsRes.body.data.length > 0) {
        const sampleId = groupsRes.body.data[0].id;
        const detailRes = await request(app.getHttpServer())
          .get(`/api/v1/assessment/practice/groups/${sampleId}`)
          .set("Authorization", `Bearer ${authToken}`)
          .expect(200);

        expect(detailRes.body.success).toBe(true);
        expect(detailRes.body.data.id).toBe(sampleId);
        expect(detailRes.body.data.transcript).toBeUndefined();
      }
    });
  });

  describe("GET /api/v1/assessment/descriptors/:skillCode", () => {
    it("should return 401 Unauthorized when request lacks JWT bearer token", async () => {
      await request(app.getHttpServer())
        .get("/api/v1/assessment/descriptors/reading.skimming?cefrLevel=B1")
        .expect(401);
    });

    it("should return safe items and omit answers, explanations, and IRT weights when authenticated", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/assessment/descriptors/reading.skimming?cefrLevel=B1")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);

      for (const item of res.body.data) {
        // ZERO LEAKAGE
        expect(item.correctOption).toBeUndefined();
        expect(item.explanation).toBeUndefined();
        expect(item.irtA).toBeUndefined();
        expect(item.irtB).toBeUndefined();
        expect(item.irtC).toBeUndefined();
        expect(item.usageScope).toBeDefined();

        if (item.group) {
          expect(item.group.transcript).toBeUndefined();
        }
      }
    });

    it("should return 400 Bad Request when cefrLevel query is invalid", async () => {
      await request(app.getHttpServer())
        .get(
          "/api/v1/assessment/descriptors/reading.skimming?cefrLevel=INVALID_CEFR",
        )
        .set("Authorization", `Bearer ${authToken}`)
        .expect(400);
    });

    it("should return 400 Bad Request when skillCode format is invalid", async () => {
      await request(app.getHttpServer())
        .get("/api/v1/assessment/descriptors/invalid-format?cefrLevel=B1")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(400);
    });
  });
});
