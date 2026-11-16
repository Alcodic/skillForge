import test from "node:test";
import assert from "node:assert/strict";

import { processMaterialDocument } from "../src/services/documentProcessingService.js";

const createDependencies = (overrides = {}) => {
  const calls = [];
  const failureRecords = [];

  const logs = [];

  const logger = {
    info: (event) => logs.push(event),
    error: (event) => logs.push(event),
  };

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

    recordProcessingFailureFn: async (failureDetails) => {
      calls.push("recordProcessingFailure");

      failureRecords.push(failureDetails);

      return {
        matchedCount: 1,
      };
    },

    cleanupStaleChunkDataFn: async ({
      chunks: cleanupChunks,
      materialId,
      userId,
      qdrantService,
    }) => {
      calls.push("cleanupStaleChunkData");

      assert.equal(cleanupChunks.length, 2);
      assert.equal(materialId, "material-123");
      assert.equal(userId, "user-456");

      assert.equal(typeof qdrantService.persistChunks, "function");

      return {
        deletedVectorCount: 1,
        deletedMetadataCount: 1,
      };
    },
  };

  return {
    calls,
    chunks,
    failureRecords,
    logs,
    dependencies: {
      logger,
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
  const { calls, dependencies, failureRecords } = createDependencies();

  const result = await runPipeline(dependencies);

  assert.deepEqual(calls, [
    "prepareMaterial",
    "extractPdfText",
    "normalizeExtractionResult",
    "chunkText",
    "embedTexts",
    "qdrant.persistChunks",
    "persistChunkMetadata",
    "cleanupStaleChunkData",
    "updateMaterialStatus",
  ]);

  assert.deepEqual(result, {
    materialId: "material-123",
    processingStatus: "READY",
    chunkCount: 2,
    vectorCount: 2,
    metadataCount: 2,
    deletedVectorCount: 1,
    deletedMetadataCount: 1,
  });

  // Successful processing must not record a failure.
  assert.deepEqual(failureRecords, []);
});

test("records STALE_DATA_CLEANUP failure and never marks the material as READY", async () => {
  const cleanupError = new Error("Stale chunk cleanup failed");

  const { calls, dependencies, failureRecords } = createDependencies({
    cleanupStaleChunkDataFn: async () => {
      calls.push("cleanupStaleChunkData");
      throw cleanupError;
    },
  });

  await assert.rejects(runPipeline(dependencies), cleanupError);

  assert.equal(calls.includes("persistChunkMetadata"), true);
  assert.equal(calls.includes("cleanupStaleChunkData"), true);
  assert.equal(calls.includes("updateMaterialStatus"), false);

  assert.deepEqual(failureRecords, [
    {
      materialId: "material-123",
      userId: "user-456",
      stage: "STALE_DATA_CLEANUP",
    },
  ]);
});

test("rejects zero chunks and never marks the material as READY", async () => {
  const { calls, dependencies, failureRecords } = createDependencies({
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
    "recordProcessingFailure",
  ]);

  assert.deepEqual(failureRecords, [
    {
      materialId: "material-123",
      userId: "user-456",
      stage: "CHUNKING",
    },
  ]);

  assert.equal(calls.includes("updateMaterialStatus"), false);
});

