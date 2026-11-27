import materialAccessService from "../../services/materialAccessService.js";
import readerContentService from "../../services/readerContentService.js";

export const createReaderController = ({
  materialAccessServiceInstance = materialAccessService,
  readerContentServiceInstance = readerContentService,
} = {}) => {
  return async (req, res) => {
    try {
      const { id: materialId } = req.params;
      const { userId } = req;
      const { limit: rawLimit, afterSequence: rawAfterSequence } = req.query;

      // 1. Parse pagination parameters strictly.
      const limit =
        rawLimit === undefined
          ? 20
          : typeof rawLimit === "string"
            ? Number(rawLimit)
            : NaN;

      const afterSequence =
        rawAfterSequence === undefined
          ? undefined
          : typeof rawAfterSequence === "string"
            ? Number(rawAfterSequence)
            : NaN;

      if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
        return res.status(400).json({
          success: false,
          message: "Limit must be an integer between 1 and 50.",
        });
      }

      if (
        afterSequence !== undefined &&
        (!Number.isInteger(afterSequence) || afterSequence < 0)
      ) {
        return res.status(400).json({
          success: false,
          message: "afterSequence must be a non-negative integer.",
        });
      }

      // 2. Verify ownership and material readiness.
      await materialAccessServiceInstance.getReadyMaterial({
        materialId,
        userId,
      });

      // 3. Retrieve the requested reader page.
      const readerContent = await readerContentServiceInstance.getReaderContent(
        {
          materialId,
          userId,
          limit,
          afterSequence,
        },
      );

      // 4. Return the reader content.
      return res.status(200).json({
        success: true,
        data: readerContent,
      });
    } catch (error) {
      console.error("Reader content request failed:", error);

      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.statusCode ? error.message : "Something went wrong.",
      });
    }
  };
};

export const getReaderContent = createReaderController();
