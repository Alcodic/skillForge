import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import { createReaderContentService } from "../src/services/readerContentService.js";

const MATERIAL_ID = new mongoose.Types.ObjectId().toString();
const USER_ID = new mongoose.Types.ObjectId().toString();
const OTHER_USER_ID = new mongoose.Types.ObjectId().toString();

const READER_PROJECTION = "chunkId text sequence startOffset endOffset source";

const createChunks = (count) =>
  Array.from({ length: count }, (_, index) => ({
    chunkId: `chunk-${index + 1}`,
    text: `Chunk content ${index + 1}`,
    sequence: index,
    startOffset: index * 100,
    endOffset: index * 100 + 99,
    source: null,
  }));

const createDependencies = ({
  chunks = createChunks(2),
  databaseError = null,
} = {}) => {
  const calls = [];

  const query = {
    async lean() {
      calls.push({ method: "lean" });

      if (databaseError) {
        throw databaseError;
      }

      return chunks;
    },
  };

  query.limit = (limitValue) => {
    calls.push({
      method: "limit",
      limitValue,
    });

    return query;
  };

  query.sort = (sortOptions) => {
    calls.push({
      method: "sort",
      sortOptions,
    });

    return query;
  };

  query.select = (projection) => {
    calls.push({
      method: "select",
      projection,
    });

    return query;
  };

  const documentChunkModel = {
    find(filter) {
      calls.push({
        method: "find",
        filter,
      });

      return query;
    },
  };

  return {
    calls,
    service: createReaderContentService({
      documentChunkModel,
    }),
  };
};

const validRequest = {
  materialId: MATERIAL_ID,
  userId: USER_ID,
};

// Existing Step 7.I.5 tests

test("returns reader content and pagination metadata", async () => {
  const { service } = createDependencies();

  const result = await service.getReaderContent(validRequest);

  assert.equal(result.chunks.length, 2);
  assert.equal(result.chunks[0].text, "Chunk content 1");
  assert.equal(result.chunks[1].text, "Chunk content 2");

  assert.deepEqual(result.pagination, {
    limit: 20,
    hasNextPage: false,
    nextCursor: null,
  });
});

test("queries MongoDB using both material ID and authenticated user ID", async () => {
  const { service, calls } = createDependencies();

  await service.getReaderContent(validRequest);

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

  await service.getReaderContent(validRequest);

  assert.deepEqual(calls[1], {
    method: "select",
    projection: READER_PROJECTION,
  });
});

test("sorts chunks by ascending sequence", async () => {
  const { service, calls } = createDependencies();

  await service.getReaderContent(validRequest);

  assert.deepEqual(calls[2], {
    method: "sort",
    sortOptions: { sequence: 1 },
  });
});

test("uses lean queries to return plain reader data", async () => {
  const { service, calls } = createDependencies();

  await service.getReaderContent(validRequest);

  assert.deepEqual(calls[4], {
    method: "lean",
  });
});

test("rejects an invalid material ID without querying MongoDB", async () => {
  const { service, calls } = createDependencies();

  await assert.rejects(
    service.getReaderContent({
      ...validRequest,
      materialId: "invalid-material-id",
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
      ...validRequest,
      userId: "invalid-user-id",
    }),
    {
      message: "Unauthenticated.",
      statusCode: 401,
    },
  );

  assert.equal(calls.length, 0);
});

test("propagates unexpected MongoDB errors", async () => {
  const databaseError = new Error("MongoDB connection failed");

  const { service } = createDependencies({
    databaseError,
  });

  await assert.rejects(
    service.getReaderContent(validRequest),
    (error) => error === databaseError,
  );
});

// Step 7.I.6 — Pagination tests

test("uses the default page size of 20 and fetches one extra chunk", async () => {
  const { service, calls } = createDependencies();

  const result = await service.getReaderContent(validRequest);

  assert.deepEqual(
    calls.find((call) => call.method === "limit"),
    {
      method: "limit",
      limitValue: 21,
    },
  );

  assert.equal(result.pagination.limit, 20);
});

test("accepts a custom page size", async () => {
  const { service, calls } = createDependencies({
    chunks: createChunks(6),
  });

  const result = await service.getReaderContent({
    ...validRequest,
    limit: 5,
  });

  assert.equal(result.chunks.length, 5);

  assert.deepEqual(
    calls.find((call) => call.method === "limit"),
    {
      method: "limit",
      limitValue: 6,
    },
  );

  assert.equal(result.pagination.limit, 5);
});

test("accepts the maximum page size of 50", async () => {
  const { service, calls } = createDependencies({
    chunks: createChunks(50),
  });

  const result = await service.getReaderContent({
    ...validRequest,
    limit: 50,
  });

  assert.equal(result.chunks.length, 50);

  assert.deepEqual(
    calls.find((call) => call.method === "limit"),
    {
      method: "limit",
      limitValue: 51,
    },
  );
});

