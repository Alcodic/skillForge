import test from "node:test";
import assert from "node:assert/strict";

import { chunkText } from "../src/services/textChunkingService.js";

test("returns an empty array for empty input", () => {
  assert.deepEqual(chunkText(""), []);
});

test("returns one chunk when text fits within the target size", () => {
  const text = "SkillForge is being built from scratch.";
  const chunks = chunkText(text);

  assert.equal(chunks.length, 1);

  assert.equal(chunks[0].sequence, 0);
  assert.equal(typeof chunks[0].chunkId, "string");
  assert.ok(chunks[0].chunkId.length > 0);

  assert.deepEqual(
    {
      text: chunks[0].text,
      startOffset: chunks[0].startOffset,
      endOffset: chunks[0].endOffset,
    },
    {
      text,
      startOffset: 0,
      endOffset: text.length,
    },
  );
});

test("rejects invalid text input", () => {
  assert.throws(() => chunkText(null), TypeError);
  assert.throws(() => chunkText(123), TypeError);
});

test("rejects invalid chunking options", () => {
  assert.throws(() => chunkText("hello", { targetSize: 0 }), RangeError);
  assert.throws(
    () => chunkText("hello", { targetSize: 2, overlap: 1 }),
    RangeError,
  );
  assert.throws(
    () => chunkText("hello", { targetSize: 100, overlap: -1 }),
    RangeError,
  );
});

test("keeps chunks within the target size and preserves exact offsets", () => {
  const text = "SkillForge engineering practice. ".repeat(200);
  const targetSize = 500;

  const chunks = chunkText(text, {
    targetSize,
    overlap: 50,
  });

  assert.ok(chunks.length > 1);

  for (const chunk of chunks) {
    assert.ok(chunk.text.length <= targetSize);
    assert.equal(chunk.text, text.slice(chunk.startOffset, chunk.endOffset));
    assert.ok(chunk.startOffset < chunk.endOffset);
  }
});

test("creates the configured overlap between adjacent chunks", () => {
  const text = "A".repeat(1200);
  const overlap = 100;

  const chunks = chunkText(text, {
    targetSize: 400,
    overlap,
  });

  assert.ok(chunks.length > 1);

  for (let i = 1; i < chunks.length; i++) {
    assert.equal(chunks[i].startOffset, chunks[i - 1].endOffset - overlap);

    assert.equal(
      chunks[i - 1].text.slice(-overlap),
      chunks[i].text.slice(0, overlap),
    );
  }
});

test("prefers paragraph boundaries over sentence boundaries", () => {
  const firstParagraph = "A".repeat(60) + ".";
  const secondParagraph = "B".repeat(60) + ".";
  const thirdParagraph = "C".repeat(60) + ".";

  const text = [firstParagraph, secondParagraph, thirdParagraph].join("\n\n");

  const chunks = chunkText(text, {
    targetSize: 100,
    overlap: 10,
  });

  assert.ok(chunks.length > 1);

  // The first chunk should end after a paragraph separator,
  // rather than at the first sentence-ending period.
  assert.ok(chunks[0].text.endsWith("\n\n"));
});

test("hard-splits long text when no suitable boundary exists", () => {
  const text = "A".repeat(1000);

  const chunks = chunkText(text, {
    targetSize: 200,
    overlap: 20,
  });

  assert.equal(chunks[0].text.length, 200);
  assert.equal(chunks[1].startOffset, 180);
});

test("produces identical results for identical input and options", () => {
  const text = (
    "Paragraph one has meaningful content.\n\n" +
    "Paragraph two contains more learning material.\n\n"
  ).repeat(30);

  const options = {
    targetSize: 150,
    overlap: 30,
  };

  assert.deepEqual(chunkText(text, options), chunkText(text, options));
});
