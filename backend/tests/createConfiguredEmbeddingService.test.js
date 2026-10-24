import test from "node:test";
import assert from "node:assert/strict";

import { createConfiguredEmbeddingService } from "../src/services/createConfiguredEmbeddingService.js";

const createTestEnv = (overrides = {}) => ({
  EMBEDDING_PROVIDER: "voyage",
  EMBEDDING_MODEL: "test-model",
  EMBEDDING_DIMENSIONS: "3",
  VOYAGE_API_KEY: "test-api-key",
  ...overrides,
});

const createMockFetch = () => {
  const calls = [];

  const fetchImpl = async (url, options) => {
    calls.push({ url, options });

    const request = JSON.parse(options.body);

    return {
      ok: true,
      status: 200,
      json: async () => ({
        data: request.input.map((_, index) => ({
          index,
          embedding: [0.1, 0.2, 0.3],
        })),
      }),
    };
  };

  return { fetchImpl, calls };
};

test("creates a configured embedding service", async () => {
  const { fetchImpl, calls } = createMockFetch();

  const embedTexts = createConfiguredEmbeddingService({
    env: createTestEnv(),
    fetchImpl,
  });

  const result = await embedTexts(["What is RAG?"]);

  assert.deepEqual(result, {
    embeddings: [[0.1, 0.2, 0.3]],
    model: {
      provider: "voyage",
      name: "test-model",
      dimensions: 3,
    },
  });

  assert.equal(calls.length, 1);

  const request = JSON.parse(calls[0].options.body);

  assert.equal(request.model, "test-model");
  assert.equal(request.output_dimension, 3);
  assert.equal(request.input_type, "document");
});

test("rejects unsupported embedding providers", () => {
  assert.throws(
    () =>
      createConfiguredEmbeddingService({
        env: createTestEnv({
          EMBEDDING_PROVIDER: "openai",
        }),
        fetchImpl: async () => {
          throw new Error("Fetch should not be called");
        },
      }),
    /Unsupported embedding provider: "openai"/,
  );
});

test("rejects a missing Voyage API key", () => {
  const env = createTestEnv();
  delete env.VOYAGE_API_KEY;

  assert.throws(
    () =>
      createConfiguredEmbeddingService({
        env,
        fetchImpl: async () => {
          throw new Error("Fetch should not be called");
        },
      }),
    /VOYAGE_API_KEY must be configured/,
  );
});

test("uses the injected fetch implementation", async () => {
  const { fetchImpl, calls } = createMockFetch();

  const embedTexts = createConfiguredEmbeddingService({
    env: createTestEnv(),
    fetchImpl,
  });

  await embedTexts(["First text", "Second text"]);

  assert.equal(calls.length, 1);
});
