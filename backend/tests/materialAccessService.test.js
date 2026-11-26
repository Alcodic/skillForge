import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import { createMaterialAccessService } from "../src/services/materialAccessService.js";

const MATERIAL_ID = new mongoose.Types.ObjectId().toString();
const USER_ID = new mongoose.Types.ObjectId().toString();
const OTHER_USER_ID = new mongoose.Types.ObjectId().toString();

const createDependencies = ({
  materialExists = true,
  processingStatus = "READY",
  databaseError = null,
} = {}) => {
  const calls = [];

  const learningMaterialModel = {
    async findOne(filter) {
      calls.push(filter);

      if (databaseError) {
        throw databaseError;
      }

      if (!materialExists) {
        return null;
      }

      return {
        _id: MATERIAL_ID,
        userId: USER_ID,
        title: "JavaScript Fundamentals",
        processingStatus,
      };
    },
  };

  return {
    calls,
    service: createMaterialAccessService({
      learningMaterialModel,
    }),
  };
};

test("returns an owned material when its status is READY", async () => {
  const { service, calls } = createDependencies();

  const material = await service.getReadyMaterial({
    materialId: MATERIAL_ID,
    userId: USER_ID,
  });

  assert.equal(material._id, MATERIAL_ID);
  assert.equal(material.userId, USER_ID);
  assert.equal(material.processingStatus, "READY");

  assert.deepEqual(calls, [
    {
      _id: MATERIAL_ID,
      userId: USER_ID,
    },
  ]);
});

test("rejects an invalid material ID without querying MongoDB", async () => {
  const { service, calls } = createDependencies();

  await assert.rejects(
    service.getReadyMaterial({
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
    service.getReadyMaterial({
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

test("queries MongoDB using both material ID and authenticated user ID", async () => {
  const { service, calls } = createDependencies();

  await service.getReadyMaterial({
    materialId: MATERIAL_ID,
    userId: USER_ID,
  });

  assert.deepEqual(calls[0], {
    _id: MATERIAL_ID,
    userId: USER_ID,
  });

  assert.equal(calls[0].userId === OTHER_USER_ID, false);
});

test("returns 404 when the material does not exist or is not owned by the user", async () => {
  const { service, calls } = createDependencies({
    materialExists: false,
  });

  await assert.rejects(
    service.getReadyMaterial({
      materialId: MATERIAL_ID,
      userId: USER_ID,
    }),
    {
      message: "Material not found.",
      statusCode: 404,
    },
  );

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    _id: MATERIAL_ID,
    userId: USER_ID,
  });
});

test("rejects a material with PROCESSING status", async () => {
  const { service } = createDependencies({
    processingStatus: "PROCESSING",
  });

  await assert.rejects(
    service.getReadyMaterial({
      materialId: MATERIAL_ID,
      userId: USER_ID,
    }),
    {
      message: "Material is not ready for learning.",
      statusCode: 409,
    },
  );
});

test("rejects a material with FAILED status", async () => {
  const { service } = createDependencies({
    processingStatus: "FAILED",
  });

  await assert.rejects(
    service.getReadyMaterial({
      materialId: MATERIAL_ID,
      userId: USER_ID,
    }),
    {
      message: "Material is not ready for learning.",
      statusCode: 409,
    },
  );
});

test("rejects a material with QUEUED status", async () => {
  const { service } = createDependencies({
    processingStatus: "QUEUED",
  });

  await assert.rejects(
    service.getReadyMaterial({
      materialId: MATERIAL_ID,
      userId: USER_ID,
    }),
    {
      message: "Material is not ready for learning.",
      statusCode: 409,
    },
  );
});

test("propagates unexpected MongoDB errors", async () => {
  const databaseError = new Error("MongoDB connection failed");

  const { service } = createDependencies({
    databaseError,
  });

  await assert.rejects(
    service.getReadyMaterial({
      materialId: MATERIAL_ID,
      userId: USER_ID,
    }),
    (error) => error === databaseError,
  );
});
