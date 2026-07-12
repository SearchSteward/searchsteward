import { describe, it, expect } from "vitest";
import { stem } from "../src/stem";

describe("stem", () => {
  it("strips plurals", () => {
    expect(stem("companies")).toBe("company");
    expect(stem("stakeholders")).toBe(stem("stakeholder"));
    expect(stem("apis")).toBe(stem("api"));
  });
  it("unifies verb/noun forms", () => {
    expect(stem("managed")).toBe(stem("management"));
    expect(stem("managing")).toBe(stem("managed"));
    expect(stem("requirements")).toBe(stem("requirement"));
    expect(stem("integrations")).toBe(stem("integration"));
  });
  it("collapses doubled consonants after -ing/-ed", () => {
    expect(stem("planning")).toBe("plan");
    expect(stem("running")).toBe("run");
  });
  it("leaves short tokens alone", () => {
    expect(stem("sql")).toBe("sql");
    expect(stem("data")).toBe("data");
  });
});
