import mongoose from "mongoose";

import LearningMaterial from "../models/LearningMaterial.js";
import DocumentChunk from "../models/DocumentChunk.js";

import { downloadFile } from "./storageService.js";
import { extractPdfText } from "./pdfExtractionService.js";
import { normalizeExtractionResult } from "./textNormalizationService.js";
import { chunkText } from "./textChunkingService.js";
import { createConfiguredEmbeddingService } from "./createConfiguredEmbeddingService.js";
import { createQdrantService } from "./qdrantService.js";

export const prepareMaterialForProcessing = async ({ materialId, userId }) => {
  if (!mongoose.Types.ObjectId.isValid(materialId)) {
    const error = new Error("Invalid material ID.");
    error.statusCode = 400;
    throw error;
  }

  const material = await LearningMaterial.findOne({
    _id: materialId,
    userId,
  });

  if (!material) {
    const error = new Error("Material not found.");
    error.statusCode = 404;
    throw error;
  }

  if (material.processingStatus !== "PROCESSING") {
    const error = new Error(
      "Material must be in PROCESSING status before processing.",
    );
    error.statusCode = 409;
    throw error;
  }

  if (!material.storageReference || material.storageReference === "PENDING") {
    const error = new Error("Material storage reference is unavailable.");
    error.statusCode = 409;
    throw error;
  }

  const fileBuffer = await downloadFile({
    objectKey: material.storageReference,
  });

  return {
    materialId: material._id,
    userId: material.userId,
    storageReference: material.storageReference,
    fileType: material.fileType,
    originalFileName: material.originalFileName,
    fileBuffer,
  };
};

export const persistChunkMetadata = async ({
  chunks,
  pointIds,
  materialId,
  userId,
  documentChunkModel = DocumentChunk,
}) => {
  if (!Array.isArray(chunks)) {
    throw new TypeError("Chunks must be provided as an array.");
  }

  if (!Array.isArray(pointIds)) {
    throw new TypeError("Qdrant point IDs must be provided as an array.");
  }

  if (chunks.length !== pointIds.length) {
    throw new Error(
      "Chunk count does not match the number of Qdrant point IDs.",
    );
  }

  if (chunks.length === 0) {
    return { persistedCount: 0 };
  }

  const operations = chunks.map((chunk, index) => {
    if (!chunk?.chunkId || typeof chunk.chunkId !== "string") {
      throw new TypeError(`Chunk at index ${index} is missing its chunk ID.`);
    }

    const pointId = pointIds[index];

    if (typeof pointId !== "string" || !pointId.trim()) {
      throw new TypeError(`Qdrant point ID at index ${index} is missing.`);
    }

    if (
      !Number.isInteger(chunk.sequence) ||
      !Number.isInteger(chunk.startOffset) ||
      !Number.isInteger(chunk.endOffset)
    ) {
      throw new TypeError("Chunk sequence and offsets must be integers.");
    }

    const document = {
      chunkId: chunk.chunkId,
      materialId,
      userId,
      sequence: chunk.sequence,
      startOffset: chunk.startOffset,
      endOffset: chunk.endOffset,
      text: chunk.text,
      qdrantPointId: pointId,
    };

    if (chunk.source !== undefined) {
      document.source = {
        pageStart: chunk.source.pageStart,
        pageEnd: chunk.source.pageEnd,
      };
    }

    return {
      updateOne: {
        filter: { chunkId: chunk.chunkId },
        update: { $set: document },
        upsert: true,
      },
    };
  });

  await documentChunkModel.bulkWrite(operations, { ordered: true });

  return { persistedCount: operations.length };
};

/**
 * Runs the document processing pipeline through chunk metadata persistence.
 *
 * Dependencies can be injected in tests to avoid external services.
 */
export const processMaterialDocument = async ({
  materialId,
  userId,
  embedTexts,
  qdrantService,
  documentChunkModel = DocumentChunk,
  prepareMaterial = prepareMaterialForProcessing,
  extractPdfTextFn = extractPdfText,
  normalizeExtractionResultFn = normalizeExtractionResult,
  chunkTextFn = chunkText,
  persistChunkMetadataFn = persistChunkMetadata,
}) => {
  const processingInput = await prepareMaterial({
    materialId,
    userId,
  });

  const extraction = await extractPdfTextFn(processingInput.fileBuffer);

  const normalizedExtraction = normalizeExtractionResultFn(extraction);

  const chunks = chunkTextFn(normalizedExtraction.text, {
    materialId: String(processingInput.materialId),
    userId: String(processingInput.userId),
    pages: normalizedExtraction.pages,
  });

  if (chunks.length === 0) {
    return {
      materialId: String(processingInput.materialId),
      chunkCount: 0,
      vectorCount: 0,
      metadataCount: 0,
    };
  }

  const resolvedEmbedTexts = embedTexts ?? createConfiguredEmbeddingService();

  const resolvedQdrantService = qdrantService ?? createQdrantService();

  const embeddingResult = await resolvedEmbedTexts(
    chunks.map((chunk) => chunk.text),
  );

  const embeddings = embeddingResult?.embeddings;

  if (!Array.isArray(embeddings) || embeddings.length !== chunks.length) {
    throw new Error(
      "Embedding count must match the number of document chunks.",
    );
  }

  const embeddedChunks = chunks.map((chunk, index) => ({
    ...chunk,
    embedding: embeddings[index],
  }));

  const qdrantResult =
    await resolvedQdrantService.persistChunks(embeddedChunks);

  if (
    !Array.isArray(qdrantResult?.pointIds) ||
    qdrantResult.pointIds.length !== chunks.length
  ) {
    throw new Error(
      "Qdrant point ID count must match the number of document chunks.",
    );
  }

  const metadataResult = await persistChunkMetadataFn({
    chunks,
    pointIds: qdrantResult.pointIds,
    materialId: String(processingInput.materialId),
    userId: String(processingInput.userId),
    documentChunkModel,
  });

  return {
    materialId: String(processingInput.materialId),
    chunkCount: chunks.length,
    vectorCount: qdrantResult.persistedCount,
    metadataCount: metadataResult.persistedCount,
  };
};
