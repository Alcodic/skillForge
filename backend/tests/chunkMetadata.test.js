import test from "node:test";
import assert from "node:assert/strict";

import { chunkText } from "../src/services/textChunkingService.js";

test("assigns sequential, zero-based chunk positions", () => {
  const text = "A".repeat(250);
  const chunks = chunkText(text, {
    targetSize: 100,
    overlap: 20,
    materialId: "material-123",
  });

  assert.ok(chunks.length > 1);

  chunks.forEach((chunk, index) => {
    assert.equal(chunk.sequence, index);
  });
});

test("generates the same IDs for repeated processing", () => {
  const text = "A".repeat(250);

  const firstRun = chunkText(text, {
    targetSize: 100,
    overlap: 20,
    materialId: "material-123",
  });

  const secondRun = chunkText(text, {
    targetSize: 100,
    overlap: 20,
    materialId: "material-123",
  });

  assert.deepEqual(
    firstRun.map((chunk) => chunk.chunkId),
    secondRun.map((chunk) => chunk.chunkId),
  );
});

test("generates different IDs for different materials", () => {
  const text = "The same learning content.";

  const firstMaterial = chunkText(text, {
    materialId: "material-A",
  });

  const secondMaterial = chunkText(text, {
    materialId: "material-B",
  });

  assert.notEqual(firstMaterial[0].chunkId, secondMaterial[0].chunkId);
});

test("assigns unique IDs to different chunks", () => {
  const text = "A".repeat(250);
  const chunks = chunkText(text, {
    targetSize: 100,
    overlap: 20,
    materialId: "material-123",
  });

  const ids = chunks.map((chunk) => chunk.chunkId);

  assert.equal(new Set(ids).size, ids.length);
});

test("preserves chunk text and source offsets", () => {
  const text = "A".repeat(250);
  const chunks = chunkText(text, {
    targetSize: 100,
    overlap: 20,
    materialId: "material-123",
  });

  for (const chunk of chunks) {
    assert.equal(chunk.text, text.slice(chunk.startOffset, chunk.endOffset));
  }
});

test("rejects an empty material ID", () => {
  assert.throws(() => chunkText("Some content", { materialId: " " }), {
    name: "TypeError",
    message: "Material ID must be a non-empty string.",
  });
});
