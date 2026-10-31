import test from "node:test";
import assert from "node:assert/strict";

import { createQdrantService } from "../src/services/qdrantService.js";

const config = {
  url: "http://localhost:6333",
  apiKey: undefined,
  collectionName: "skillforge_chunks_v1",
  vectorSize: 1024,
  distance: "Cosine",
};

const createFakeClient = ({
  initiallyExists = false,
  vectorSize = 1024,
  distance = "Cosine",
  payloadSchema = {},
} = {}) => {
  let exists = initiallyExists;

  const schema = { ...payloadSchema };
  const calls = {
    createCollection: [],
    createPayloadIndex: [],
    upsert: [],
  };

  return {
    calls,

    async getCollections() {
      return {
        collections: exists ? [{ name: config.collectionName }] : [],
      };
    },

    async createCollection(name, options) {
      calls.createCollection.push({ name, options });
      exists = true;
      return true;
    },

    async getCollection() {
      return {
        config: {
          params: {
            vectors: {
              size: vectorSize,
              distance,
            },
          },
        },
        payload_schema: { ...schema },
      };
    },

    async upsert(collectionName, options) {
      calls.upsert.push({ collectionName, options });
      return { status: "completed" };
    },

    async createPayloadIndex(name, options) {
      calls.createPayloadIndex.push({ name, options });

      schema[options.field_name] = {
        data_type: options.field_schema,
      };

      return true;
    },
  };
};

test("creates a missing collection with the expected vector settings", async () => {
  const client = createFakeClient();

  const service = createQdrantService({ client, config });
  const result = await service.initializeCollection();

  assert.equal(client.calls.createCollection.length, 1);

  assert.deepEqual(client.calls.createCollection[0], {
    name: "skillforge_chunks_v1",
    options: {
      vectors: {
        size: 1024,
        distance: "Cosine",
      },
    },
  });

  assert.deepEqual(result.payloadIndexes, ["userId", "materialId"]);
});

test("does not recreate an existing compatible collection", async () => {
  const client = createFakeClient({ initiallyExists: true });

  const service = createQdrantService({ client, config });
  await service.initializeCollection();

  assert.equal(client.calls.createCollection.length, 0);
});

test("creates keyword indexes for userId and materialId", async () => {
  const client = createFakeClient();

  const service = createQdrantService({ client, config });
  await service.initializeCollection();

  assert.deepEqual(
    client.calls.createPayloadIndex.map(({ name, options }) => ({
      name,
      fieldName: options.field_name,
      fieldSchema: options.field_schema,
    })),
    [
      {
        name: "skillforge_chunks_v1",
        fieldName: "userId",
        fieldSchema: "keyword",
      },
      {
        name: "skillforge_chunks_v1",
        fieldName: "materialId",
        fieldSchema: "keyword",
      },
    ],
  );
});

test("rejects an existing collection with incompatible vector dimensions", async () => {
  const client = createFakeClient({
    initiallyExists: true,
    vectorSize: 768,
  });

  const service = createQdrantService({ client, config });

  await assert.rejects(
    service.initializeCollection(),
    /incompatible vector configuration/,
  );
});

test("rejects an existing collection with an incompatible distance", async () => {
  const client = createFakeClient({
    initiallyExists: true,
    distance: "Dot",
  });

  const service = createQdrantService({ client, config });

  await assert.rejects(
    service.initializeCollection(),
    /incompatible vector configuration/,
  );
});

test("rejects a payload index with an incompatible type", async () => {
  const client = createFakeClient({
    initiallyExists: true,
    payloadSchema: {
      userId: { data_type: "integer" },
    },
  });

  const service = createQdrantService({ client, config });

  await assert.rejects(service.initializeCollection(), /userId.*keyword type/);
});

