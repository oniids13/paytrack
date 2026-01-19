import request from "supertest";
import app from "./app.js";
import { createTestUser } from "./helpers.js";
import User from "../models/User.js";

describe("Auth API", () => {
  describe("POST /api/auth/register", () => {
    it("should register a new user successfully", async () => {
      const res = await request(app).post("/api/auth/register").send({
        name: "John Doe",
        email: "john@example.com",
        password: "password123",
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.name).toBe("John Doe");
      expect(res.body.user.email).toBe("john@example.com");
    });

    it("should fail if email already exists", async () => {
      await createTestUser({ email: "existing@example.com" });

      const res = await request(app).post("/api/auth/register").send({
        name: "Another User",
        email: "existing@example.com",
        password: "password123",
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("already exists");
    });

    it("should fail if required fields are missing", async () => {
      const res = await request(app).post("/api/auth/register").send({
        email: "test@example.com",
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe("POST /api/auth/login", () => {
    beforeEach(async () => {
      await createTestUser({
        email: "login@example.com",
        password: "password123",
      });
    });

    it("should login successfully with valid credentials", async () => {
      const res = await request(app).post("/api/auth/login").send({
        email: "login@example.com",
        password: "password123",
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.email).toBe("login@example.com");
    });

    it("should fail with invalid password", async () => {
      const res = await request(app).post("/api/auth/login").send({
        email: "login@example.com",
        password: "wrongpassword",
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("should fail with non-existent email", async () => {
      const res = await request(app).post("/api/auth/login").send({
        email: "nonexistent@example.com",
        password: "password123",
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe("GET /api/auth/me", () => {
    it("should return current user when authenticated", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.email).toBe("test@example.com");
    });

    it("should fail without authentication", async () => {
      const res = await request(app).get("/api/auth/me");

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("should fail with invalid token", async () => {
      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", "Bearer invalid-token");

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe("PUT /api/auth/me", () => {
    it("should update user profile", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .put("/api/auth/me")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Updated Name" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.name).toBe("Updated Name");
    });
  });

  describe("PUT /api/auth/password", () => {
    it("should change password successfully", async () => {
      const { token } = await createTestUser({
        email: "password@example.com",
        password: "oldpassword",
      });

      const res = await request(app)
        .put("/api/auth/password")
        .set("Authorization", `Bearer ${token}`)
        .send({
          currentPassword: "oldpassword",
          newPassword: "newpassword123",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify new password works
      const loginRes = await request(app).post("/api/auth/login").send({
        email: "password@example.com",
        password: "newpassword123",
      });

      expect(loginRes.status).toBe(200);
    });

    it("should fail with incorrect current password", async () => {
      const { token } = await createTestUser({ password: "correctpassword" });

      const res = await request(app)
        .put("/api/auth/password")
        .set("Authorization", `Bearer ${token}`)
        .send({
          currentPassword: "wrongpassword",
          newPassword: "newpassword123",
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });
});
