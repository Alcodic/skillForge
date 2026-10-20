import test from "node:test";
import assert from "node:assert/strict";

import { createEmbeddingService } from "../src/services/embeddingService.js";

const createTestService = (overrides = {}) =>
  createEmbeddingService({
    provider: "test-provider",
    model: "test-model",
    dimensions: 3,
    generateEmbeddings: async (texts) => texts.map(() => [0.1, 0.2, 0.3]),
    ...overrides,
  });

test("embeds multiple texts and returns model metadata", async () => {
  const texts = ["What is RAG?", "What are embeddings?"];

  const embedTexts = createTestService();
  const result = await embedTexts(texts);

  assert.equal(result.embeddings.length, texts.length);

  assert.deepEqual(result.model, {
    provider: "test-provider",
    name: "test-model",
    dimensions: 3,
  });
});

test("preserves the order of embeddings returned by the provider", async () => {
  const expectedVectors = [
    [0.1, 0.2, 0.3],
    [0.4, 0.5, 0.6],
  ];

  const embedTexts = createTestService({
    generateEmbeddings: async () => expectedVectors,
  });

  const result = await embedTexts(["First text", "Second text"]);

  assert.deepEqual(result.embeddings, expectedVectors);
});

test("returns an empty result without calling the provider", async () => {
  let providerCalled = false;

  const embedTexts = createTestService({
    generateEmbeddings: async () => {
      providerCalled = true;
      return [];
    },
  });

  const result = await embedTexts([]);

  assert.deepEqual(result.embeddings, []);
  assert.equal(providerCalled, false);
});

test("rejects invalid text batches", async () => {
  const embedTexts = createTestService();

  await assert.rejects(embedTexts(null), TypeError);
  await assert.rejects(embedTexts("single string"), TypeError);
  await assert.rejects(embedTexts(["valid", ""]), TypeError);
  await assert.rejects(embedTexts(["   "]), TypeError);
  await assert.rejects(embedTexts([123]), TypeError);
});

test("rejects invalid model configuration", () => {
  assert.throws(() => createTestService({ provider: "" }), TypeError);

  assert.throws(() => createTestService({ model: "" }), TypeError);

  assert.throws(() => createTestService({ dimensions: 0 }), RangeError);

  assert.throws(() => createTestService({ dimensions: 3.5 }), RangeError);

  assert.throws(
    () => createTestService({ generateEmbeddings: null }),
    TypeError,
  );
});

test("rejects a provider response with the wrong vector count", async () => {
  const embedTexts = createTestService({
    generateEmbeddings: async () => [[0.1, 0.2, 0.3]],
  });

  await assert.rejects(
    embedTexts(["First text", "Second text"]),
    /number of embeddings/i,
  );
});

test("rejects vectors with incorrect dimensions", async () => {
  const embedTexts = createTestService({
    generateEmbeddings: async () => [[0.1, 0.2]],
  });

  await assert.rejects(embedTexts(["Some text"]), /dimensions/i);
});

test("rejects non-finite vector values", async () => {
  const embedTexts = createTestService({
    generateEmbeddings: async () => [[0.1, NaN, 0.3]],
  });

  await assert.rejects(embedTexts(["Some text"]), /finite numbers/i);
});

test("propagates provider failures instead of returning fake vectors", async () => {
  const embedTexts = createTestService({
    generateEmbeddings: async () => {
      throw new Error("Provider unavailable");
    },
  });

  await assert.rejects(embedTexts(["Some text"]), /Provider unavailable/);
});
