import { describe, it, expect } from "vitest";
import { scoreMatch } from "../src/resumeMatch";

const JD = "Project management role requiring agile scrum budgeting stakeholder communication and reporting skills daily";

describe("scoreMatch", () => {
  it("scores identical texts ~100 / strong", () => {
    const r = scoreMatch(JD, JD);
    expect(r.ok).toBe(true);
    expect(r.score).toBe(100);
    expect(r.band).toBe("strong");
    expect(r.missing).toEqual([]);
  });

  it("scores zero overlap as weak with a non-empty missing list", () => {
    const resume = "Experienced carpenter building wooden furniture cabinets tables chairs decks fences homes";
    const r = scoreMatch(resume, JD);
    expect(r.ok).toBe(true);
    expect(r.band).toBe("weak");
    expect(r.score).toBeLessThan(20);
    expect(r.matched.length).toBeLessThanOrEqual(1);
    expect(r.missing.length).toBeGreaterThan(0);
  });

  it("credits stemmed + soft-phrase overlap, surfaces a genuine gap", () => {
    const resume = "Led project management using agile scrum methods plus stakeholder communication across teams";
    const r = scoreMatch(resume, JD);
    expect(r.ok).toBe(true);
    expect(["partial", "strong"]).toContain(r.band);
    expect(r.matched).toContain("agile");
    expect(r.missing).toContain("budgeting");
  });

  it("returns ok:false for empty or too-short input", () => {
    expect(scoreMatch("", JD).ok).toBe(false);
    expect(scoreMatch("short resume", JD).ok).toBe(false);
    expect(scoreMatch(JD, "hi").ok).toBe(false);
  });

  it("excludes stopwords, filler, and bare numbers from matched/missing", () => {
    const jd = "Managed 5 engineers and the 2020 budget with strong leadership experience and clear reporting";
    const resume = "Managed engineers and budget with leadership and reporting over many years total";
    const r = scoreMatch(resume, jd);
    const all = [...r.matched, ...r.missing];
    for (const bad of ["and", "the", "with", "5", "2020", "strong", "experience"]) {
      expect(all).not.toContain(bad);
    }
  });
});

// ---------------------------------------------------------------------------
// Calibration — realistic fixtures define the quality bar (anti-inflation).
// ---------------------------------------------------------------------------

// Condensed from a realistic Senior Business Analyst JD (fintech, public finance).
const SENIOR_BA_JD = `Senior Business Analyst. Acme Financial Solutions provides treasury management and liquidity management to the public sector, local governments, and school districts. As the Senior Business Analyst on the LedgerMax product POD, you will own the requirements and delivery, partner with the product owner, engineers, and designers, and translate business needs into well-defined features. Thrive in an Agile team environment. Participate in sprint ceremonies, refine the product backlog with the product owner, and serve as the bridge to stakeholders. Elicit and document business requirements through stakeholder interviews and data analysis. Translate business needs into detailed user stories, acceptance criteria, and functional specifications. Define and execute user acceptance testing for each release. Create process documentation and data-flow diagrams. Strong understanding of Agile Scrum methodologies. Experience with backlog management tools such as Jira and documentation platforms such as Confluence. Understanding of software architecture concepts including APIs, microservices, and data models. Proficiency with data analysis and visualization. Seven years as a Business Analyst, preferably in financial services.`;

// Condensed strong senior-BA / product résumé (investments domain). A naive
// bag-of-words scorer rated this 45 ("so-so"); a human rates it ~85. This is
// the regression guard.
const STRONG_RESUME = `Technical Product Leader and Product Architect with eighteen years in investments technology. Promoted from Senior Business Analyst. Owned architecture, requirements, and delivery across data-heavy products. Drove roadmap and backlog prioritization, partnered with product owners, engineers, and designers, and ran Agile sprint planning and ceremonies. Translated business needs into user stories, acceptance criteria, and functional specifications. Elicited requirements through stakeholder interviews and data analysis; defined and coordinated user acceptance testing. Built data-flow diagrams and process documentation. Bridged business and engineering stakeholders. Tools: Jira, Confluence, SQL, Python, Tableau, Snowflake. Designed APIs and data models across microservices. Financial services and capital markets domain.`;

const PARTIAL_RESUME = `Business analyst with three years writing user stories and acceptance criteria, refining the product backlog with product owners, and running sprint ceremonies. Gathered business requirements from stakeholders and wrote functional specifications. Performed data analysis and reporting for financial services clients. Tracked work in Jira and documentation in Confluence.`;

const WEAK_RESUME = "Experienced carpenter framing houses, installing cabinets, doors, and trim, pouring concrete, and operating power tools on residential construction sites for fifteen years.";

describe("scoreMatch calibration", () => {
  it("STRONG: senior-BA resume vs senior-BA JD lands strong", () => {
    const r = scoreMatch(STRONG_RESUME, SENIOR_BA_JD);
    expect(r.score).toBeGreaterThanOrEqual(75);
    expect(r.band).toBe("strong");
  });

  it("PARTIAL: core-skills-but-incomplete resume lands in the partial band", () => {
    const r = scoreMatch(PARTIAL_RESUME, SENIOR_BA_JD);
    expect(r.band).toBe("partial");
    expect(r.score).toBeGreaterThanOrEqual(45);
    expect(r.score).toBeLessThan(75);
  });

  it("WEAK: unrelated resume stays weak (no over-inflation)", () => {
    const r = scoreMatch(WEAK_RESUME, SENIOR_BA_JD);
    expect(r.band).toBe("weak");
    expect(r.score).toBeLessThan(25);
  });
});
