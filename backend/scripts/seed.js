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

    // Create test user (password will be automatically hashed by the User model pre-save hook)
    const testUser = await User.create({
      name: "Test User",
      email: "test@example.com",
      password: "password123",
      authProvider: "local",
    });

    console.log("Test user created successfully:");
    console.log({
      id: testUser._id,
      name: testUser.name,
      email: testUser.email,
      authProvider: testUser.authProvider,
      createdAt: testUser.createdAt,
    });
    console.log("\nLogin credentials:");
    console.log("  Email: test@example.com");
    console.log("  Password: password123");

    // Disconnect
    await mongoose.connection.close();
    console.log("\nDatabase connection closed");
    process.exit(0);
  } catch (error) {
    console.error("Error seeding database:", error);
    process.exit(1);
  }
};

seedUser();
