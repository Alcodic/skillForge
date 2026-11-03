import test from "node:test";
import assert from "node:assert/strict";

import { createProcessMaterialController } from "../src/controllers/materials/materialController.js";

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
  userId: "user-123",
  params: {
    id: "material-456",
  },
});

test("returns 202 and processing counts after successful processing", async () => {
  let receivedInput;

  const controller = createProcessMaterialController({
    processMaterialDocumentFn: async (input) => {
      receivedInput = input;

      return {
        materialId: "material-456",
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
    materialId: "material-456",
    userId: "user-123",
  });

  assert.equal(res.statusCode, 202);

  assert.deepEqual(res.body, {
    success: true,
    data: {
      material: {
        id: "material-456",
        processingStatus: "PROCESSING",
        chunkCount: 12,
        vectorCount: 12,
        metadataCount: 12,
      },
    },
  });
});

test("returns zero counts when the document contains no chunks", async () => {
  const controller = createProcessMaterialController({
    processMaterialDocumentFn: async () => ({
      materialId: "material-456",
      chunkCount: 0,
      vectorCount: 0,
      metadataCount: 0,
    }),
  });

  const res = createResponse();

  await controller(createRequest(), res);

  assert.equal(res.statusCode, 202);
  assert.deepEqual(res.body.data.material, {
    id: "material-456",
    processingStatus: "PROCESSING",
    chunkCount: 0,
    vectorCount: 0,
    metadataCount: 0,
  });
});

test("returns a known processing error using its status code and message", async () => {
  const processingError = new Error("Material not found.");
  processingError.statusCode = 404;

  const controller = createProcessMaterialController({
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
  const controller = createProcessMaterialController({
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

  const controller = createProcessMaterialController({
    processMaterialDocumentFn: async ({ userId }) => {
      receivedUserId = userId;

      return {
        materialId: "material-456",
        chunkCount: 1,
        vectorCount: 1,
        metadataCount: 1,
      };
    },
  });

  const req = createRequest();
  req.userId = "authenticated-user-789";

  await controller(req, createResponse());

  assert.equal(receivedUserId, "authenticated-user-789");
});
