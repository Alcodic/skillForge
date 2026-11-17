import test from "node:test";
import assert from "node:assert/strict";

import {
  persistChunkMetadata,
  cleanupStaleChunkData,
} from "../src/services/documentProcessingService.js";

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

const createFakeCleanupModel = (staleChunks = [], events = []) => {
  const calls = [];

  return {
    calls,

    find(filter) {
      calls.push({ method: "find", filter });
      events.push("mongo.find");

      return {
        select(fields) {
          calls.push({ method: "select", fields });

          return {
            async lean() {
              calls.push({ method: "lean" });
              return staleChunks;
            },
          };
        },
      };
    },

    async deleteMany(filter) {
      calls.push({ method: "deleteMany", filter });
      events.push("mongo.deleteMany");

      return {
        acknowledged: true,
        deletedCount: staleChunks.length,
      };
    },
  };
};

const createFakeQdrantService = (overrides = {}, events = []) => {
  const calls = [];

  return {
    calls,

    async deletePoints(pointIds) {
      calls.push([...pointIds]);
      events.push("qdrant.deletePoints");

      return {
        deletedCount: new Set(pointIds).size,
      };
    },

    ...overrides,
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
        materialId: "material-123",
        userId: "user-456",
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

test("propagates MongoDB bulkWrite failures", async () => {
  const persistenceError = new Error("MongoDB bulkWrite failed");

  const documentChunkModel = {
    bulkWrite: async () => {
      throw persistenceError;
    },
  };

  await assert.rejects(
    persistChunkMetadata({
      chunks: createChunks(),
      pointIds: ["qdrant-point-001", "qdrant-point-002"],
      materialId: "material-123",
      userId: "user-456",
      documentChunkModel,
    }),
    (error) => error === persistenceError,
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

test("finds stale chunks using material and user ownership and deletes vectors before metadata", async () => {
  const staleChunks = [
    { qdrantPointId: "stale-point-001" },
    { qdrantPointId: "stale-point-002" },
  ];

  const events = [];

  const documentChunkModel = createFakeCleanupModel(staleChunks, events);
  const qdrantService = createFakeQdrantService({}, events);

  const result = await cleanupStaleChunkData({
    chunks: createChunks(),
    materialId: "material-123",
    userId: "user-456",
    documentChunkModel,
    qdrantService,
  });

  const expectedFilter = {
    materialId: "material-123",
    userId: "user-456",
    chunkId: {
      $nin: ["chunk-001", "chunk-002"],
    },
  };

  assert.deepEqual(result, {
    deletedVectorCount: 2,
    deletedMetadataCount: 2,
  });

  assert.deepEqual(documentChunkModel.calls[0], {
    method: "find",
    filter: expectedFilter,
  });

  assert.deepEqual(qdrantService.calls, [
    ["stale-point-001", "stale-point-002"],
  ]);

  const methodNames = documentChunkModel.calls.map((call) => call.method);

  assert.ok(methodNames.indexOf("find") < methodNames.indexOf("deleteMany"));
  assert.ok(methodNames.includes("deleteMany"));

  assert.deepEqual(
    documentChunkModel.calls.find((call) => call.method === "deleteMany")
      .filter,
    expectedFilter,
  );
});

test("does not call Qdrant or delete metadata when no stale chunks exist", async () => {
  const documentChunkModel = createFakeCleanupModel([]);
  const qdrantService = createFakeQdrantService();

  const result = await cleanupStaleChunkData({
    chunks: createChunks(),
    materialId: "material-123",
    userId: "user-456",
    documentChunkModel,
    qdrantService,
  });

  assert.deepEqual(result, {
    deletedVectorCount: 0,
    deletedMetadataCount: 0,
  });

  assert.deepEqual(qdrantService.calls, []);

  assert.equal(
    documentChunkModel.calls.some((call) => call.method === "deleteMany"),
    false,
  );
});

test("does not delete MongoDB metadata when Qdrant vector deletion fails", async () => {
  const documentChunkModel = createFakeCleanupModel([
    { qdrantPointId: "stale-point-001" },
  ]);

  const qdrantError = new Error("Qdrant deletion failed");

  const qdrantService = createFakeQdrantService({
    async deletePoints() {
      throw qdrantError;
    },
  });

  await assert.rejects(
    cleanupStaleChunkData({
      chunks: createChunks(),
      materialId: "material-123",
      userId: "user-456",
      documentChunkModel,
      qdrantService,
    }),
    qdrantError,
  );

  assert.equal(
    documentChunkModel.calls.some((call) => call.method === "deleteMany"),
    false,
  );
});

test("rejects stale chunks with invalid Qdrant point IDs without deleting metadata", async () => {
  const documentChunkModel = createFakeCleanupModel([
    { qdrantPointId: "stale-point-001" },
    { qdrantPointId: null },
  ]);

  const qdrantService = createFakeQdrantService();

  await assert.rejects(
    cleanupStaleChunkData({
      chunks: createChunks(),
      materialId: "material-123",
      userId: "user-456",
      documentChunkModel,
      qdrantService,
    }),
    {
      message: "Stale chunk contains an invalid Qdrant point ID.",
    },
  );

  assert.deepEqual(qdrantService.calls, []);

  assert.equal(
    documentChunkModel.calls.some((call) => call.method === "deleteMany"),
    false,
  );
});

test("rejects cleanup when Qdrant point deletion is unavailable", async () => {
  const documentChunkModel = createFakeCleanupModel([
    { qdrantPointId: "stale-point-001" },
  ]);

  await assert.rejects(
    cleanupStaleChunkData({
      chunks: createChunks(),
      materialId: "material-123",
      userId: "user-456",
      documentChunkModel,
      qdrantService: {},
    }),
    {
      message: "Qdrant point deletion service is unavailable.",
    },
  );

  assert.equal(
    documentChunkModel.calls.some((call) => call.method === "deleteMany"),
    false,
  );
});

test("keeps chunk metadata scoped to the correct user and material", async () => {
  const documentChunkModel = createFakeDocumentChunkModel();

  const chunks = createChunks();

  await persistChunkMetadata({
    chunks,
    pointIds: ["user-a-point-001", "user-a-point-002"],
    materialId: "material-a",
    userId: "user-a",
    documentChunkModel,
  });

  await persistChunkMetadata({
    chunks,
    pointIds: ["user-b-point-001", "user-b-point-002"],
    materialId: "material-b",
    userId: "user-b",
    documentChunkModel,
  });

  assert.equal(documentChunkModel.calls.length, 2);

  const [userAWrite, userBWrite] = documentChunkModel.calls;

  for (const operation of userAWrite.operations) {
    assert.deepEqual(operation.updateOne.filter, {
      chunkId: operation.updateOne.update.$set.chunkId,
      materialId: "material-a",
      userId: "user-a",
    });

    assert.equal(operation.updateOne.update.$set.materialId, "material-a");

    assert.equal(operation.updateOne.update.$set.userId, "user-a");
  }

  for (const operation of userBWrite.operations) {
    assert.deepEqual(operation.updateOne.filter, {
      chunkId: operation.updateOne.update.$set.chunkId,
      materialId: "material-b",
      userId: "user-b",
    });

    assert.equal(operation.updateOne.update.$set.materialId, "material-b");

    assert.equal(operation.updateOne.update.$set.userId, "user-b");
  }

  assert.notDeepEqual(
    userAWrite.operations[0].updateOne.filter,
    userBWrite.operations[0].updateOne.filter,
  );
});
