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
  assert.match(html, /Student.*Learning Space/s);
  assert.match(html, /Adaptive Learning/);
  assert.match(html, /My Learning Goals/);
  assert.match(html, /Comeback Score/);
  assert.match(html, /Guided Learning/);
  assert.match(html, /Mastery Check/);
  assert.match(html, /Revision/);
  assert.match(html, /Test Myself/);
  assert.match(html, /Continue Learning/i);
  assert.match(html, /Components of the Tourism System/);
  assert.doesNotMatch(html, /Teacher View/);
  assert.doesNotMatch(html, /Lesson navigation|Expand All|Collapse All/);
  assert.doesNotMatch(html, /Your site is taking shape|react-loading-skeleton|codex-preview/i);
});

test("removes disposable starter preview files and metadata", async () => {
  const [page, studentPage, layout, packageJson, readme, items] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/student/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../README.md", import.meta.url), "utf8"),
    readFile(new URL("../content/grammar-sva/items.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /StudentPortalPage/);
  assert.match(studentPage, /calculateBkt/);
  assert.match(studentPage, /Next Question/);
  assert.match(studentPage, /Learning Path/);
  assert.match(studentPage, /ableFromSignal/);
  assert.match(studentPage, /ableStudentMessage/);
  assert.match(studentPage, /Worked Example/);
  assert.match(studentPage, /showCoachModal/);
  assert.match(studentPage, /showKnowledgeUnits/);
  assert.match(studentPage, /darkMode/);
  assert.match(studentPage, /Comeback Score/);
  assert.match(studentPage, /Mastery Check/);
  assert.match(studentPage, /Guided Learning/);
  assert.match(studentPage, /Revision/);
  assert.doesNotMatch(studentPage, /Teacher View/);
  assert.match(items, /"difficulty": "Easy"/);
  assert.match(items, /"ku": "KU2"[\s\S]*"skill": "subject-number"/);
  assert.match(items, /chatgpt-generated-draft/);
  assert.doesNotMatch(studentPage, /aria-label="Lesson navigation"/);
  assert.match(layout, /Adaptive SVA Studio/);
  assert.match(packageJson, /"name": "adaptive-sva-studio"/);
  assert.match(readme, /Bayesian Knowledge Tracing/);
  assert.match(readme, /subject verb agreement combined\.pdf/);
  assert.doesNotMatch(page, /SkeletonPreview|_sites-preview|codex-preview/);
  assert.doesNotMatch(studentPage, /SkeletonPreview|_sites-preview|codex-preview/);
  assert.doesNotMatch(layout, /Starter Project|codex-preview|_sites-preview/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);

  await assert.rejects(access(new URL("app/_sites-preview", templateRoot)));
});
