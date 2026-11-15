import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import { createProcessMaterialController } from "../src/controllers/materials/materialController.js";

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

const createRequest = () => ({
  userId: USER_ID,
  params: {
    id: MATERIAL_ID,
  },
});

const createDependencies = ({
  processingStatus = "QUEUED",
  storageReference = "users/test/materials/original/file",
  materialExists = true,
  processMaterialDocumentFn = async () => ({
    materialId: MATERIAL_ID,
    processingStatus: "READY",
    chunkCount: 12,
    vectorCount: 12,
    metadataCount: 12,
  }),
} = {}) => {
  const calls = [];

  let currentStatus = processingStatus;

  const learningMaterialModel = {
    findOneAndUpdate(filter, update, options) {
      calls.push({
        operation: "claim",
        filter,
        update,
        options,
      });

      const canClaim =
        materialExists &&
        ["QUEUED", "FAILED"].includes(currentStatus) &&
        typeof storageReference === "string" &&
        storageReference.trim().length > 0 &&
        storageReference !== "PENDING";

      if (!canClaim) {
        return {
          select: async () => null,
        };
      }

      currentStatus = "PROCESSING";

      return {
        select: async () => ({
          _id: MATERIAL_ID,
        }),
      };
    },
    findOne(filter) {
      calls.push({
        operation: "findOne",
        filter,
      });

      return {
        select: async () =>
          materialExists && currentStatus
            ? { processingStatus: currentStatus }
            : null,
      };
    },
  };

  return {
    calls,
    learningMaterialModel,
    getCurrentStatus: () => currentStatus,
    controller: createProcessMaterialController({
      learningMaterialModel,
      processMaterialDocumentFn,
    }),
  };
};

test("returns 200 and READY with processing counts after successful processing", async () => {
  let receivedInput;

  const { controller, calls, getCurrentStatus } = createDependencies({
    processMaterialDocumentFn: async (input) => {
      receivedInput = input;

      return {
        materialId: MATERIAL_ID,
        processingStatus: "READY",
        chunkCount: 12,
        vectorCount: 12,
        metadataCount: 12,
      };
    },
  });

  const req = createRequest();
  const res = createResponse();

  await controller(req, res);

  assert.deepEqual(receivedInput, {
    materialId: MATERIAL_ID,
    userId: USER_ID,
  });

  assert.equal(res.statusCode, 200);

  assert.deepEqual(res.body, {
    success: true,
    data: {
      material: {
        id: MATERIAL_ID,
        processingStatus: "READY",
        chunkCount: 12,
        vectorCount: 12,
        metadataCount: 12,
      },
    },
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].operation, "claim");
  assert.equal(getCurrentStatus(), "PROCESSING");
});

test("returns 422 when document processing produces no usable chunks", async () => {
  const processingError = new Error(
    "Document processing produced no usable chunks.",
  );
  processingError.statusCode = 422;

  const { controller, calls } = createDependencies({
    processMaterialDocumentFn: async () => {
      throw processingError;
    },
  });

  const res = createResponse();

  await controller(createRequest(), res);

  assert.equal(res.statusCode, 422);

  assert.deepEqual(res.body, {
    success: false,
    message: "Document processing produced no usable chunks.",
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].operation, "claim");
});

test("returns a known processing error using its status code and message", async () => {
  const processingError = new Error("Material not found.");
  processingError.statusCode = 404;

  const { controller } = createDependencies({
    processMaterialDocumentFn: async () => {
      throw processingError;
    },
  });

  const res = createResponse();

  await controller(createRequest(), res);

  assert.equal(res.statusCode, 404);

  assert.deepEqual(res.body, {
    success: false,
    message: "Material not found.",
  });
});

test("returns a generic 500 response for unexpected errors", async () => {
  const { controller } = createDependencies({
    processMaterialDocumentFn: async () => {
      throw new Error("Sensitive internal database details");
    },
  });

  const res = createResponse();

  await controller(createRequest(), res);

  assert.equal(res.statusCode, 500);

  assert.deepEqual(res.body, {
    success: false,
    message: "Something went wrong.",
  });

  assert.equal(res.body.message.includes("Sensitive internal"), false);
});

