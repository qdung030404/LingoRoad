import { BadRequestException } from "@nestjs/common";
import { ParseSkillCodePipe } from "./parse-skill-code.pipe";

describe("ParseSkillCodePipe", () => {
  let pipe: ParseSkillCodePipe;

  beforeEach(() => {
    pipe = new ParseSkillCodePipe();
  });

  it("should accept valid skillCode format", () => {
    expect(pipe.transform("reading.skimming", { type: "param" })).toBe(
      "reading.skimming",
    );
    expect(
      pipe.transform("listening.identifying_facts", { type: "param" }),
    ).toBe("listening.identifying_facts");
  });

  it("should throw BadRequestException for invalid skillCode format", () => {
    expect(() => pipe.transform("invalid", { type: "param" })).toThrow(
      BadRequestException,
    );
    expect(() => pipe.transform("", { type: "param" })).toThrow(
      BadRequestException,
    );
    expect(() => pipe.transform("INVALID.SKILL", { type: "param" })).toThrow(
      BadRequestException,
    );
  });
});
