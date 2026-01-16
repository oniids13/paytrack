import dotenv from "dotenv";
import mongoose from "mongoose";
import User from "../models/User.js";

dotenv.config();

const seedUser = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("MongoDB Connected for seeding...");

    // Clear existing users (optional - comment out if you want to keep existing data)
    await User.deleteMany({});
    console.log("Cleared existing users");

    // Create test user
    const testUser = await User.create({
      name: "Test User",
      email: "test@example.com",
      password: "password123", // In production, you should hash this!
    });

    console.log("✅ Test user created successfully:");
    console.log({
      id: testUser._id,
      name: testUser.name,
      email: testUser.email,
      createdAt: testUser.createdAt,
    });

    // Disconnect
    await mongoose.connection.close();
    console.log("Database connection closed");
    process.exit(0);
  } catch (error) {
    console.error("Error seeding database:", error);
    process.exit(1);
  }
};

seedUser();
