import User from "../../models/User.js";

export const profileController = async (req, res) => {
  try {
    const { userId } = req;

    const userProfile = await User.findById(userId);

    if (!userProfile) {
      return res.status(404).json({
        message: "User no longer exists.",
      });
    }

    res.status(200).json({
      name: userProfile.name,
      email: userProfile.email,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Something went wrong.",
    });
  }
};
