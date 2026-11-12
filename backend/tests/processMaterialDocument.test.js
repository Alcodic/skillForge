import test from "node:test";
import assert from "node:assert/strict";

import { processMaterialDocument } from "../src/services/documentProcessingService.js";

const createDependencies = (overrides = {}) => {
  const calls = [];

  const chunks = [
    {
      chunkId: "chunk-001",
      sequence: 0,
      startOffset: 0,
      endOffset: 20,
      text: "First chunk text.",
      source: {
        pageStart: 1,
        pageEnd: 1,
      },
    },
    {
      chunkId: "chunk-002",
      sequence: 1,
      startOffset: 15,
      endOffset: 35,
      text: "Second chunk text.",
      source: {
        pageStart: 1,
        pageEnd: 2,
      },
    },
  ];

  const dependencies = {
    prepareMaterial: async ({ materialId, userId }) => {
      calls.push("prepareMaterial");

      return {
        materialId,
        userId,
        fileBuffer: Buffer.from("fake PDF"),
      };
    },

    extractPdfTextFn: async (fileBuffer) => {
      calls.push("extractPdfText");

      assert.ok(Buffer.isBuffer(fileBuffer));

      return {
        text: "Raw extracted text",
        pageCount: 2,
        pages: [
          { pageNumber: 1, text: "Page one" },
          { pageNumber: 2, text: "Page two" },
        ],
      };
    },

    normalizeExtractionResultFn: (extraction) => {
      calls.push("normalizeExtractionResult");

      assert.equal(extraction.text, "Raw extracted text");

      return {
        text: "Normalized text",
        pageCount: 2,
        pages: [
          { pageNumber: 1, text: "Page one" },
          { pageNumber: 2, text: "Page two" },
        ],
      };
    },

    chunkTextFn: (text, options) => {
      calls.push("chunkText");

      assert.equal(text, "Normalized text");
      assert.equal(options.materialId, "material-123");
      assert.equal(options.userId, "user-456");
      assert.equal(options.pages.length, 2);

      return chunks;
    },

    embedTexts: async (texts) => {
      calls.push("embedTexts");

      assert.deepEqual(
        texts,
        chunks.map((chunk) => chunk.text),
      );

      return {
        model: "test-embedding-model",
        embeddings: [
          [0.1, 0.2, 0.3],
          [0.4, 0.5, 0.6],
        ],
      };
    },

    qdrantService: {
      persistChunks: async (embeddedChunks) => {
        calls.push("qdrant.persistChunks");

        assert.equal(embeddedChunks.length, 2);
        assert.deepEqual(embeddedChunks[0].embedding, [0.1, 0.2, 0.3]);
        assert.deepEqual(embeddedChunks[1].embedding, [0.4, 0.5, 0.6]);

        return {
          persistedCount: 2,
          pointIds: ["point-001", "point-002"],
        };
      },
    },

    persistChunkMetadataFn: async ({
      chunks: metadataChunks,
      pointIds,
      materialId,
      userId,
    }) => {
      calls.push("persistChunkMetadata");

      assert.equal(metadataChunks.length, 2);
      assert.deepEqual(pointIds, ["point-001", "point-002"]);
      assert.equal(materialId, "material-123");
      assert.equal(userId, "user-456");

      return {
        persistedCount: 2,
      };
    },

    updateMaterialStatusFn: async ({ materialId, userId }) => {
      calls.push("updateMaterialStatus");

      assert.equal(materialId, "material-123");
      assert.equal(userId, "user-456");

      return {
        matchedCount: 1,
      };
    },
  };

  return {
    calls,
    chunks,
    dependencies: {
      ...dependencies,
      ...overrides,
    },
  };
};

const runPipeline = (dependencies) =>
  processMaterialDocument({
    materialId: "material-123",
    userId: "user-456",
    ...dependencies,
  });

test("orchestrates processing through embedding, Qdrant, and MongoDB metadata persistence", async () => {
  const { calls, dependencies } = createDependencies();

  const result = await runPipeline(dependencies);

  assert.deepEqual(calls, [
    "prepareMaterial",
    "extractPdfText",
    "normalizeExtractionResult",
    "chunkText",
    "embedTexts",
    "qdrant.persistChunks",
    "persistChunkMetadata",
    "updateMaterialStatus",
  ]);

  assert.deepEqual(result, {
    materialId: "material-123",
    processingStatus: "READY",
    chunkCount: 2,
    vectorCount: 2,
    metadataCount: 2,
  });
});

