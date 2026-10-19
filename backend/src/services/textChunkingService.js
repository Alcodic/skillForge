import { createHash } from "node:crypto";

const DEFAULT_TARGET_SIZE = 2000;
const DEFAULT_OVERLAP = 300;

// Creates a deterministic SHA-256 hash.
const createHashId = (value) =>
  createHash("sha256").update(value).digest("hex");

// Generates a stable identity for the document being chunked.
const getDocumentIdentity = (text, materialId) => {
  if (materialId !== undefined) {
    if (typeof materialId !== "string" || materialId.trim().length === 0) {
      throw new TypeError("Material ID must be a non-empty string.");
    }

    return `material:${materialId}`;
  }

  // If no material ID is supplied, identify the document by its full content.
  return `content:${createHashId(text)}`;
};

// Builds a chunk and attaches its identity and position.
const createChunk = ({
  text,
  sequence,
  startOffset,
  endOffset,
  documentIdentity,
  materialId,
  userId,
}) => {
  const chunkId = createHashId(
    JSON.stringify({
      documentIdentity,
      sequence,
      startOffset,
      endOffset,
      text,
    }),
  );

  const chunk = {
    chunkId,
    sequence,
    text,
    startOffset,
    endOffset,
  };

  if (materialId !== undefined && userId !== undefined) {
    chunk.materialId = materialId;
    chunk.userId = userId;
  }

  return chunk;
};

const findLastBoundary = (text, minEnd, maxEnd, pattern) => {
  let boundary = null;
  pattern.lastIndex = 0;

  let match;

  while ((match = pattern.exec(text)) !== null) {
    const candidateEnd = match.index + match[0].length;

    if (candidateEnd > maxEnd) {
      break;
    }

    if (candidateEnd >= minEnd) {
      boundary = candidateEnd;
    }
  }

  return boundary;
};

const chunkText = (
  text,
  {
    targetSize = DEFAULT_TARGET_SIZE,
    overlap = DEFAULT_OVERLAP,
    materialId,
    userId,
  } = {},
) => {
  if (typeof text !== "string") {
    throw new TypeError("Text input must be a string.");
  }

  if (!Number.isInteger(targetSize) || targetSize < 2) {
    throw new RangeError("Target size must be an integer of at least 2.");
  }

  if (!Number.isInteger(overlap) || overlap < 0 || overlap >= targetSize / 2) {
    throw new RangeError(
      "Overlap must be a non-negative integer smaller than half the target size.",
    );
  }

  const hasMaterialId = materialId !== undefined;
  const hasUserId = userId !== undefined;

  if (hasMaterialId !== hasUserId) {
    throw new TypeError("Material ID and user ID must be provided together.");
  }

  if (
    hasMaterialId &&
    (typeof materialId !== "string" || materialId.trim().length === 0)
  ) {
    throw new TypeError("Material ID must be a non-empty string.");
  }

  if (hasUserId && (typeof userId !== "string" || userId.trim().length === 0)) {
    throw new TypeError("User ID must be a non-empty string.");
  }

  if (text.length === 0) {
    return [];
  }

  const documentIdentity = getDocumentIdentity(text, materialId);

  if (text.length <= targetSize) {
    return [
      createChunk({
        text,
        sequence: 0,
        startOffset: 0,
        endOffset: text.length,
        documentIdentity,
        materialId,
        userId,
      }),
    ];
  }

  const chunks = [];
  let startOffset = 0;

  while (startOffset < text.length) {
    const hardEnd = Math.min(startOffset + targetSize, text.length);

    if (hardEnd === text.length) {
      chunks.push(
        createChunk({
          text: text.slice(startOffset, hardEnd),
          sequence: chunks.length,
          startOffset,
          endOffset: hardEnd,
          documentIdentity,
          materialId,
          userId,
        }),
      );

      break;
    }

    // Search the latter half of the target window for a good boundary.
    const minEnd = startOffset + Math.floor(targetSize / 2);

    // Priority 1: paragraph boundary.
    let endOffset = findLastBoundary(text, minEnd, hardEnd, /\n{2,}/g);

    // Priority 2: sentence boundary.
    if (endOffset === null) {
      endOffset = findLastBoundary(
        text,
        minEnd,
        hardEnd,
        /[.!?](?:["')\]]*)?(?=\s|$)/g,
      );
    }

    // Priority 3: hard split at the target limit.
    if (endOffset === null) {
      endOffset = hardEnd;
    }

    chunks.push(
      createChunk({
        text: text.slice(startOffset, endOffset),
        sequence: chunks.length,
        startOffset,
        endOffset,
        documentIdentity,
        materialId,
        userId,
      }),
    );

    // Begin the next chunk inside the previous chunk to create overlap.
    startOffset = endOffset - overlap;
  }

  return chunks;
};

export { chunkText };
