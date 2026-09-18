import LearningMaterial from "../../models/LearningMaterial.js";

export const getMaterials = async (req, res) => {
  try {
    const { userId } = req;

    const learningMaterials = await LearningMaterial.find({ userId }).select({
      title: 1,
      originalFileName: 1,
      fileType: 1,
      fileSize: 1,
      processingStatus: 1,
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
