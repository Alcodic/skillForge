import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeText,
  normalizeExtractionResult,
} from "../src/services/textNormalizationService.js";

test("normalizes whitespace and line endings", () => {
  const sample = "  Hello   SkillForge!  \r\n\r\n\r\n Next line.  ";

  assert.equal(normalizeText(sample), "Hello SkillForge!\n\nNext line.");
});

test("normalizes page text and rebuilds the aggregate document text", () => {
  const result = normalizeExtractionResult({
    text: "Original document text",
    pageCount: 2,
    pages: [
      { pageNumber: 1, text: "  First   page.  " },
      { pageNumber: 2, text: " Second\r\npage. " },
    ],
  });

  assert.equal(result.text, "First page.\n\nSecond\npage.");
  assert.deepEqual(
    result.pages.map((page) => page.pageNumber),
    [1, 2],
  );
  assert.equal(result.pageCount, 2);
});

test("rejects malformed extraction results", () => {
  assert.throws(() => normalizeExtractionResult(null), TypeError);

  assert.throws(
    () => normalizeExtractionResult({ text: "text", pages: null }),
    TypeError,
  );

  assert.throws(
    () => normalizeExtractionResult({ text: "text", pages: [null] }),
    TypeError,
  );

  assert.throws(
    () =>
      normalizeExtractionResult({
        text: "text",
        pages: [{ pageNumber: 1 }],
      }),
    TypeError,
  );
});

test("rejects an empty pages array", () => {
  assert.throws(
    () =>
      normalizeExtractionResult({
        text: "",
        pageCount: 0,
        pages: [],
      }),
    { message: "Normalized PDF content is empty." },
  );
});

test("rejects content that becomes empty after normalization", () => {
  assert.throws(
    () =>
      normalizeExtractionResult({
        text: "\u0000\u0001\u0007   \n",
        pageCount: 1,
        pages: [
          {
            pageNumber: 1,
            text: "\u0000\u0001\u0007   \n",
          },
        ],
      }),
    { message: "Normalized PDF content is empty." },
  );
});

test("allows blank pages when another page contains usable text", () => {
  const result = normalizeExtractionResult({
    text: "\n\nUseful learning content",
    pageCount: 2,
    pages: [
      { pageNumber: 1, text: " \n " },
      { pageNumber: 2, text: "Useful learning content" },
    ],
  });

  assert.equal(result.pages[0].text, "");
  assert.equal(result.pages[1].text, "Useful learning content");
  assert.equal(result.text, "\n\nUseful learning content");
});
