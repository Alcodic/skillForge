import mongoose from "mongoose";

const SourceSchema = new mongoose.Schema(
  {
    pageStart: {
      type: Number,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: "Page start must be an integer.",
      },
    },

    pageEnd: {
      type: Number,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: "Page end must be an integer.",
      },
    },
  },
  { _id: false },
);

const DocumentChunkSchema = new mongoose.Schema(
  {
    chunkId: {
      type: String,
      required: true,
      trim: true,
    },

    materialId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "LearningMaterial",
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },

    sequence: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: "Chunk sequence must be an integer.",
      },
    },

    startOffset: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: "Chunk start offset must be an integer.",
      },
    },

    endOffset: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: "Chunk end offset must be an integer.",
      },
    },

    source: {
      type: SourceSchema,
      default: undefined,
    },

    qdrantPointId: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

// Ensure chunk offsets and page ranges are valid.
DocumentChunkSchema.pre("validate", function () {
  if (
    Number.isInteger(this.startOffset) &&
    Number.isInteger(this.endOffset) &&
    this.endOffset < this.startOffset
  ) {
    this.invalidate(
      "endOffset",
      "Chunk end offset must be greater than or equal to start offset.",
    );
  }

  if (
    this.source?.pageStart !== undefined &&
    this.source?.pageEnd !== undefined &&
    this.source.pageEnd < this.source.pageStart
  ) {
    this.invalidate(
      "source.pageEnd",
      "Page end must be greater than or equal to page start.",
    );
  }
});

// Prevent duplicate chunk records and support common retrieval patterns.
DocumentChunkSchema.index({ chunkId: 1 }, { unique: true });

DocumentChunkSchema.index({ materialId: 1, sequence: 1 });

DocumentChunkSchema.index({ userId: 1, materialId: 1 });

const DocumentChunk = mongoose.model("DocumentChunk", DocumentChunkSchema);

export default DocumentChunk;
