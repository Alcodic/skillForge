import test from "node:test";
import assert from "node:assert/strict";

import { createQueryEmbeddingService } from "../src/services/queryEmbeddingService.js";

const MODEL = {
  provider: "voyage",
  name: "voyage-4-lite",
  dimensions: 3,
};

test("creates a query embedding and returns model metadata", async () => {
  let receivedTexts;

  const embedTexts = async (texts) => {
    receivedTexts = texts;

    return {
      embeddings: [[0.1, 0.2, 0.3]],
      model: MODEL,
    };
  };

  const createQueryEmbedding = createQueryEmbeddingService({
    embedTexts,
  });

  const result = await createQueryEmbedding("What is RAG?");

  assert.deepEqual(receivedTexts, ["What is RAG?"]);

  assert.deepEqual(result, {
    embedding: [0.1, 0.2, 0.3],
    model: MODEL,
  });
});

test("rejects a non-string question", async () => {
  const createQueryEmbedding = createQueryEmbeddingService({
    embedTexts: async () => {
      throw new Error("Embedding service should not be called");
    },
  });

  await assert.rejects(
    createQueryEmbedding(123),
    /Question must be a non-empty string/,
  );
});

test("rejects an empty or whitespace-only question", async () => {
  const createQueryEmbedding = createQueryEmbeddingService({
    embedTexts: async () => {
      throw new Error("Embedding service should not be called");
    },
  });

  await assert.rejects(
    createQueryEmbedding(""),
    /Question must be a non-empty string/,
  );

  await assert.rejects(
    createQueryEmbedding("   "),
    /Question must be a non-empty string/,
  );
});

test("propagates embedding provider failures", async () => {
  const createQueryEmbedding = createQueryEmbeddingService({
    embedTexts: async () => {
      throw new Error("Voyage API unavailable");
    },
  });

  await assert.rejects(
    createQueryEmbedding("What is RAG?"),
    /Voyage API unavailable/,
  );
});

test("rejects responses without exactly one embedding", async () => {
  const createQueryEmbedding = createQueryEmbeddingService({
    embedTexts: async () => ({
      embeddings: [],
      model: MODEL,
    }),
  });

  await assert.rejects(
    createQueryEmbedding("What is RAG?"),
    /exactly one embedding/,
  );
});

test("rejects missing model metadata", async () => {
  const createQueryEmbedding = createQueryEmbeddingService({
    embedTexts: async () => ({
      embeddings: [[0.1, 0.2, 0.3]],
    }),
  });

  await assert.rejects(
    createQueryEmbedding("What is RAG?"),
    /model metadata is missing/,
  );
});

test("rejects an invalid embedding dependency", () => {
  assert.throws(
    () => createQueryEmbeddingService({ embedTexts: null }),
    /embedTexts must be a function/,
  );
});
