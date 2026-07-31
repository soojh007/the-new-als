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
  assert.match(html, /<title>Adaptive Grammar Studio<\/title>/i);
  assert.match(html, /Learning goal/);
  assert.match(html, /Prototype mode\. Verb mastery is local to this session\./);
  assert.match(html, /Student answer/);
  assert.match(html, /BKT parameters/);
  assert.match(html, /Preview BKT calculation/);
  assert.match(html, /No answer has been submitted/);
  assert.match(html, /Before answer/);
  assert.match(html, /chance learner knows this verb skill/);
  assert.match(html, /evidence-adjusted mastery/);
  assert.match(html, /mastery for next question/);
  assert.match(html, /Knows and correct/);
  assert.match(html, /Guessed and correct/);
  assert.match(html, /Verbs curriculum map/);
  assert.match(html, /Reusable grammar item/);
  assert.match(html, /Yesterday, Ali/);
  assert.doesNotMatch(html, /Your site is taking shape|react-loading-skeleton|codex-preview/i);
});

test("removes disposable starter preview files and metadata", async () => {
  const [page, layout, packageJson, readme] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../README.md", import.meta.url), "utf8"),
  ]);

  assert.match(page, /calculateBkt/);
  assert.match(page, /Wrong despite knowing it/);
  assert.match(page, /Adaptive next/);
  assert.match(page, /Verb tense basics/);
  assert.match(layout, /Adaptive Grammar Studio/);
  assert.match(packageJson, /"name": "adaptive-grammar-studio"/);
  assert.match(readme, /Bayesian Knowledge Tracing/);
  assert.doesNotMatch(page, /SkeletonPreview|_sites-preview|codex-preview/);
  assert.doesNotMatch(layout, /Starter Project|codex-preview|_sites-preview/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);

  await assert.rejects(access(new URL("app/_sites-preview", templateRoot)));
});
