import {
  AssessmentSkill,
  CefrLevel,
  ItemType,
  ItemUsageScope,
} from "@prisma/client";
import { AssessmentSafeMapper } from "./assessment-safe.mapper";
import { AssessmentItemGroupWithItems } from "../interfaces/assessment.interface";

describe("AssessmentSafeMapper (Zero Leak Security)", () => {
  it("should strictly exclude correctOption, explanation, and IRT parameters from item payload", () => {
    const rawItem = {
      id: "item-uuid-1",
      groupId: "group-uuid-1",
      itemOrder: 2,
      externalId: "ext-001",
      bankVersion: "v1",
      skill: AssessmentSkill.READING,
      skillCode: "reading.skimming",
      cefrLevel: CefrLevel.B1,
      type: ItemType.MULTIPLE_CHOICE,
      prompt: "What is the main topic?",
      options: ["A", "B", "C", "D"],
      correctOption: "B (Confidential Answer)",
      explanation: "Secret Explanation for teachers only",
      audioUrl: null,
      passage: "Sample passage text",
      rubricCriteria: null,
      usageScope: ItemUsageScope.ALL,
      irtA: 1.2,
      irtB: 0.5,
      irtC: 0.25,
      createdAt: new Date(),
    };

    const safeDto = AssessmentSafeMapper.toSafeItem(rawItem);

    // Verify allowed fields exist
    expect(safeDto.id).toBe("item-uuid-1");
    expect(safeDto.itemOrder).toBe(2);
    expect(safeDto.prompt).toBe("What is the main topic?");
    expect(safeDto.options).toEqual(["A", "B", "C", "D"]);
    expect(safeDto.skillCode).toBe("reading.skimming");
    expect(safeDto.cefrLevel).toBe(CefrLevel.B1);

    // VERIFY ZERO LEAKAGE: answer, explanation, and IRT parameters must be completely omitted
    const dynamicDto = safeDto as unknown as Record<string, unknown>;
    expect(dynamicDto.correctOption).toBeUndefined();
    expect(dynamicDto.explanation).toBeUndefined();
    expect(dynamicDto.irtA).toBeUndefined();
    expect(dynamicDto.irtB).toBeUndefined();
    expect(dynamicDto.irtC).toBeUndefined();
  });

  it("should safely map attached group and exclude transcript", () => {
    const rawItemWithGroup = {
      id: "item-uuid-2",
      groupId: "group-uuid-1",
      itemOrder: 1,
      externalId: "ext-002",
      bankVersion: "v1",
      skill: AssessmentSkill.LISTENING,
      skillCode: "listening.detail",
      cefrLevel: CefrLevel.B2,
      type: ItemType.MULTIPLE_CHOICE,
      prompt: "What was announced?",
      options: ["Option A", "Option B"],
      correctOption: "Option A",
      explanation: "Explanation text",
      audioUrl: null,
      passage: null,
      rubricCriteria: null,
      usageScope: ItemUsageScope.ALL,
      irtA: 1.0,
      irtB: 0.8,
      irtC: 0.25,
      createdAt: new Date(),
      group: {
        id: "group-uuid-1",
        skill: AssessmentSkill.LISTENING,
        title: "Group Title",
        cefrLevel: CefrLevel.B2,
        partNumber: 2,
        passage: null,
        audioUrl: "https://cdn.example.com/audio.mp3",
        transcript: "Confidential audio transcript that must never leak",
        usageScope: ItemUsageScope.ALL,
        createdAt: new Date(),
      },
    };

    const safeDto = AssessmentSafeMapper.toSafeItem(rawItemWithGroup);
    expect(safeDto.group).toBeDefined();
    expect(safeDto.group?.title).toBe("Group Title");
    const dynamicGroup = safeDto.group as unknown as Record<string, unknown>;
    expect(dynamicGroup.transcript).toBeUndefined();
  });

  it("should strictly exclude transcript and children answers from group payload", () => {
    const rawGroup: AssessmentItemGroupWithItems = {
      id: "group-uuid-1",
      skill: AssessmentSkill.LISTENING,
      title: "Listening Part 2 Talk",
      cefrLevel: CefrLevel.B2,
      partNumber: 2,
      passage: null,
      audioUrl: "https://cdn.example.com/audio.mp3",
      transcript: "Confidential transcript text",
      usageScope: ItemUsageScope.ALL,
      createdAt: new Date(),
      items: [
        {
          id: "sub-item-1",
          groupId: "group-uuid-1",
          itemOrder: 1,
          externalId: "ext-sub-1",
          bankVersion: "v1",
          skill: AssessmentSkill.LISTENING,
          skillCode: "listening.gist",
          cefrLevel: CefrLevel.B2,
          type: ItemType.MULTIPLE_CHOICE,
          prompt: "Where does this take place?",
          options: ["Hanoi", "Saigon"],
          correctOption: "Hanoi",
          explanation: "Narrator stated Hanoi",
          audioUrl: null,
          passage: null,
          rubricCriteria: null,
          usageScope: ItemUsageScope.ALL,
          irtA: 1.0,
          irtB: 0.8,
          irtC: 0.25,
          createdAt: new Date(),
        },
      ],
    };

    const safeGroupDto = AssessmentSafeMapper.toSafeGroup(rawGroup);

    // Verify group allowed fields
    expect(safeGroupDto.id).toBe("group-uuid-1");
    expect(safeGroupDto.title).toBe("Listening Part 2 Talk");
    expect(safeGroupDto.audioUrl).toBe("https://cdn.example.com/audio.mp3");

    // ZERO LEAK: transcript must be completely omitted
    const dynamicGroup = safeGroupDto as unknown as Record<string, unknown>;
    expect(dynamicGroup.transcript).toBeUndefined();

    // ZERO LEAK on children items
    expect(safeGroupDto.items).toHaveLength(1);
    const safeChild = safeGroupDto.items[0] as unknown as Record<
      string,
      unknown
    >;
    expect(safeChild.id).toBe("sub-item-1");
    expect(safeChild.correctOption).toBeUndefined();
    expect(safeChild.explanation).toBeUndefined();
    expect(safeChild.irtA).toBeUndefined();
  });

  it("should sanitize rubricCriteria and omit confidential evaluation details while preserving wordCount", () => {
    const essayItem = {
      id: "essay-uuid-1",
      groupId: null,
      itemOrder: 1,
      externalId: "ext-essay-001",
      bankVersion: "v1",
      skill: AssessmentSkill.WRITING,
      skillCode: "writing.opinion_essay",
      cefrLevel: CefrLevel.B2,
      type: ItemType.ESSAY,
      prompt: "Write an essay about AI.",
      options: null,
      correctOption: null,
      explanation: null,
      audioUrl: null,
      passage: null,
      rubricCriteria: {
        taskAchievement: "Must address both advantages and disadvantages.",
        coherenceCohesion: "4 clear paragraphs with transitions.",
        lexicalResource: "Advanced vocabulary.",
        grammarAccuracy: "Complex sentence structures.",
        wordCount: { min: 220, max: 280 },
      },
      usageScope: ItemUsageScope.ALL,
      irtA: 1.2,
      irtB: 1.0,
      irtC: 0.0,
      createdAt: new Date(),
    };

    const safeDto = AssessmentSafeMapper.toSafeItem(essayItem);

    // Verify rubricCriteria is sanitized: only wordCount remains, grading rubrics omitted
    expect(safeDto.rubricCriteria).toEqual({
      wordCount: { min: 220, max: 280 },
    });
    const rubricObj = safeDto.rubricCriteria as Record<string, unknown>;
    expect(rubricObj.taskAchievement).toBeUndefined();
    expect(rubricObj.coherenceCohesion).toBeUndefined();
    expect(rubricObj.lexicalResource).toBeUndefined();
    expect(rubricObj.grammarAccuracy).toBeUndefined();
  });

  it("should safely handle non-object or array rubricCriteria without throwing errors", () => {
    const baseItem = {
      id: "item-edge-1",
      groupId: null,
      itemOrder: 1,
      externalId: "ext-edge-1",
      bankVersion: "v1",
      skill: AssessmentSkill.WRITING,
      skillCode: "writing.opinion_essay",
      cefrLevel: CefrLevel.B2,
      type: ItemType.ESSAY,
      prompt: "Prompt",
      options: null,
      correctOption: null,
      explanation: null,
      audioUrl: null,
      passage: null,
      usageScope: ItemUsageScope.ALL,
      irtA: 1.0,
      irtB: 0.0,
      irtC: 0.0,
      createdAt: new Date(),
    };

    // Array rubricCriteria
    const arrayItem = { ...baseItem, rubricCriteria: ["taskAchievement", "grammar"] };
    const safeArrayDto = AssessmentSafeMapper.toSafeItem(arrayItem as unknown as Parameters<typeof AssessmentSafeMapper.toSafeItem>[0]);
    expect(safeArrayDto.rubricCriteria).toBeNull();

    // Primitive string rubricCriteria
    const stringItem = { ...baseItem, rubricCriteria: "plain string criteria" };
    const safeStringDto = AssessmentSafeMapper.toSafeItem(stringItem as unknown as Parameters<typeof AssessmentSafeMapper.toSafeItem>[0]);
    expect(safeStringDto.rubricCriteria).toBeNull();

    // Primitive number rubricCriteria
    const numberItem = { ...baseItem, rubricCriteria: 12345 };
    const safeNumberDto = AssessmentSafeMapper.toSafeItem(numberItem as unknown as Parameters<typeof AssessmentSafeMapper.toSafeItem>[0]);
    expect(safeNumberDto.rubricCriteria).toBeNull();
  });

  it("should preserve public speaking constraints (preparationTimeSeconds, minSpeakingSeconds, maxSpeakingSeconds) and sanitize subjective rubrics (SEC-01)", () => {
    const speakingItem = {
      id: "speak-uuid-1",
      groupId: null,
      itemOrder: 1,
      externalId: "ext-speak-001",
      bankVersion: "v1",
      skill: AssessmentSkill.SPEAKING,
      skillCode: "speaking.solution_presentation",
      cefrLevel: CefrLevel.B1,
      type: ItemType.SPEAKING_PROMPT,
      prompt: "Give a presentation.",
      options: null,
      correctOption: null,
      explanation: null,
      audioUrl: null,
      passage: null,
      rubricCriteria: {
        timeLimitSeconds: 120,
        preparationTimeSeconds: 60,
        minSpeakingSeconds: 90,
        maxSpeakingSeconds: 120,
        fluencyCoherence: "Must speak fluently without excessive hesitation.",
        pronunciation: "Clear intonation and accurate word stress.",
        grammarRange: "Conditionals and complex structures.",
      },
      usageScope: ItemUsageScope.ALL,
      irtA: 1.1,
      irtB: 0.1,
      irtC: 0.0,
      createdAt: new Date(),
    };

    const safeDto = AssessmentSafeMapper.toSafeItem(speakingItem);
    expect(safeDto.rubricCriteria).toEqual({
      timeLimitSeconds: 120,
      preparationTimeSeconds: 60,
      minSpeakingSeconds: 90,
      maxSpeakingSeconds: 120,
    });
    const rubricObj = safeDto.rubricCriteria as Record<string, unknown>;
    expect(rubricObj.fluencyCoherence).toBeUndefined();
    expect(rubricObj.pronunciation).toBeUndefined();
    expect(rubricObj.grammarRange).toBeUndefined();
  });
});
