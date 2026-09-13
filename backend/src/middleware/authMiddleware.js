import jwt from "jsonwebtoken";

export const authMiddleware = (req, res, next) => {
  try {
    //1) extract Header from request
    const authHeader = req.headers.authorization;
    console.log("checking authHeader: ", authHeader);

    if (!authHeader) {
      return res.status(401).json({
        message: "Authorization header is missing",
      });
    }
   //2) extract token from Header
    const token = authHeader.split(" ")[1];
   

    //3) Verify extracted token and store in decoded object
    const decoded = jwt.verify(token, process.env.JWT_SECRET_DEV);
    
    //4) Extract userId from decoded object
    const userId = decoded.userId;

    //5) put that userId into request which we are going to send through this auth middleware
    req.userId = userId;

  
  } catch(error) {
    return res.status(401).json({
      message: "Invalid or expired token",
    });
  }
 
  // 6) Moving to next route or step or middleware
  next();
};
