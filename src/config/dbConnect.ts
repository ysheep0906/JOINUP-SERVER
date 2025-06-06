import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.DATABASE_URL as string);
  } catch (error) {
    console.log(error);
  }
}

export default connectDB;