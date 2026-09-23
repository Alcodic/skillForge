import crypto from "crypto";

import LearningMaterial from "../../models/LearningMaterial.js";

import { uploadFile, deleteFile } from "../../services/storageService.js";

const isPdfFile = (buffer) => {
  if (!buffer || buffer.length < 5) {
    return false;
  }

  return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
};

export const getMaterials = async (req, res) => {
  try {
    const { userId } = req;

    const learningMaterials = await LearningMaterial.find({ userId }).select({
      title: 1,
      originalFileName: 1,
      fileType: 1,
      fileSize: 1,
      processingStatus: 1,
      idempotencyKey: 1,
      createdAt: 1,
      updatedAt: 1,
    });

    const materials = learningMaterials.map((material) => {
      return {
        id: material._id,
        title: material.title,
        originalFileName: material.originalFileName,
        fileType: material.fileType,
        fileSize: material.fileSize,
        processingStatus: material.processingStatus,
        idempotencyKey: material.idempotencyKey,
        createdAt: material.createdAt,
        updatedAt: material.updatedAt,
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        materials,
      },
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: "something went wrong.",
    });
  }
};

export const getMaterialById = async (req, res) => {
  try {
    const { userId } = req;
    const { id } = req.params;

    const material = await LearningMaterial.findOne({
      _id: id,
      userId,
    }).select(
      "title originalFileName fileType fileSize processingStatus createdAt updatedAt",
    );

    if (!material) {
      return res.status(404).json({
        success: false,
        message: "Material not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        material: {
          id: material._id,
          title: material.title,
          originalFileName: material.originalFileName,
          fileType: material.fileType,
          fileSize: material.fileSize,
          processingStatus: material.processingStatus,
          createdAt: material.createdAt,
          updatedAt: material.updatedAt,
        },
      },
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong.",
    });
  }
};

export const uploadMaterial = async (req, res) => {
  let material = null;
  let objectKey = null;
  let s3UploadCompleted = false;

  try {
    const { userId } = req;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "A file is required.",
      });
    }

    if (!isPdfFile(req.file.buffer)) {
      return res.status(400).json({
        success: false,
        message: "Invalid PDF file.",
      });
    }

    const fileHash = crypto
      .createHash("sha256")
      .update(req.file.buffer)
      .digest("hex");

    const { title } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: "Title is required.",
      });
    }

    const normalizedTitle = title.trim();

    const existingMaterial = await LearningMaterial.findOne({
      userId,
      idempotencyKey: req.idempotencyKey,
    });

    if (existingMaterial) {
      const samePayload =
        existingMaterial.title === normalizedTitle &&
        existingMaterial.fileHash === fileHash;

      if (!samePayload) {
        return res.status(409).json({
          success: false,
          message:
            "This Idempotency-Key has already been used for a different upload.",
        });
      }

      if (
        existingMaterial.processingStatus === "PROCESSING" ||
        existingMaterial.processingStatus === "READY"
      ) {
        return res.status(200).json({
          success: true,
          data: {
            material: {
              id: existingMaterial._id,
              title: existingMaterial.title,
              originalFileName: existingMaterial.originalFileName,
              fileType: existingMaterial.fileType,
              fileSize: existingMaterial.fileSize,
              processingStatus: existingMaterial.processingStatus,
            },
          },
        });
      }

      // FAILED or UPLOADING:
      // retry the existing logical operation.
      material = existingMaterial;

      material.processingStatus = "UPLOADING";
      await material.save();
    }

    // 1. Create MongoDB metadata first
    if (!material) {
      try {
        material = await LearningMaterial.create({
          userId,
          title: normalizedTitle,
          originalFileName: req.file.originalname,
          fileType: req.file.mimetype,
          fileSize: req.file.size,
          storageReference: "PENDING",
          processingStatus: "UPLOADING",
          idempotencyKey: req.idempotencyKey,
          fileHash,
        });
      } catch (error) {
        if (error?.code !== 11000) {
          throw error;
        }

        const concurrentMaterial = await LearningMaterial.findOne({
          userId,
          idempotencyKey: req.idempotencyKey,
        });

        if (!concurrentMaterial) {
          throw error;
        }

        const samePayload =
          concurrentMaterial.title === normalizedTitle &&
          concurrentMaterial.fileHash === fileHash;

        if (!samePayload) {
          return res.status(409).json({
            success: false,
            message:
              "This Idempotency-Key has already been used for a different upload.",
          });
        }

        if (
          concurrentMaterial.processingStatus === "PROCESSING" ||
          concurrentMaterial.processingStatus === "READY"
        ) {
          return res.status(200).json({
            success: true,
            data: {
              material: {
                id: concurrentMaterial._id,
                title: concurrentMaterial.title,
                originalFileName: concurrentMaterial.originalFileName,
                fileType: concurrentMaterial.fileType,
                fileSize: concurrentMaterial.fileSize,
                processingStatus: concurrentMaterial.processingStatus,
              },
            },
          });
        }

        material = concurrentMaterial;
      }
    }

    // 2. Generate application-controlled S3 object key
    if (material.storageReference !== "PENDING") {
      objectKey = material.storageReference;
    } else {
      objectKey = `users/${userId}/materials/${material._id}/original/file`;
    }

    // 3. Upload original file to S3
    await uploadFile({
      fileBuffer: req.file.buffer,
      contentType: req.file.mimetype,
      objectKey,
    });

    s3UploadCompleted = true;

    // 4. Update MongoDB with S3 reference + next lifecycle state
    material.storageReference = objectKey;
    material.processingStatus = "PROCESSING";

    await material.save();

    // 5. Return stable API response
    return res.status(201).json({
      success: true,
      data: {
        material: {
          id: material._id,
          title: material.title,
          originalFileName: material.originalFileName,
          fileType: material.fileType,
          fileSize: material.fileSize,
          processingStatus: material.processingStatus,
        },
      },
    });
  } catch (error) {
    console.error(error);

    // Compensating action:
    // If S3 upload succeeded but a later operation failed,
    // remove the orphaned S3 object.
    if (s3UploadCompleted && objectKey) {
      try {
        await deleteFile({ objectKey });
      } catch (cleanupError) {
        console.error("Failed to clean up S3 object:", cleanupError);
      }
    }

    // Mark material as FAILED when possible.
    if (material) {
      try {
        material.processingStatus = "FAILED";
        await material.save();
      } catch (statusError) {
        console.error(
          "Failed to update material status to FAILED:",
          statusError,
        );
      }
    }

    return res.status(500).json({
      success: false,
      message: "Something went wrong.",
    });
  }
};
