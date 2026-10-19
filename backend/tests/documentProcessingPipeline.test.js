import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { extractPdfText } from "../src/services/pdfExtractionService.js";
import { normalizeExtractionResult } from "../src/services/textNormalizationService.js";
import { chunkText } from "../src/services/textChunkingService.js";

test("processes a real PDF through extraction, normalization, and chunking", async () => {
  // Arrange: read the PDF fixture used by our existing extraction test.
  const pdfBuffer = await readFile(
    new URL("./fixtures/skillforge-test.pdf", import.meta.url),
  );

  // Act: run the three services in sequence.
  const extracted = await extractPdfText(pdfBuffer);
  const normalized = normalizeExtractionResult(extracted);
  const chunks = chunkText(normalized.text, {
    materialId: "skillforge-test-material",
    userId: "skillforge-test-user",
  });

  // Assert: extraction and normalization produced usable text.
  assert.ok(normalized.text.length > 0);
  assert.ok(normalized.pageCount > 0);
  assert.ok(normalized.pages.length > 0);

  // Assert: the chunker covered the entire normalized document.
  assert.ok(chunks.length > 0);
  assert.equal(chunks[0].startOffset, 0);
  assert.equal(chunks.at(-1).endOffset, normalized.text.length);

  // Assert: every chunk matches its recorded source offsets.
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];

    assert.ok(chunk.text.length > 0);
    assert.ok(chunk.text.length <= 2000);

    assert.equal(chunk.sequence, i);

    assert.equal(typeof chunk.chunkId, "string");
    assert.ok(chunk.chunkId.length > 0);

    assert.equal(
      chunk.text,
      normalized.text.slice(chunk.startOffset, chunk.endOffset),
      `Chunk ${i} does not match its source offsets`,
    );

    // Verify overlap between adjacent chunks.
    if (i > 0) {
      assert.equal(
        chunk.startOffset,
        chunks[i - 1].endOffset - 300,
        `Chunk ${i} has an incorrect overlap`,
      );
    }
  }

  console.log({
    pages: normalized.pageCount,
    extractedCharacters: extracted.text.length,
    normalizedCharacters: normalized.text.length,
    chunks: chunks.length,
  });
});
