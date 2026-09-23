export const idempotencyMiddleware = (req, res, next) => {
  const idempotencyKey = req.get("Idempotency-Key");

  if (!idempotencyKey) {
    return res.status(400).json({
      success: false,
      message: "Idempotency-Key header is required.",
    });
  }

  if (idempotencyKey.length > 128) {
    return res.status(400).json({
      success: false,
      message: "Idempotency-Key must not exceed 128 characters.",
    });
  }

  req.idempotencyKey = idempotencyKey.trim();

  next();
};
