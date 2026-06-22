import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

const TEMPLATES_DIR = resolve(import.meta.dirname, "..", "templates");

describe("create-openshop templates", () => {
  it("has at least one template directory", () => {
    const templates = readdirSync(TEMPLATES_DIR).filter((n) =>
      statSync(join(TEMPLATES_DIR, n)).isDirectory(),
    );
    expect(templates.length).toBeGreaterThanOrEqual(2);
    expect(templates).toContain("node");
    expect(templates).toContain("next");
  });

  it("node template has the expected files", () => {
    const nodeDir = join(TEMPLATES_DIR, "node");
    expect(existsSync(join(nodeDir, "package.json"))).toBe(true);
    expect(existsSync(join(nodeDir, "src", "server.ts"))).toBe(true);
    expect(existsSync(join(nodeDir, ".env"))).toBe(true);
    expect(existsSync(join(nodeDir, "tsconfig.json"))).toBe(true);
  });

  it("next template has the expected files", () => {
    const nextDir = join(TEMPLATES_DIR, "next");
    expect(existsSync(join(nextDir, "package.json"))).toBe(true);
    expect(existsSync(join(nextDir, "src", "app", "page.tsx"))).toBe(true);
    expect(existsSync(join(nextDir, "next.config.ts"))).toBe(true);
  });

  it("templates have placeholder tokens for project name", () => {
    const pkg = require(join(TEMPLATES_DIR, "node", "package.json"));
    expect(pkg.name).toBe("{{PROJECT_NAME}}");
  });
});
