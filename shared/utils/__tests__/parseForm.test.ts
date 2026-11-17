import { readFileSync } from "fs";
import { join } from "path";
import { ZodError } from "zod";
import { parseGeneralForm } from "../parseForm";

const exampleDefinition = readFileSync(
  join(__dirname, "../../definitions/generalForms/example.json"),
  "utf-8",
);

describe("parseGeneralForm", () => {
  it("parses the bundled example definition", () => {
    const form = parseGeneralForm(exampleDefinition);
    expect(form.name).toBe("A name for the Survey");
    expect(form.questions.length).toBeGreaterThan(0);
  });

  it("stamps each question with its position as order", () => {
    const form = parseGeneralForm(exampleDefinition);
    expect(form.questions.map((q) => q.order)).toEqual(
      form.questions.map((_, i) => i),
    );
  });

  it("throws a ZodError for invalid JSON", () => {
    expect(() => parseGeneralForm("{not json")).toThrow(ZodError);
  });

  it("throws a ZodError when questions are missing", () => {
    expect(() => parseGeneralForm(JSON.stringify({ name: "x" }))).toThrow(
      ZodError,
    );
  });
});
