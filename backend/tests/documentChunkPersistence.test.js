import test from "node:test";
import assert from "node:assert/strict";

import { persistChunkMetadata } from "../src/services/documentProcessingService.js";

const createFakeDocumentChunkModel = () => {
  const calls = [];

  return {
    calls,
    async bulkWrite(operations, options) {
      calls.push({ operations, options });

      return {
        acknowledged: true,
        upsertedCount: operations.length,
      };
    },
  };
};

const createChunks = () => [
  {
    chunkId: "chunk-001",
    sequence: 0,
    startOffset: 0,
    endOffset: 100,
    text: "This is the first chunk.",
    source: {
      pageStart: 1,
      pageEnd: 2,
    },
  },
  {
    chunkId: "chunk-002",
    sequence: 1,
    startOffset: 80,
    endOffset: 180,
    text: "This is the second chunk.",
    source: {
      pageStart: 2,
      pageEnd: 3,
    },
  },
];

test("persists chunk metadata with matching Qdrant point IDs", async () => {
  const documentChunkModel = createFakeDocumentChunkModel();
  const chunks = createChunks();
  const pointIds = ["qdrant-point-001", "qdrant-point-002"];

  const result = await persistChunkMetadata({
    chunks,
    pointIds,
    materialId: "material-123",
    userId: "user-456",
    documentChunkModel,
  });

  assert.deepEqual(result, {
    persistedCount: 2,
  });

  assert.equal(documentChunkModel.calls.length, 1);

  const [{ operations, options }] = documentChunkModel.calls;

  assert.deepEqual(options, {
    ordered: true,
  });

  assert.equal(operations.length, 2);

  assert.deepEqual(operations[0], {
    updateOne: {
      filter: {
        chunkId: "chunk-001",
      },
      update: {
        $set: {
          chunkId: "chunk-001",
          materialId: "material-123",
          userId: "user-456",
          sequence: 0,
          startOffset: 0,
          endOffset: 100,
          text: "This is the first chunk.",
          source: {
            pageStart: 1,
            pageEnd: 2,
          },
          qdrantPointId: "qdrant-point-001",
        },
      },
      upsert: true,
    },
  });

  assert.equal(
    operations[1].updateOne.update.$set.qdrantPointId,
    "qdrant-point-002",
  );
});

test("returns zero for empty chunks without calling MongoDB", async () => {
  const documentChunkModel = createFakeDocumentChunkModel();

  const result = await persistChunkMetadata({
    chunks: [],
    pointIds: [],
    materialId: "material-123",
    userId: "user-456",
    documentChunkModel,
  });

  assert.deepEqual(result, {
    persistedCount: 0,
  });

  assert.equal(documentChunkModel.calls.length, 0);
});

test("rejects mismatched chunk and Qdrant point ID counts", async () => {
  const documentChunkModel = createFakeDocumentChunkModel();

  await assert.rejects(
    persistChunkMetadata({
      chunks: createChunks(),
      pointIds: ["qdrant-point-001"],
      materialId: "material-123",
      userId: "user-456",
      documentChunkModel,
    }),
    {
      message: "Chunk count does not match the number of Qdrant point IDs.",
    },
  );

  assert.equal(documentChunkModel.calls.length, 0);
});

test("rejects a chunk missing its chunk ID", async () => {
  const documentChunkModel = createFakeDocumentChunkModel();
  const chunks = createChunks();
  delete chunks[0].chunkId;

  await assert.rejects(
    persistChunkMetadata({
      chunks,
      pointIds: ["qdrant-point-001", "qdrant-point-002"],
      materialId: "material-123",
      userId: "user-456",
      documentChunkModel,
    }),
    {
      message: "Chunk at index 0 is missing its chunk ID.",
    },
  );

  assert.equal(documentChunkModel.calls.length, 0);
});

test("rejects a missing Qdrant point ID", async () => {
  const documentChunkModel = createFakeDocumentChunkModel();

  await assert.rejects(
    persistChunkMetadata({
      chunks: createChunks(),
      pointIds: ["qdrant-point-001", null],
      materialId: "material-123",
      userId: "user-456",
      documentChunkModel,
    }),
    {
      message: "Qdrant point ID at index 1 is missing.",
    },
  );

  assert.equal(documentChunkModel.calls.length, 0);
});

test("uses chunkId upserts to support retry-safe persistence", async () => {
  const documentChunkModel = createFakeDocumentChunkModel();
  const input = {
    chunks: createChunks(),
    pointIds: ["qdrant-point-001", "qdrant-point-002"],
    materialId: "material-123",
    userId: "user-456",
    documentChunkModel,
  };

  await persistChunkMetadata(input);
  await persistChunkMetadata(input);

  assert.equal(documentChunkModel.calls.length, 2);

  for (const { operations } of documentChunkModel.calls) {
    for (const operation of operations) {
      assert.equal(operation.updateOne.upsert, true);
      assert.ok(operation.updateOne.filter.chunkId);
    }
  }
});
