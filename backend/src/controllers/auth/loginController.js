import User from "../../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Either email or password is missing",
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        message:
          "User does not exists. Please register by clicking on register button.",
      });
    }

    //comparing password
    const isPasswordCorrect = await bcrypt.compare(password, user.password);

    if (!isPasswordCorrect) {
      return res.status(401).json({
        message: "Password is incorrect. Please enter correct password.",
      });
    }

    //Generate JWT
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET_DEV, {
      expiresIn: "1h",
    });

    return res.json({
      message: "Successfully logged in",
      token,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Something went wrong. Please try again later.",
    });
  }
};
