import request from "supertest";
import app from "./app.js";
import { createTestUser, createTestBiller, createTestBillers } from "./helpers.js";
import Biller from "../models/Biller.js";

describe("Billers API", () => {
  let token;
  let userId;

  beforeEach(async () => {
    const testUser = await createTestUser();
    token = testUser.token;
    userId = testUser.user._id;
  });

  describe("GET /api/billers", () => {
    it("should return empty array when no billers exist", async () => {
      const res = await request(app)
        .get("/api/billers")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.billers).toEqual([]);
      expect(res.body.count).toBe(0);
    });

    it("should return all billers for the user", async () => {
      await createTestBillers(userId);

      const res = await request(app)
        .get("/api/billers")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(5);
      expect(res.body.billers).toHaveLength(5);
    });

    it("should filter billers by type", async () => {
      await createTestBillers(userId);

      const res = await request(app)
        .get("/api/billers?type=credit")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.billers).toHaveLength(2);
      expect(res.body.billers.every((b) => b.type === "credit")).toBe(true);
    });

    it("should filter billers by category", async () => {
      await createTestBillers(userId);

      const res = await request(app)
        .get("/api/billers?category=utilities")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.billers).toHaveLength(2);
    });

    it("should include computed status for each biller", async () => {
      await createTestBiller(userId);

      const res = await request(app)
        .get("/api/billers")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.billers[0].status).toBeDefined();
      expect(["paid", "due_soon", "overdue", "pending"]).toContain(
        res.body.billers[0].status
      );
    });

    it("should fail without authentication", async () => {
      const res = await request(app).get("/api/billers");

      expect(res.status).toBe(401);
    });

    it("should not return billers from other users", async () => {
      // Create biller for current user
      await createTestBiller(userId);

      // Create another user and their biller
      const { user: otherUser } = await createTestUser({
        email: "other@example.com",
      });
      await createTestBiller(otherUser._id, { name: "Other User Bill" });

      const res = await request(app)
        .get("/api/billers")
        .set("Authorization", `Bearer ${token}`);

      expect(res.body.count).toBe(1);
      expect(res.body.billers[0].name).toBe("Electric Bill");
    });
  });

  describe("POST /api/billers", () => {
    it("should create a new bill type biller", async () => {
      const res = await request(app)
        .post("/api/billers")
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Netflix",
          type: "bill",
          amount: 549,
          dueDate: 20,
          category: "subscription",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.biller.name).toBe("Netflix");
      expect(res.body.biller.type).toBe("bill");
      expect(res.body.biller.amount).toBe(549);
    });

    it("should create a new credit type biller with cutOffDate", async () => {
      const res = await request(app)
        .post("/api/billers")
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Visa Gold",
          type: "credit",
          amount: 15000,
          dueDate: 25,
          cutOffDate: 5,
          creditLimit: 100000,
          category: "credit_card",
        });

      expect(res.status).toBe(201);
      expect(res.body.biller.type).toBe("credit");
      expect(res.body.biller.cutOffDate).toBe(5);
      expect(res.body.biller.creditLimit).toBe(100000);
    });

    it("should fail when creating credit type without cutOffDate", async () => {
      const res = await request(app)
        .post("/api/billers")
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Credit Card",
          type: "credit",
          amount: 5000,
          dueDate: 15,
          // cutOffDate missing
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("Cut-off date");
    });

    it("should fail with invalid dueDate", async () => {
      const res = await request(app)
        .post("/api/billers")
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Invalid Bill",
          type: "bill",
          amount: 1000,
          dueDate: 35, // Invalid
        });

      expect(res.status).toBe(400);
    });

    it("should fail with missing required fields", async () => {
      const res = await request(app)
        .post("/api/billers")
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Incomplete Bill",
        });

      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/billers/:id", () => {
    it("should return a specific biller", async () => {
      const biller = await createTestBiller(userId);

      const res = await request(app)
        .get(`/api/billers/${biller._id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.biller.name).toBe("Electric Bill");
    });

    it("should return 404 for non-existent biller", async () => {
      const fakeId = "507f1f77bcf86cd799439011";

      const res = await request(app)
        .get(`/api/billers/${fakeId}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
    });

    it("should not return another user's biller", async () => {
      const { user: otherUser } = await createTestUser({
        email: "other@example.com",
      });
      const otherBiller = await createTestBiller(otherUser._id);

      const res = await request(app)
        .get(`/api/billers/${otherBiller._id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  describe("PUT /api/billers/:id", () => {
    it("should update a biller", async () => {
      const biller = await createTestBiller(userId);

      const res = await request(app)
        .put(`/api/billers/${biller._id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Updated Electric Bill",
          amount: 3000,
        });

      expect(res.status).toBe(200);
      expect(res.body.biller.name).toBe("Updated Electric Bill");
      expect(res.body.biller.amount).toBe(3000);
    });

    it("should update isActive status", async () => {
      const biller = await createTestBiller(userId);

      const res = await request(app)
        .put(`/api/billers/${biller._id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ isActive: false });

      expect(res.status).toBe(200);
      expect(res.body.biller.isActive).toBe(false);
    });

    it("should return 404 for non-existent biller", async () => {
      const fakeId = "507f1f77bcf86cd799439011";

      const res = await request(app)
        .put(`/api/billers/${fakeId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Updated" });

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/billers/:id", () => {
    it("should delete a biller", async () => {
      const biller = await createTestBiller(userId);

      const res = await request(app)
        .delete(`/api/billers/${biller._id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify deletion
      const deleted = await Biller.findById(biller._id);
      expect(deleted).toBeNull();
    });

    it("should return 404 for non-existent biller", async () => {
      const fakeId = "507f1f77bcf86cd799439011";

      const res = await request(app)
        .delete(`/api/billers/${fakeId}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /api/billers/:id/pay", () => {
    it("should mark biller as paid for current month", async () => {
      const biller = await createTestBiller(userId);

      const res = await request(app)
        .patch(`/api/billers/${biller._id}/pay`)
        .set("Authorization", `Bearer ${token}`);

      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.biller.paidMonths).toHaveLength(1);
      expect(res.body.biller.paidMonths[0].month).toBe(currentMonth);
      expect(res.body.biller.paidMonths[0].year).toBe(currentYear);
    });

    it("should mark biller as paid for specific month", async () => {
      const biller = await createTestBiller(userId);

      const res = await request(app)
        .patch(`/api/billers/${biller._id}/pay`)
        .set("Authorization", `Bearer ${token}`)
        .send({ month: 6, year: 2025 });

      expect(res.status).toBe(200);
      expect(res.body.biller.paidMonths[0].month).toBe(6);
      expect(res.body.biller.paidMonths[0].year).toBe(2025);
    });

    it("should fail if already paid for the month", async () => {
      const biller = await createTestBiller(userId);

      // First payment
      await request(app)
        .patch(`/api/billers/${biller._id}/pay`)
        .set("Authorization", `Bearer ${token}`);

      // Second payment attempt
      const res = await request(app)
        .patch(`/api/billers/${biller._id}/pay`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("already marked as paid");
    });

    it("should update status to paid after marking", async () => {
      const biller = await createTestBiller(userId);

      const res = await request(app)
        .patch(`/api/billers/${biller._id}/pay`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.body.biller.status).toBe("paid");
    });
  });

  describe("PATCH /api/billers/:id/unpay", () => {
    it("should unmark payment for current month", async () => {
      const biller = await createTestBiller(userId);

      // First mark as paid
      await request(app)
        .patch(`/api/billers/${biller._id}/pay`)
        .set("Authorization", `Bearer ${token}`);

      // Then unmark
      const res = await request(app)
        .patch(`/api/billers/${biller._id}/unpay`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.biller.paidMonths).toHaveLength(0);
    });

    it("should fail if not paid for the month", async () => {
      const biller = await createTestBiller(userId);

      const res = await request(app)
        .patch(`/api/billers/${biller._id}/unpay`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("No payment record found");
    });

    it("should unmark specific month payment", async () => {
      const biller = await createTestBiller(userId);

      // Mark multiple months as paid
      await request(app)
        .patch(`/api/billers/${biller._id}/pay`)
        .set("Authorization", `Bearer ${token}`)
        .send({ month: 1, year: 2026 });

      await request(app)
        .patch(`/api/billers/${biller._id}/pay`)
        .set("Authorization", `Bearer ${token}`)
        .send({ month: 2, year: 2026 });

      // Unmark January
      const res = await request(app)
        .patch(`/api/billers/${biller._id}/unpay`)
        .set("Authorization", `Bearer ${token}`)
        .send({ month: 1, year: 2026 });

      expect(res.status).toBe(200);
      expect(res.body.biller.paidMonths).toHaveLength(1);
      expect(res.body.biller.paidMonths[0].month).toBe(2);
    });
  });
});
