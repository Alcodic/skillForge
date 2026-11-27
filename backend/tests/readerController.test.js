import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import { createReaderController } from "../src/controllers/materials/readerController.js";

const MATERIAL_ID = new mongoose.Types.ObjectId().toString();
const USER_ID = new mongoose.Types.ObjectId().toString();

const createResponse = () => {
  const res = {
    statusCode: null,
    body: null,

    status(code) {
      this.statusCode = code;
      return this;
    },

    json(payload) {
      this.body = payload;
      return this;
    },
  };

  return res;
};

const createRequest = ({
  materialId = MATERIAL_ID,
  userId = USER_ID,
  query = {},
} = {}) => ({
  params: { id: materialId },
  userId,
  query,
});

const createDependencies = ({
  accessError = null,
  readerError = null,
  readerResult = {
    chunks: [
      {
        chunkId: "chunk-1",
        text: "Introduction to JavaScript.",
        sequence: 0,
        startOffset: 0,
        endOffset: 28,
        source: { page: 1 },
      },
    ],
    pagination: {
      limit: 20,
      hasNextPage: false,
      nextCursor: null,
    },
  },
} = {}) => {
  const calls = [];

  const materialAccessServiceInstance = {
    async getReadyMaterial(input) {
      calls.push({ operation: "access", input });

      if (accessError) {
        throw accessError;
      }

      return { _id: input.materialId, processingStatus: "READY" };
    },
  };

  const readerContentServiceInstance = {
    async getReaderContent(input) {
      calls.push({ operation: "reader", input });

      if (readerError) {
        throw readerError;
      }

      return readerResult;
    },
  };

  return {
    calls,
    controller: createReaderController({
      materialAccessServiceInstance,
      readerContentServiceInstance,
    }),
  };
};

test("returns 200 with reader content and pagination", async () => {
  const { controller, calls } = createDependencies();
  const res = createResponse();

  await controller(createRequest(), res);

  assert.equal(res.statusCode, 200);

  assert.deepEqual(res.body, {
    success: true,
    data: {
      chunks: [
        {
          chunkId: "chunk-1",
          text: "Introduction to JavaScript.",
          sequence: 0,
          startOffset: 0,
          endOffset: 28,
          source: { page: 1 },
        },
      ],
      pagination: {
        limit: 20,
        hasNextPage: false,
        nextCursor: null,
      },
    },
  });

  assert.equal(calls.length, 2);
  assert.equal(calls[0].operation, "access");
  assert.equal(calls[1].operation, "reader");
});

test("uses the authenticated user ID for material access and reader retrieval", async () => {
  const authenticatedUserId = new mongoose.Types.ObjectId().toString();

  const { controller, calls } = createDependencies();
  const res = createResponse();

  await controller(createRequest({ userId: authenticatedUserId }), res);

  assert.equal(calls[0].input.userId, authenticatedUserId);
  assert.equal(calls[1].input.userId, authenticatedUserId);
});

test("uses the default page size when limit is omitted", async () => {
  const { controller, calls } = createDependencies();
  const res = createResponse();

  await controller(createRequest(), res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(calls[1].input, {
    materialId: MATERIAL_ID,
    userId: USER_ID,
    limit: 20,
    afterSequence: undefined,
  });
});

test("passes valid pagination parameters to the reader service", async () => {
  const { controller, calls } = createDependencies();
  const res = createResponse();

  await controller(
    createRequest({
      query: {
        limit: "10",
        afterSequence: "19",
      },
    }),
    res,
  );

  assert.equal(res.statusCode, 200);

  assert.deepEqual(calls[1].input, {
    materialId: MATERIAL_ID,
    userId: USER_ID,
    limit: 10,
    afterSequence: 19,
  });
});

test("returns 400 when limit is below the minimum", async () => {
  const { controller, calls } = createDependencies();
  const res = createResponse();

  await controller(createRequest({ query: { limit: "0" } }), res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.message, "Limit must be an integer between 1 and 50.");
  assert.equal(calls.length, 0);
});

test("returns 400 when limit exceeds the maximum", async () => {
  const { controller, calls } = createDependencies();
  const res = createResponse();

  await controller(createRequest({ query: { limit: "51" } }), res);

  assert.equal(res.statusCode, 400);
  assert.equal(calls.length, 0);
});

test("returns 400 when limit is not an integer", async () => {
  const { controller, calls } = createDependencies();
  const res = createResponse();

  await controller(createRequest({ query: { limit: "2.5" } }), res);

  assert.equal(res.statusCode, 400);
  assert.equal(calls.length, 0);
});

test("returns 400 when limit is not numeric", async () => {
  const { controller, calls } = createDependencies();
  const res = createResponse();

  await controller(createRequest({ query: { limit: "invalid" } }), res);

  assert.equal(res.statusCode, 400);
  assert.equal(calls.length, 0);
});

test("returns 400 when afterSequence is negative", async () => {
  const { controller, calls } = createDependencies();
  const res = createResponse();

  await controller(createRequest({ query: { afterSequence: "-1" } }), res);

  assert.equal(res.statusCode, 400);
  assert.equal(
    res.body.message,
    "afterSequence must be a non-negative integer.",
  );
  assert.equal(calls.length, 0);
});

test("returns 400 when afterSequence is not an integer", async () => {
  const { controller, calls } = createDependencies();
  const res = createResponse();

  await controller(createRequest({ query: { afterSequence: "1.5" } }), res);

  assert.equal(res.statusCode, 400);
  assert.equal(calls.length, 0);
});

test("returns the material access error status and message", async () => {
  const error = new Error("Material not found.");
  error.statusCode = 404;

  const { controller, calls } = createDependencies({
    accessError: error,
  });

  const res = createResponse();

  await controller(createRequest(), res);

  assert.equal(res.statusCode, 404);

  assert.deepEqual(res.body, {
    success: false,
    message: "Material not found.",
  });

  // Reader retrieval must not happen after failed authorization.
  assert.equal(calls.length, 1);
  assert.equal(calls[0].operation, "access");
});

test("returns 409 when the material is not READY", async () => {
  const error = new Error("Material is not ready for learning.");
  error.statusCode = 409;

  const { controller, calls } = createDependencies({
    accessError: error,
  });

  const res = createResponse();

  await controller(createRequest(), res);

  assert.equal(res.statusCode, 409);
  assert.equal(res.body.message, "Material is not ready for learning.");
  assert.equal(calls.length, 1);
});

test("returns a reader service validation error", async () => {
  const error = new Error("afterSequence must be a non-negative integer.");
  error.statusCode = 400;

  const { controller } = createDependencies({
    readerError: error,
  });

  const res = createResponse();

  await controller(createRequest(), res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.message, error.message);
});

test("returns a generic 500 response for unexpected errors", async () => {
  const error = new Error("Sensitive database connection details");

  const { controller } = createDependencies({
    readerError: error,
  });

  const res = createResponse();

  await controller(createRequest(), res);

  assert.equal(res.statusCode, 500);

  assert.deepEqual(res.body, {
    success: false,
    message: "Something went wrong.",
  });

  assert.equal(res.body.message.includes("Sensitive database"), false);
});

test("does not retrieve reader content when material authorization fails", async () => {
  const error = new Error("Unauthenticated.");
  error.statusCode = 401;

  const { controller, calls } = createDependencies({
    accessError: error,
  });

  const res = createResponse();

  await controller(createRequest({ userId: "invalid-user-id" }), res);

  assert.equal(res.statusCode, 401);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].operation, "access");
});
