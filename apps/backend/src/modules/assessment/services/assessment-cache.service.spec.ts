import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { AssessmentCacheService } from "./assessment-cache.service";

describe("AssessmentCacheService", () => {
  let service: AssessmentCacheService;
  let configService: Partial<ConfigService>;

  describe("In-Memory Mode (No Redis configured - Bounded & Safe)", () => {
    beforeEach(async () => {
      configService = {
        get: jest.fn().mockReturnValue(undefined),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AssessmentCacheService,
          { provide: ConfigService, useValue: configService },
        ],
      }).compile();

      service = module.get<AssessmentCacheService>(AssessmentCacheService);
      service.onModuleInit();
    });

    afterEach(async () => {
      await service.onModuleDestroy();
    });

    it("should set, get, and del values accurately in in-memory cache", async () => {
      expect(service.isUsingRedis()).toBe(false);

      await service.set("test-key", { hello: "world" }, 60);
      const val = await service.get<{ hello: string }>("test-key");
      expect(val).toEqual({ hello: "world" });

      await service.del("test-key");
      const deletedVal = await service.get("test-key");
      expect(deletedVal).toBeNull();
    });

    it("should return null when key has expired in in-memory cache", async () => {
      await service.set("expired-key", "val", -1);
      const val = await service.get("expired-key");
      expect(val).toBeNull();
    });

    it("should sweep expired keys and avoid memory leaks (PERF-01)", async () => {
      await service.set("expired-1", "val1", -1);
      await service.set("expired-2", "val2", -1);
      await service.set("active-1", "val3", 60);

      expect(service.getInMemorySize()).toBe(3);
      const cleaned = service.sweepExpiredKeys();
      expect(cleaned).toBe(2);
      expect(service.getInMemorySize()).toBe(1);
    });

    it("should bound capacity and evict oldest keys when exceeding max limit (PERF-01)", async () => {
      // Set 205 items (max limit is 200)
      for (let i = 0; i < 205; i++) {
        await service.set(`key-${i}`, `val-${i}`, 60);
      }
      expect(service.getInMemorySize()).toBeLessThanOrEqual(200);
    });
  });

  describe("Graceful Error Handling", () => {
    it("should not throw error on missing keys", async () => {
      configService = {
        get: jest.fn().mockReturnValue(undefined),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AssessmentCacheService,
          { provide: ConfigService, useValue: configService },
        ],
      }).compile();

      service = module.get<AssessmentCacheService>(AssessmentCacheService);
      service.onModuleInit();

      const val = await service.get("non-existent");
      expect(val).toBeNull();
      await service.onModuleDestroy();
    });
  });
});
