import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const templateRoot = new URL("../", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the adaptive learning product shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Adaptive SVA Studio<\/title>/i);
  assert.match(html, /Medium.*item/s);
  assert.match(html, /Current knowledge unit/);
  assert.match(html, /Learning goal/);
  assert.match(html, /Identify the subject in a sentence and notice whether it is singular or plural/);
  assert.match(html, /Student answer/);
  assert.match(html, /Supporting information/);
  assert.match(html, /Curriculum/);
  assert.match(html, /Mastery/);
  assert.match(html, /Affect \/ AbLe/);
  assert.match(html, /Item JSON/);
  assert.match(html, /Events/);
  assert.match(html, /BKT model/);
  assert.match(html, /Subject-verb agreement curriculum map/);
  assert.match(html, /With rising costs, Mr Tan/);
  assert.doesNotMatch(html, /Lesson navigation|Expand All|Collapse All/);
  assert.doesNotMatch(html, /Your site is taking shape|react-loading-skeleton|codex-preview/i);
});

test("removes disposable starter preview files and metadata", async () => {
  const [page, layout, packageJson, readme, items] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../README.md", import.meta.url), "utf8"),
    readFile(new URL("../content/grammar-sva/items.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /calculateBkt/);
  assert.match(page, /Wrong despite knowing it/);
  assert.match(page, /Next question/);
  assert.match(page, /current\.difficulty} item/);
  assert.match(page, /Learning path/);
  assert.match(page, /Subject-verb agreement domain knowledge model/);
  assert.match(page, /domainNodes/);
  assert.match(page, /Teaching signals/);
  assert.match(page, /Use this information/);
  assert.match(page, /Curriculum calculation/);
  assert.match(page, /ableFromSignal/);
  assert.match(page, /Recent affect records/);
  assert.match(page, /workedExampleFor/);
  assert.match(page, /ableStudentMessage/);
  assert.match(page, /Open worked example/);
  assert.match(page, /Prerequisite gap/);
  assert.match(page, /average\(/);
  assert.doesNotMatch(page, /Skill signals/);
  assert.match(page, /masteryThreshold/);
  assert.match(page, /Mastered/);
  assert.match(page, /activeInfoTab/);
  assert.match(page, /Subject-verb agreement curriculum map/);
  assert.match(items, /"difficulty": "Easy"/);
  assert.match(items, /"ku": "KU2"[\s\S]*"skill": "subject-number"/);
  assert.match(items, /chatgpt-generated-draft/);
  assert.doesNotMatch(page, /aria-label="Lesson navigation"/);
  assert.match(layout, /Adaptive SVA Studio/);
  assert.match(packageJson, /"name": "adaptive-sva-studio"/);
  assert.match(readme, /Bayesian Knowledge Tracing/);
  assert.match(readme, /subject verb agreement combined\.pdf/);
  assert.doesNotMatch(page, /SkeletonPreview|_sites-preview|codex-preview/);
  assert.doesNotMatch(layout, /Starter Project|codex-preview|_sites-preview/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);

  await assert.rejects(access(new URL("app/_sites-preview", templateRoot)));
});
