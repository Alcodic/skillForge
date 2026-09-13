import User from "../../models/User.js";
import bcrypt from "bcryptjs";

export const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (name && email && password) {
      const existingUser = await User.findOne({
        email: email,
      });

      if (existingUser) {
        res.status(409).json({
          message: "User already exists. Please login with existing email.",
        });
      } else {
        const hashedPassword = await bcrypt.hash(password, 10);

        const user = new User({
          name: name,
          email: email,
          password: hashedPassword,
        });

        await user.save();
        console.log("checking final user stored in DB: ", user._id);
        res.status(201).json({
          message: "User registered successfully",
        });
      }
    } else {
      res.status(400).json({
        message: "Either password or email or name is missing.",
      });
    }
  } catch (error) {
    console.error("Registration error: ", error);
    res.status(500).json({
      message: "Something went wrong. Please try again later.",
    });
  }
};
