import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Biller from "../models/Biller.js";

/**
 * Create a test user and return user object with token
 */
export const createTestUser = async (userData = {}) => {
  const defaultUser = {
    name: "Test User",
    email: "test@example.com",
    password: "password123",
    authProvider: "local",
  };

  const user = await User.create({ ...defaultUser, ...userData });
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE,
  });

  return { user, token };
};

/**
 * Create a test biller
 */
export const createTestBiller = async (userId, billerData = {}) => {
  const defaultBiller = {
    user: userId,
    name: "Electric Bill",
    type: "bill",
    amount: 2500,
    dueDate: 15,
    category: "utilities",
  };

  return await Biller.create({ ...defaultBiller, ...billerData });
};

/**
 * Create multiple test billers
 */
export const createTestBillers = async (userId) => {
  const billers = [
    {
      user: userId,
      name: "Electric Bill",
      type: "bill",
      amount: 2500,
      dueDate: 15,
      category: "utilities",
    },
    {
      user: userId,
      name: "Water Bill",
      type: "bill",
      amount: 800,
      dueDate: 18,
      category: "utilities",
    },
    {
      user: userId,
      name: "Internet",
      type: "bill",
      amount: 1699,
      dueDate: 20,
      category: "subscription",
    },
    {
      user: userId,
      name: "BPI Credit Card",
      type: "credit",
      amount: 12500,
      dueDate: 25,
      cutOffDate: 5,
      creditLimit: 50000,
      category: "credit_card",
    },
    {
      user: userId,
      name: "Metrobank Credit Card",
      type: "credit",
      amount: 8200,
      dueDate: 10,
      cutOffDate: 22,
      creditLimit: 30000,
      category: "credit_card",
    },
  ];

  return await Biller.insertMany(billers);
};