test("records EMBEDDING_GENERATION failure for an embedding count mismatch", async () => {
  const { calls, dependencies, failureRecords } = createDependencies({
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
  assert.equal(calls.includes("updateMaterialStatus"), false);

  assert.deepEqual(failureRecords, [
    {
      materialId: "material-123",
      userId: "user-456",
      stage: "EMBEDDING_GENERATION",
    },
  ]);

  assert.equal(calls.at(-1), "recordProcessingFailure");
});

test("records VECTOR_PERSISTENCE failure for a Qdrant point ID count mismatch", async () => {
  const { calls, dependencies, failureRecords } = createDependencies({
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
  assert.equal(calls.includes("updateMaterialStatus"), false);

  assert.deepEqual(failureRecords, [
    {
      materialId: "material-123",
      userId: "user-456",
      stage: "VECTOR_PERSISTENCE",
    },
  ]);

  assert.equal(calls.at(-1), "recordProcessingFailure");
});

test("records VECTOR_PERSISTENCE failure for a Qdrant persisted count mismatch", async () => {
  const { calls, dependencies, failureRecords } = createDependencies({
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

  assert.deepEqual(failureRecords, [
    {
      materialId: "material-123",
      userId: "user-456",
      stage: "VECTOR_PERSISTENCE",
    },
  ]);

  assert.equal(calls.at(-1), "recordProcessingFailure");
});

test("records TEXT_EXTRACTION failure and propagates the original error", async () => {
  const extractionError = new Error("PDF extraction failed");

  const { calls, dependencies, failureRecords } = createDependencies({
    extractPdfTextFn: async () => {
      calls.push("extractPdfText");
      throw extractionError;
    },
  });

  await assert.rejects(runPipeline(dependencies), extractionError);

  assert.deepEqual(calls, [
    "prepareMaterial",
    "extractPdfText",
    "recordProcessingFailure",
  ]);

  assert.deepEqual(failureRecords, [
    {
      materialId: "material-123",
      userId: "user-456",
      stage: "TEXT_EXTRACTION",
    },
  ]);

  assert.equal(calls.includes("updateMaterialStatus"), false);
});

test("records METADATA_PERSISTENCE failure for a metadata count mismatch", async () => {
  const { calls, dependencies, failureRecords } = createDependencies({
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

  assert.deepEqual(failureRecords, [
    {
      materialId: "material-123",
      userId: "user-456",
      stage: "METADATA_PERSISTENCE",
    },
  ]);

  assert.equal(calls.at(-1), "recordProcessingFailure");
});

test("records READY_TRANSITION failure when the material cannot transition from PROCESSING to READY", async () => {
  const { calls, dependencies, failureRecords } = createDependencies({
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

  assert.deepEqual(failureRecords, [
    {
      materialId: "material-123",
      userId: "user-456",
      stage: "READY_TRANSITION",
    },
  ]);

  assert.equal(calls.at(-1), "recordProcessingFailure");
});

test("records EMBEDDING_GENERATION failure when the embedding provider throws", async () => {
  const embeddingError = new Error("Embedding provider failed");

  const { calls, dependencies, failureRecords } = createDependencies({
    embedTexts: async () => {
      calls.push("embedTexts");
      throw embeddingError;
    },
  });

  await assert.rejects(runPipeline(dependencies), embeddingError);

  assert.equal(calls.includes("qdrant.persistChunks"), false);
  assert.equal(calls.includes("persistChunkMetadata"), false);
  assert.equal(calls.includes("updateMaterialStatus"), false);

  assert.deepEqual(failureRecords, [
    {
      materialId: "material-123",
      userId: "user-456",
      stage: "EMBEDDING_GENERATION",
    },
  ]);

  assert.equal(calls.at(-1), "recordProcessingFailure");
});

test("records VECTOR_PERSISTENCE failure when Qdrant persistence throws", async () => {
  const qdrantError = new Error("Qdrant upsert failed");

  const { calls, dependencies, failureRecords } = createDependencies({
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

  assert.deepEqual(failureRecords, [
    {
      materialId: "material-123",
      userId: "user-456",
      stage: "VECTOR_PERSISTENCE",
    },
  ]);

  assert.equal(calls.at(-1), "recordProcessingFailure");
});

test("preserves the original processing error when failure recording also fails", async () => {
  const extractionError = new Error("PDF extraction failed");
  const recordingError = new Error("MongoDB failure recorder failed");

  const { calls, dependencies, logs } = createDependencies({
    extractPdfTextFn: async () => {
      calls.push("extractPdfText");
      throw extractionError;
    },

    recordProcessingFailureFn: async () => {
      calls.push("recordProcessingFailure");
      throw recordingError;
    },
  });

  await assert.rejects(runPipeline(dependencies), extractionError);

  assert.equal(calls.at(-1), "recordProcessingFailure");

  const failureRecordingLog = logs.find(
    (log) => log.event === "FAILURE_RECORDING_FAILED",
  );

  assert.ok(failureRecordingLog);
  assert.equal(failureRecordingLog.stage, "TEXT_EXTRACTION");
  assert.equal(failureRecordingLog.errorName, "Error");
});

test("does not record processing failure for precondition errors", async () => {
  const preconditionError = new Error(
    "Material is not eligible for processing",
  );

  preconditionError.isPreconditionError = true;

  const { calls, dependencies, failureRecords } = createDependencies({
    prepareMaterial: async () => {
      calls.push("prepareMaterial");
      throw preconditionError;
    },
  });

  await assert.rejects(runPipeline(dependencies), preconditionError);

  assert.deepEqual(failureRecords, []);
  assert.equal(calls.includes("recordProcessingFailure"), false);
});

test("emits processing and stage lifecycle logs on successful processing", async () => {
  const { dependencies, logs } = createDependencies();

  await runPipeline(dependencies);

  assert.equal(logs[0].event, "PROCESSING_STARTED");

  const stageStarted = logs.filter((log) => log.event === "STAGE_STARTED");

  const stageCompleted = logs.filter((log) => log.event === "STAGE_COMPLETED");

  assert.equal(stageStarted.length, 9);
  assert.equal(stageCompleted.length, 9);

  assert.equal(logs.at(-1).event, "PROCESSING_COMPLETED");

  assert.equal(logs.at(-1).processingStatus, "READY");

  assert.ok(logs.every((log) => log.materialId === "material-123"));

  assert.ok(
    logs.every(
      (log) =>
        typeof log.timestamp === "string" &&
        !Number.isNaN(Date.parse(log.timestamp)),
    ),
  );
});

test("records the failed stage without exposing the original error message", async () => {
  const sensitiveError = new Error("Provider failed with secret-api-key");

  const { dependencies, logs } = createDependencies({
    extractPdfTextFn: async () => {
      throw sensitiveError;
    },
  });

  await assert.rejects(runPipeline(dependencies), sensitiveError);

  const failureLog = logs.find((log) => log.event === "STAGE_FAILED");

  assert.equal(failureLog.stage, "TEXT_EXTRACTION");
  assert.equal(failureLog.errorName, "Error");

  assert.equal(JSON.stringify(logs).includes("secret-api-key"), false);
});

test("does not emit a processing failure event for precondition errors", async () => {
  const preconditionError = new Error("Not eligible");

  preconditionError.isPreconditionError = true;

  const { dependencies, logs } = createDependencies({
    prepareMaterial: async () => {
      throw preconditionError;
    },
  });

  await assert.rejects(runPipeline(dependencies), preconditionError);

  assert.equal(
    logs.some((log) => log.event === "STAGE_FAILED"),
    false,
  );
});

test("logging failures do not interrupt successful processing", async () => {
  const logger = {
    info: () => {
      throw new Error("Logging system unavailable");
    },
    error: () => {
      throw new Error("Logging system unavailable");
    },
  };

  const { dependencies } = createDependencies({
    logger,
  });

  const result = await runPipeline(dependencies);

  assert.equal(result.processingStatus, "READY");
});

test("records a non-negative numeric duration for every completed stage", async () => {
  const { dependencies, logs } = createDependencies();

  await runPipeline(dependencies);

  const completedStages = logs.filter((log) => log.event === "STAGE_COMPLETED");

  assert.equal(completedStages.length, 9);

  for (const log of completedStages) {
    assert.equal(typeof log.durationMs, "number");
    assert.ok(Number.isFinite(log.durationMs));
    assert.ok(log.durationMs >= 0);
  }
});