test("passes the authenticated user ID to the processing service", async () => {
  let receivedUserId;

  const authenticatedUserId = new mongoose.Types.ObjectId().toString();

  const { controller } = createDependencies({
    processMaterialDocumentFn: async ({ userId }) => {
      receivedUserId = userId;

      return {
        materialId: MATERIAL_ID,
        processingStatus: "READY",
        chunkCount: 1,
        vectorCount: 1,
        metadataCount: 1,
      };
    },
  });

  const req = createRequest();
  req.userId = authenticatedUserId;

  await controller(req, createResponse());

  assert.equal(receivedUserId, authenticatedUserId);
});

test("allows a FAILED material to be claimed for retry", async () => {
  let processingServiceCalled = false;

  const { controller, calls, getCurrentStatus } = createDependencies({
    processingStatus: "FAILED",
    processMaterialDocumentFn: async () => {
      processingServiceCalled = true;

      return {
        materialId: MATERIAL_ID,
        processingStatus: "READY",
        chunkCount: 8,
        vectorCount: 8,
        metadataCount: 8,
      };
    },
  });

  const res = createResponse();

  await controller(createRequest(), res);

  assert.equal(res.statusCode, 200);
  assert.equal(processingServiceCalled, true);
  assert.equal(getCurrentStatus(), "PROCESSING");

  assert.deepEqual(calls[0].filter.processingStatus, {
    $in: ["QUEUED", "FAILED"],
  });

  assert.equal(calls[0].update.$set.processingStatus, "PROCESSING");
});

test("rejects a material that is already PROCESSING", async () => {
  let processingServiceCalled = false;

  const { controller, calls } = createDependencies({
    processingStatus: "PROCESSING",
    processMaterialDocumentFn: async () => {
      processingServiceCalled = true;
    },
  });

  const res = createResponse();

  await controller(createRequest(), res);

  assert.equal(res.statusCode, 409);

  assert.deepEqual(res.body, {
    success: false,
    message: "Material cannot be processed in its current state: PROCESSING.",
  });

  assert.equal(processingServiceCalled, false);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].operation, "claim");
  assert.equal(calls[1].operation, "findOne");
});

test("rejects a material that is already READY", async () => {
  let processingServiceCalled = false;

  const { controller, calls } = createDependencies({
    processingStatus: "READY",
    processMaterialDocumentFn: async () => {
      processingServiceCalled = true;
    },
  });

  const res = createResponse();

  await controller(createRequest(), res);

  assert.equal(res.statusCode, 409);

  assert.deepEqual(res.body, {
    success: false,
    message: "Material cannot be processed in its current state: READY.",
  });

  assert.equal(processingServiceCalled, false);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].operation, "claim");
  assert.equal(calls[1].operation, "findOne");
});

test("returns 400 for an invalid material ID without attempting a database claim", async () => {
  let processingServiceCalled = false;

  const { controller, calls } = createDependencies({
    processMaterialDocumentFn: async () => {
      processingServiceCalled = true;
    },
  });

  const req = createRequest();
  req.params.id = "invalid-material-id";

  const res = createResponse();

  await controller(req, res);

  assert.equal(res.statusCode, 400);

  assert.deepEqual(res.body, {
    success: false,
    message: "Invalid material ID.",
  });

  assert.equal(processingServiceCalled, false);
  assert.equal(calls.length, 0);
});

test("returns 404 when the material does not exist", async () => {
  let processingServiceCalled = false;

  const { controller, calls } = createDependencies({
    materialExists: false,
    processMaterialDocumentFn: async () => {
      processingServiceCalled = true;
    },
  });

  const res = createResponse();

  await controller(createRequest(), res);

  assert.equal(res.statusCode, 404);

  assert.deepEqual(res.body, {
    success: false,
    message: "Material not found.",
  });

  assert.equal(processingServiceCalled, false);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].operation, "claim");
  assert.equal(calls[1].operation, "findOne");

  assert.equal(calls[1].filter._id, MATERIAL_ID);
  assert.equal(calls[1].filter.userId, USER_ID);
});