test("persists chunks as Qdrant points with deterministic IDs and payload", async () => {
  const client = createFakeClient();
  const service = createQdrantService({ client, config });

  const chunk = {
    chunkId: "a".repeat(64),
    sequence: 0,
    text: "React is a JavaScript library.",
    startOffset: 0,
    endOffset: 30,
    materialId: "material-123",
    userId: "user-456",
    source: {
      pageStart: 1,
      pageEnd: 1,
    },
    embedding: Array(config.vectorSize).fill(0.25),
  };

  await service.persistChunks([chunk]);

  assert.equal(client.calls.upsert.length, 1);

  const { collectionName, options } = client.calls.upsert[0];

  assert.equal(collectionName, config.collectionName);
  assert.equal(options.wait, true);
  assert.equal(options.points.length, 1);

  const [point] = options.points;

  assert.match(
    point.id,
    /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );

  assert.equal(point.vector.length, config.vectorSize);
  assert.deepEqual(point.vector, chunk.embedding);

  assert.deepEqual(point.payload, {
    chunkId: chunk.chunkId,
    sequence: chunk.sequence,
    text: chunk.text,
    startOffset: chunk.startOffset,
    endOffset: chunk.endOffset,
    materialId: chunk.materialId,
    userId: chunk.userId,
    source: chunk.source,
  });
});

test("does not call Qdrant when persisting an empty array", async () => {
  const client = createFakeClient();
  const service = createQdrantService({ client, config });

  const result = await service.persistChunks([]);

  assert.deepEqual(result, { persistedCount: 0 });
  assert.equal(client.calls.upsert.length, 0);
});

test("rejects an embedding with the wrong dimensions before upserting", async () => {
  const client = createFakeClient();
  const service = createQdrantService({ client, config });

  const chunk = {
    chunkId: "chunk-1",
    sequence: 0,
    text: "Example chunk",
    startOffset: 0,
    endOffset: 13,
    materialId: "material-123",
    userId: "user-456",
    embedding: Array(config.vectorSize - 1).fill(0.1),
  };

  await assert.rejects(
    service.persistChunks([chunk]),
    /embedding must contain .* dimensions/i,
  );

  assert.equal(client.calls.upsert.length, 0);
});

test("rejects non-finite embedding values before upserting", async () => {
  const client = createFakeClient();
  const service = createQdrantService({ client, config });

  const embedding = Array(config.vectorSize).fill(0.1);
  embedding[10] = Number.NaN;

  const chunk = {
    chunkId: "chunk-2",
    sequence: 0,
    text: "Example chunk",
    startOffset: 0,
    endOffset: 13,
    materialId: "material-123",
    userId: "user-456",
    embedding,
  };

  await assert.rejects(service.persistChunks([chunk]), /finite numbers/i);

  assert.equal(client.calls.upsert.length, 0);
});

test("uses the same Qdrant point ID when the same chunk is persisted again", async () => {
  const client = createFakeClient();
  const service = createQdrantService({ client, config });

  const chunk = {
    chunkId: "stable-chunk-id",
    sequence: 0,
    text: "Example chunk",
    startOffset: 0,
    endOffset: 13,
    materialId: "material-123",
    userId: "user-456",
    embedding: Array(config.vectorSize).fill(0.1),
  };

  await service.persistChunks([chunk]);
  await service.persistChunks([chunk]);

  const firstId = client.calls.upsert[0].options.points[0].id;
  const secondId = client.calls.upsert[1].options.points[0].id;

  assert.equal(firstId, secondId);
});

test("rejects chunks missing ownership fields before upserting", async () => {
  const client = createFakeClient();
  const service = createQdrantService({ client, config });

  const chunk = {
    chunkId: "chunk-3",
    sequence: 0,
    text: "Example chunk",
    startOffset: 0,
    endOffset: 13,
    materialId: "material-123",
    embedding: Array(config.vectorSize).fill(0.1),
  };

  await assert.rejects(
    service.persistChunks([chunk]),
    /userId.*non-empty string/i,
  );

  assert.equal(client.calls.upsert.length, 0);
});
