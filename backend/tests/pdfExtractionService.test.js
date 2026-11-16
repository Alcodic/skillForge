import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { extractPdfText } from "../src/services/pdfExtractionService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fixturePath = path.join(__dirname, "fixtures", "skillforge-test.pdf");

test("extracts text and page metadata from a valid PDF", async () => {
  const pdfBuffer = await readFile(fixturePath);
  const result = await extractPdfText(pdfBuffer);

  assert.equal(typeof result.text, "string");
  assert.ok(result.text.trim().length > 0);

  assert.ok(result.pageCount > 0);
  assert.equal(result.pages.length, result.pageCount);

  for (const page of result.pages) {
    assert.equal(typeof page.pageNumber, "number");
    assert.equal(typeof page.text, "string");
  }

  assert.equal(result.text, result.pages.map((page) => page.text).join("\n\n"));
});

test("rejects non-Buffer PDF input", async () => {
  await assert.rejects(extractPdfText("not a buffer"), {
    name: "TypeError",
    message: "PDF input must be a Node.js Buffer.",
  });
});

test("rejects an empty PDF buffer", async () => {
  await assert.rejects(extractPdfText(Buffer.alloc(0)), {
    message: "Cannot extract text from an empty PDF buffer.",
  });
});

test("rejects malformed PDF input", async () => {
  await assert.rejects(
    extractPdfText(Buffer.from("This is not a valid PDF document.")),
  );
});

test("rejects a PDF containing no extractable text", async () => {
  const blankPdfBuffer = await readFile(
    path.join(__dirname, "fixtures", "skillforge-blank-test.pdf"),
  );

  await assert.rejects(extractPdfText(blankPdfBuffer), {
    message: "PDF contains no extractable text.",
  });
});
