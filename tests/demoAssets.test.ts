import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

const root = process.cwd();

describe("landing demo asset workflow", () => {
  it("documents the selected ASP demo target and expected assets", async () => {
    const docs = await readFile(path.join(root, "DEMO_ASSETS.md"), "utf8");

    expect(docs).toContain("demo-source/ASP.pdf");
    expect(docs).toContain("Preset: Academic Paper");
    expect(docs).toContain("iPad / Tablet preset preserves full pages");
    expect(docs).toContain("Page 1 · left column · tile 2 of 2");
    expect(docs).toContain("public/demo/demo-original.png");
    expect(docs).toContain("public/demo/demo-optimized-academic.png");
    expect(docs).toContain("reuse the Academic asset inside a tablet preview frame");
    expect(docs).toContain("body page, not a title page");
  });

  it("exposes a capture:demo script", async () => {
    const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));

    expect(pkg.scripts["capture:demo"]).toBe("node scripts/capture-demo-assets.mjs");
  });

  it("fails clearly when the ASP demo source is missing", () => {
    const result = spawnSync("node", ["scripts/capture-demo-assets.mjs"], {
      cwd: root,
      env: {
        ...process.env,
        CAPTURE_DEMO_SOURCE: "demo-source/DOES-NOT-EXIST.pdf"
      },
      encoding: "utf8"
    });
    const output = `${result.stdout}\n${result.stderr}`;

    expect(result.status).toBe(1);
    expect(output).toContain("demo-source/ASP.pdf");
    expect(output).toContain("Preset: Academic Paper");
    expect(output).toContain("Page 1 · left column · tile 2 of 2");
    expect(output).not.toContain("Error:");
  });
});
