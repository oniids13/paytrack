// Set environment variables BEFORE any other imports
// This file runs via setupFiles, which happens before test files are imported
process.env.JWT_SECRET = "test-secret-key-for-testing";
process.env.JWT_EXPIRE = "7d";
process.env.NODE_ENV = "test";
