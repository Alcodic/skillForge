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
