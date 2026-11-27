import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import { createReaderContentService } from "../src/services/readerContentService.js";

const MATERIAL_ID = new mongoose.Types.ObjectId().toString();
const USER_ID = new mongoose.Types.ObjectId().toString();
const OTHER_USER_ID = new mongoose.Types.ObjectId().toString();

const READER_PROJECTION = "chunkId text sequence startOffset endOffset source";

const createDependencies = ({
  chunks = [
    {
      chunkId: "chunk-1",
      text: "First chunk",
      sequence: 0,
      startOffset: 0,
      endOffset: 11,
      source: null,
    },
    {
      chunkId: "chunk-2",
      text: "Second chunk",
      sequence: 1,
      startOffset: 12,
      endOffset: 24,
      source: null,
    },
  ],
  databaseError = null,
} = {}) => {
  const calls = [];

  const documentChunkModel = {
    find(filter) {
      calls.push({ method: "find", filter });

      return {
        select(projection) {
          calls.push({ method: "select", projection });

          return {
            sort(sortOptions) {
              calls.push({ method: "sort", sortOptions });

              return {
                async lean() {
                  calls.push({ method: "lean" });

                  if (databaseError) {
                    throw databaseError;
                  }

                  return chunks;
                },
              };
            },
          };
        },
      };
    },
  };

  return {
    calls,
    service: createReaderContentService({
      documentChunkModel,
    }),
  };
};

test("returns reader content for the requested material and user", async () => {
  const { service } = createDependencies();

  const chunks = await service.getReaderContent({
    materialId: MATERIAL_ID,
    userId: USER_ID,
  });

  assert.equal(chunks.length, 2);
  assert.equal(chunks[0].text, "First chunk");
  assert.equal(chunks[1].text, "Second chunk");
});

test("queries MongoDB using both material ID and authenticated user ID", async () => {
  const { service, calls } = createDependencies();

  await service.getReaderContent({
    materialId: MATERIAL_ID,
    userId: USER_ID,
  });

  assert.deepEqual(calls[0], {
    method: "find",
    filter: {
      materialId: MATERIAL_ID,
      userId: USER_ID,
    },
  });

  assert.notEqual(calls[0].filter.userId, OTHER_USER_ID);
});

test("selects only the fields required by the reader", async () => {
  const { service, calls } = createDependencies();

  await service.getReaderContent({
    materialId: MATERIAL_ID,
    userId: USER_ID,
  });

  assert.deepEqual(calls[1], {
    method: "select",
    projection: READER_PROJECTION,
  });
});

test("sorts chunks by ascending sequence before returning them", async () => {
  const { service, calls } = createDependencies();

  await service.getReaderContent({
    materialId: MATERIAL_ID,
    userId: USER_ID,
  });

  assert.deepEqual(calls[2], {
    method: "sort",
    sortOptions: { sequence: 1 },
  });
});

test("uses lean queries to return plain reader data", async () => {
  const { service, calls } = createDependencies();

  await service.getReaderContent({
    materialId: MATERIAL_ID,
    userId: USER_ID,
  });

  assert.deepEqual(calls[3], {
    method: "lean",
  });
});

test("rejects an invalid material ID without querying MongoDB", async () => {
  const { service, calls } = createDependencies();

  await assert.rejects(
    service.getReaderContent({
      materialId: "invalid-material-id",
      userId: USER_ID,
    }),
    {
      message: "Invalid material ID.",
      statusCode: 400,
    },
  );

  assert.equal(calls.length, 0);
});

test("rejects a missing or invalid user ID without querying MongoDB", async () => {
  const { service, calls } = createDependencies();

  await assert.rejects(
    service.getReaderContent({
      materialId: MATERIAL_ID,
      userId: "invalid-user-id",
    }),
    {
      message: "Unauthenticated.",
      statusCode: 401,
    },
  );

  assert.equal(calls.length, 0);
});

test("returns an empty array when the material has no chunks", async () => {
  const { service } = createDependencies({
    chunks: [],
  });

  const chunks = await service.getReaderContent({
    materialId: MATERIAL_ID,
    userId: USER_ID,
  });

  assert.deepEqual(chunks, []);
});

test("propagates unexpected MongoDB errors", async () => {
  const databaseError = new Error("MongoDB connection failed");

  const { service } = createDependencies({
    databaseError,
  });

  await assert.rejects(
    service.getReaderContent({
      materialId: MATERIAL_ID,
      userId: USER_ID,
    }),
    (error) => error === databaseError,
  );
});
