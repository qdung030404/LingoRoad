import { CefrScoringService } from "./cefr-scoring.service";
import { AssessmentResponse, CefrLevel } from "../interfaces/placement.interface";

describe("CefrScoringService", () => {
  let service: CefrScoringService;

  beforeEach(() => {
    service = new CefrScoringService();
  });

  describe("evaluateAnswer (Null-Safe & Robustness)", () => {
    it("should return true for matching options regardless of whitespace or casing", () => {
      expect(service.evaluateAnswer("Option A", "option a")).toBe(true);
      expect(service.evaluateAnswer("  Answer 1  ", "Answer 1")).toBe(true);
    });

    it("should return false for different options", () => {
      expect(service.evaluateAnswer("Option A", "Option B")).toBe(false);
    });

    it("should safely return false without throwing when correctOption is null (BUG-02 fix)", () => {
      expect(service.evaluateAnswer(null, "User Essay Submission")).toBe(false);
      expect(service.evaluateAnswer(undefined, "User Audio Response")).toBe(false);
    });

    it("should safely return false when selectedOption is null or empty", () => {
      expect(service.evaluateAnswer("Option A", null)).toBe(false);
      expect(service.evaluateAnswer("Option A", "")).toBe(false);
      expect(service.evaluateAnswer(null, null)).toBe(false);
    });
  });

  describe("calculate", () => {
    it("should return A1 when no responses exist", () => {
      const res = service.calculate([], 10);
      expect(res.estimatedCefr).toBe(CefrLevel.A1);
      expect(res.confidenceScore).toBe(0);
    });

    it("should estimate levels based on cutoff ratios", () => {
      const makeResponses = (correct: number, total: number): AssessmentResponse[] =>
        Array.from({ length: total }, (_, i) => ({
          id: `r-${i}`,
          sessionId: "s-1",
          itemId: `i-${i}`,
          itemIndex: i,
          selectedOption: "A",
          isCorrect: i < correct,
          responseTimeMs: 1200,
          createdAt: new Date(),
        }));

      // < 40% -> A1
      expect(service.calculate(makeResponses(3, 10), 10).estimatedCefr).toBe(CefrLevel.A1);
      // 40% - 65% -> A2
      expect(service.calculate(makeResponses(5, 10), 10).estimatedCefr).toBe(CefrLevel.A2);
      // 65% - 85% -> B1
      expect(service.calculate(makeResponses(7, 10), 10).estimatedCefr).toBe(CefrLevel.B1);
      // >= 85% -> B2
      expect(service.calculate(makeResponses(9, 10), 10).estimatedCefr).toBe(CefrLevel.B2);
    });
  });
});