test("rejects zero chunks and never marks the material as READY", async () => {
  const { calls, dependencies } = createDependencies({
    chunkTextFn: () => {
      calls.push("chunkText");
      return [];
    },
  });

  await assert.rejects(runPipeline(dependencies), (error) => {
    assert.equal(error.statusCode, 422);
    assert.equal(
      error.message,
      "Document processing produced no usable chunks.",
    );
    return true;
  });

  assert.deepEqual(calls, [
    "prepareMaterial",
    "extractPdfText",
    "normalizeExtractionResult",
    "chunkText",
  ]);

  assert.equal(calls.includes("updateMaterialStatus"), false);
});

test("rejects an embedding count mismatch before calling Qdrant", async () => {
  const { calls, dependencies } = createDependencies({
    embedTexts: async () => {
      calls.push("embedTexts");

      return {
        embeddings: [[0.1, 0.2, 0.3]],
      };
    },
  });

  await assert.rejects(runPipeline(dependencies), {
    message: "Embedding count must match the number of document chunks.",
  });

  assert.equal(calls.includes("qdrant.persistChunks"), false);
  assert.equal(calls.includes("persistChunkMetadata"), false);
});

test("rejects a Qdrant point ID count mismatch before MongoDB persistence", async () => {
  const { calls, dependencies } = createDependencies({
    qdrantService: {
      persistChunks: async () => {
        calls.push("qdrant.persistChunks");

        return {
          persistedCount: 2,
          pointIds: ["point-001"],
        };
      },
    },
  });

  await assert.rejects(runPipeline(dependencies), {
    message: "Qdrant point ID count must match the number of document chunks.",
  });

  assert.equal(calls.includes("persistChunkMetadata"), false);
});

test("rejects a Qdrant persisted count mismatch before MongoDB metadata persistence", async () => {
  const { calls, dependencies } = createDependencies({
    qdrantService: {
      persistChunks: async () => {
        calls.push("qdrant.persistChunks");

        return {
          persistedCount: 1,
          pointIds: ["point-001", "point-002"],
        };
      },
    },
  });

  await assert.rejects(runPipeline(dependencies), {
    message: "Qdrant persisted count must match the number of document chunks.",
  });

  assert.equal(calls.includes("persistChunkMetadata"), false);
  assert.equal(calls.includes("updateMaterialStatus"), false);
});

test("propagates extraction failures and stops the pipeline", async () => {
  const extractionError = new Error("PDF extraction failed");

  const { calls, dependencies } = createDependencies({
    extractPdfTextFn: async () => {
      calls.push("extractPdfText");
      throw extractionError;
    },
  });

  await assert.rejects(runPipeline(dependencies), extractionError);

  assert.deepEqual(calls, ["prepareMaterial", "extractPdfText"]);
  assert.equal(calls.includes("updateMaterialStatus"), false);
});

test("rejects a metadata persisted count mismatch before marking READY", async () => {
  const { calls, dependencies } = createDependencies({
    persistChunkMetadataFn: async () => {
      calls.push("persistChunkMetadata");

      return {
        persistedCount: 1,
      };
    },
  });

  await assert.rejects(runPipeline(dependencies), {
    message:
      "Persisted metadata count must match the number of document chunks.",
  });

  assert.equal(calls.includes("updateMaterialStatus"), false);
});

test("rejects when the material cannot transition from PROCESSING to READY", async () => {
  const { calls, dependencies } = createDependencies({
    updateMaterialStatusFn: async () => {
      calls.push("updateMaterialStatus");

      return {
        matchedCount: 0,
      };
    },
  });

  await assert.rejects(runPipeline(dependencies), (error) => {
    assert.equal(error.statusCode, 409);
    assert.equal(
      error.message,
      "Material could not be marked as READY because it is no longer in PROCESSING state.",
    );
    return true;
  });

  assert.equal(calls.includes("persistChunkMetadata"), true);
  assert.equal(calls.includes("updateMaterialStatus"), true);
});

test("propagates embedding failures without marking READY", async () => {
  const embeddingError = new Error("Embedding provider failed");

  const { calls, dependencies } = createDependencies({
    embedTexts: async () => {
      calls.push("embedTexts");
      throw embeddingError;
    },
  });

  await assert.rejects(runPipeline(dependencies), embeddingError);

  assert.equal(calls.includes("qdrant.persistChunks"), false);
  assert.equal(calls.includes("persistChunkMetadata"), false);
  assert.equal(calls.includes("updateMaterialStatus"), false);
});

test("propagates Qdrant persistence failures without marking READY", async () => {
  const qdrantError = new Error("Qdrant upsert failed");

  const { calls, dependencies } = createDependencies({
    qdrantService: {
      persistChunks: async () => {
        calls.push("qdrant.persistChunks");
        throw qdrantError;
      },
    },
  });

  await assert.rejects(runPipeline(dependencies), qdrantError);

  assert.equal(calls.includes("persistChunkMetadata"), false);
  assert.equal(calls.includes("updateMaterialStatus"), false);
});