test("rejects a page size greater than 50", async () => {
  const { service, calls } = createDependencies();

  await assert.rejects(
    service.getReaderContent({
      ...validRequest,
      limit: 51,
    }),
    {
      message: "Limit must be an integer between 1 and 50.",
      statusCode: 400,
    },
  );

  assert.equal(calls.length, 0);
});

test("rejects zero, negative, decimal and non-numeric page sizes", async () => {
  const invalidLimits = [0, -1, 1.5, "10", null];

  for (const limit of invalidLimits) {
    const { service, calls } = createDependencies();

    await assert.rejects(
      service.getReaderContent({
        ...validRequest,
        limit,
      }),
      {
        message: "Limit must be an integer between 1 and 50.",
        statusCode: 400,
      },
    );

    assert.equal(calls.length, 0);
  }
});

test("does not add a sequence cursor condition to the first page", async () => {
  const { service, calls } = createDependencies();

  await service.getReaderContent(validRequest);

  assert.deepEqual(calls[0].filter, {
    materialId: MATERIAL_ID,
    userId: USER_ID,
  });

  assert.equal(Object.hasOwn(calls[0].filter, "sequence"), false);
});

test("uses afterSequence to retrieve the next page", async () => {
  const { service, calls } = createDependencies({
    chunks: createChunks(3),
  });

  await service.getReaderContent({
    ...validRequest,
    limit: 2,
    afterSequence: 1,
  });

  assert.deepEqual(calls[0].filter, {
    materialId: MATERIAL_ID,
    userId: USER_ID,
    sequence: {
      $gt: 1,
    },
  });
});

test("returns only the requested number of chunks when another page exists", async () => {
  const { service } = createDependencies({
    chunks: createChunks(3),
  });

  const result = await service.getReaderContent({
    ...validRequest,
    limit: 2,
  });

  assert.equal(result.chunks.length, 2);
  assert.equal(result.pagination.hasNextPage, true);
  assert.equal(result.pagination.nextCursor, 1);
});

test("uses the last returned chunk sequence as the next cursor", async () => {
  const { service } = createDependencies({
    chunks: createChunks(4),
  });

  const result = await service.getReaderContent({
    ...validRequest,
    limit: 3,
  });

  assert.equal(result.chunks.length, 3);
  assert.equal(result.chunks[2].sequence, 2);
  assert.equal(result.pagination.nextCursor, 2);
});

test("does not return the look-ahead chunk in the current page", async () => {
  const { service } = createDependencies({
    chunks: createChunks(3),
  });

  const result = await service.getReaderContent({
    ...validRequest,
    limit: 2,
  });

  assert.deepEqual(
    result.chunks.map((chunk) => chunk.sequence),
    [0, 1],
  );

  assert.equal(
    result.chunks.some((chunk) => chunk.sequence === 2),
    false,
  );
});

test("returns hasNextPage false and a null cursor on the final page", async () => {
  const { service } = createDependencies({
    chunks: createChunks(2),
  });

  const result = await service.getReaderContent({
    ...validRequest,
    limit: 2,
  });

  assert.equal(result.chunks.length, 2);
  assert.equal(result.pagination.hasNextPage, false);
  assert.equal(result.pagination.nextCursor, null);
});

test("returns an empty chunk array for a material with no chunks", async () => {
  const { service } = createDependencies({
    chunks: [],
  });

  const result = await service.getReaderContent(validRequest);

  assert.deepEqual(result.chunks, []);

  assert.deepEqual(result.pagination, {
    limit: 20,
    hasNextPage: false,
    nextCursor: null,
  });
});

test("rejects negative, decimal and non-numeric cursors", async () => {
  const invalidCursors = [-1, 1.5, "10", null];

  for (const afterSequence of invalidCursors) {
    const { service, calls } = createDependencies();

    await assert.rejects(
      service.getReaderContent({
        ...validRequest,
        afterSequence,
      }),
      {
        message: "afterSequence must be a non-negative integer.",
        statusCode: 400,
      },
    );

    assert.equal(calls.length, 0);
  }
});

test("accepts sequence zero as a valid cursor", async () => {
  const { service, calls } = createDependencies();

  await service.getReaderContent({
    ...validRequest,
    afterSequence: 0,
  });

  assert.deepEqual(calls[0].filter.sequence, {
    $gt: 0,
  });
});

test("keeps material and user ownership filters when using pagination", async () => {
  const { service, calls } = createDependencies();

  await service.getReaderContent({
    ...validRequest,
    limit: 10,
    afterSequence: 5,
  });

  assert.deepEqual(calls[0].filter, {
    materialId: MATERIAL_ID,
    userId: USER_ID,
    sequence: {
      $gt: 5,
    },
  });
});
