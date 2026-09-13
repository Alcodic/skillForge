import mongoose from "mongoose";

const userSchema = mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
});

// mongoose.model(modelName, schema)
// const User: This is the JavaScript variable that holds the Mongoose Model.
// Mongoose uses this model name internally and, by default, derives the MongoDB collection name from it in lowercase and plural form , for e.g - users

const User = mongoose.model("User", userSchema);

export default User;
