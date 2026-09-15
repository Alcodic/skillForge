import LearningMaterial from "../../models/LearningMaterial.js";

export const dashboardController = async (req, res) => {
  try {
    const { userId } = req;

    const learningMaterials = await LearningMaterial.find({ userId }).select({
      title: 1,
      fileType: 1,
      fileSize: 1,
      processingStatus: 1,
      createdAt: 1,
      updatedAt: 1,
    });

    const dashboardMaterials = learningMaterials.map((material) => {
      return {
        id: material._id,
        title: material.title,
        fileType: material.fileType,
        fileSize: material.fileSize,
        processingStatus: material.processingStatus,
        createdAt: material.createdAt,
        updatedAt: material.updatedAt,
      };
    });

    res.status(200).json({
      success: true,
      data: {
        materials: dashboardMaterials,
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
