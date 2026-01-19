import request from "supertest";
import app from "./app.js";
import { createTestUser, createTestBillers } from "./helpers.js";
import Biller from "../models/Biller.js";

describe("Dashboard API", () => {
  let token;
  let userId;

  beforeEach(async () => {
    const testUser = await createTestUser();
    token = testUser.token;
    userId = testUser.user._id;
  });

  describe("GET /api/dashboard/summary", () => {
    it("should return summary with zero values when no billers", async () => {
      const res = await request(app)
        .get("/api/dashboard/summary")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalDue).toBe(0);
      expect(res.body.data.overdueCount).toBe(0);
      expect(res.body.data.upcomingPayments).toEqual([]);
      expect(res.body.data.activeCreditCards).toEqual([]);
    });

    it("should return correct summary with billers", async () => {
      await createTestBillers(userId);

      const res = await request(app)
        .get("/api/dashboard/summary")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.totalDue).toBeGreaterThan(0);
      expect(res.body.data.month).toBeDefined();
      expect(res.body.data.year).toBeDefined();
      expect(res.body.data.activeCreditCards).toHaveLength(2);
    });

    it("should exclude paid billers from totalDue", async () => {
      const billers = await createTestBillers(userId);
      const now = new Date();

      // Mark first biller as paid
      await Biller.findByIdAndUpdate(billers[0]._id, {
        $push: {
          paidMonths: {
            month: now.getMonth() + 1,
            year: now.getFullYear(),
            paidAt: now,
          },
        },
      });

      const res = await request(app)
        .get("/api/dashboard/summary")
        .set("Authorization", `Bearer ${token}`);

      // Total should exclude the paid biller's amount
      const expectedTotal =
        billers[1].amount +
        billers[2].amount +
        billers[3].amount +
        billers[4].amount;
      expect(res.body.data.totalDue).toBe(expectedTotal);
    });

    it("should fail without authentication", async () => {
      const res = await request(app).get("/api/dashboard/summary");
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/dashboard/upcoming", () => {
    it("should return upcoming due dates data", async () => {
      await createTestBillers(userId);

      const res = await request(app)
        .get("/api/dashboard/upcoming")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.totalAmount).toBeDefined();
      expect(res.body.data.billsCount).toBeDefined();
      expect(res.body.data.creditCardsCount).toBeDefined();
      expect(res.body.data.chartData).toBeDefined();
    });

    it("should return correct counts by type", async () => {
      await createTestBillers(userId);

      const res = await request(app)
        .get("/api/dashboard/upcoming")
        .set("Authorization", `Bearer ${token}`);

      expect(res.body.data.billsCount).toBe(3); // 3 bills
      expect(res.body.data.creditCardsCount).toBe(2); // 2 credit cards
    });
  });

  describe("GET /api/dashboard/monthly-overview", () => {
    it("should return monthly data for the year", async () => {
      const res = await request(app)
        .get("/api/dashboard/monthly-overview")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.monthlyData).toHaveLength(12);
      expect(res.body.data.monthlyData[0].month).toBe("Jan");
    });

    it("should return spending based on paid months", async () => {
      const billers = await createTestBillers(userId);

      // Mark a biller as paid for January 2026
      await Biller.findByIdAndUpdate(billers[0]._id, {
        $push: {
          paidMonths: {
            month: 1,
            year: 2026,
            paidAt: new Date(),
          },
        },
      });

      const res = await request(app)
        .get("/api/dashboard/monthly-overview?year=2026")
        .set("Authorization", `Bearer ${token}`);

      expect(res.body.data.year).toBe(2026);
      expect(res.body.data.monthlyData[0].bills).toBe(billers[0].amount);
    });

    it("should accept year query parameter", async () => {
      const res = await request(app)
        .get("/api/dashboard/monthly-overview?year=2025")
        .set("Authorization", `Bearer ${token}`);

      expect(res.body.data.year).toBe(2025);
    });
  });

  describe("GET /api/dashboard/status", () => {
    it("should return status breakdown", async () => {
      await createTestBillers(userId);

      const res = await request(app)
        .get("/api/dashboard/status")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.totalAmount).toBeDefined();
      expect(res.body.data.paid).toBeDefined();
      expect(res.body.data.dueSoon).toBeDefined();
      expect(res.body.data.overdue).toBeDefined();
      expect(res.body.data.pending).toBeDefined();
    });

    it("should have correct structure for status data", async () => {
      await createTestBillers(userId);

      const res = await request(app)
        .get("/api/dashboard/status")
        .set("Authorization", `Bearer ${token}`);

      expect(res.body.data.paid).toHaveProperty("count");
      expect(res.body.data.paid).toHaveProperty("amount");
      expect(res.body.data.dueSoon).toHaveProperty("count");
      expect(res.body.data.dueSoon).toHaveProperty("amount");
    });

    it("should reflect paid status correctly", async () => {
      const billers = await createTestBillers(userId);
      const now = new Date();

      // Mark all billers as paid
      for (const biller of billers) {
        await Biller.findByIdAndUpdate(biller._id, {
          $push: {
            paidMonths: {
              month: now.getMonth() + 1,
              year: now.getFullYear(),
              paidAt: now,
            },
          },
        });
      }

      const res = await request(app)
        .get("/api/dashboard/status")
        .set("Authorization", `Bearer ${token}`);

      expect(res.body.data.paid.count).toBe(5);
      expect(res.body.data.dueSoon.count).toBe(0);
      expect(res.body.data.overdue.count).toBe(0);
    });
  });

  describe("GET /api/dashboard/credit-cycle", () => {
    it("should return credit card cycle data", async () => {
      await createTestBillers(userId);

      const res = await request(app)
        .get("/api/dashboard/credit-cycle")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.cards).toBeDefined();
      expect(res.body.data.cards).toHaveLength(2); // 2 credit cards
    });

    it("should include required fields for each card", async () => {
      await createTestBillers(userId);

      const res = await request(app)
        .get("/api/dashboard/credit-cycle")
        .set("Authorization", `Bearer ${token}`);

      const card = res.body.data.cards[0];
      expect(card).toHaveProperty("id");
      expect(card).toHaveProperty("name");
      expect(card).toHaveProperty("daysRemaining");
      expect(card).toHaveProperty("dueDate");
      expect(card).toHaveProperty("cutOffDate");
    });

    it("should sort by days remaining", async () => {
      await createTestBillers(userId);

      const res = await request(app)
        .get("/api/dashboard/credit-cycle")
        .set("Authorization", `Bearer ${token}`);

      const cards = res.body.data.cards;
      if (cards.length >= 2) {
        expect(cards[0].daysRemaining).toBeLessThanOrEqual(cards[1].daysRemaining);
      }
    });

    it("should return empty array when no credit cards", async () => {
      // Create only bill type billers
      await Biller.create({
        user: userId,
        name: "Electric",
        type: "bill",
        amount: 1000,
        dueDate: 15,
      });

      const res = await request(app)
        .get("/api/dashboard/credit-cycle")
        .set("Authorization", `Bearer ${token}`);

      expect(res.body.data.cards).toHaveLength(0);
    });
  });

  describe("GET /api/dashboard/payment-history", () => {
    it("should return payment history for the year", async () => {
      const res = await request(app)
        .get("/api/dashboard/payment-history")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.totalThisYear).toBeDefined();
      expect(res.body.data.monthlyData).toHaveLength(12);
    });

    it("should calculate totals from paid months", async () => {
      const billers = await createTestBillers(userId);

      // Mark billers as paid for different months
      await Biller.findByIdAndUpdate(billers[0]._id, {
        $push: {
          paidMonths: [
            { month: 1, year: 2026, paidAt: new Date() },
            { month: 2, year: 2026, paidAt: new Date() },
          ],
        },
      });

      const res = await request(app)
        .get("/api/dashboard/payment-history?year=2026")
        .set("Authorization", `Bearer ${token}`);

      expect(res.body.data.totalThisYear).toBe(billers[0].amount * 2);
      expect(res.body.data.monthlyData[0].amount).toBe(billers[0].amount); // January
      expect(res.body.data.monthlyData[1].amount).toBe(billers[0].amount); // February
    });

    it("should accept year query parameter", async () => {
      const res = await request(app)
        .get("/api/dashboard/payment-history?year=2025")
        .set("Authorization", `Bearer ${token}`);

      expect(res.body.data.year).toBe(2025);
    });
  });

  describe("GET /api/dashboard/overview", () => {
    it("should return billers overview for table", async () => {
      await createTestBillers(userId);

      const res = await request(app)
        .get("/api/dashboard/overview")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.billers).toBeDefined();
      expect(res.body.data.billers).toHaveLength(5);
    });

    it("should include required fields for table display", async () => {
      await createTestBillers(userId);

      const res = await request(app)
        .get("/api/dashboard/overview")
        .set("Authorization", `Bearer ${token}`);

      const biller = res.body.data.billers[0];
      expect(biller).toHaveProperty("id");
      expect(biller).toHaveProperty("name");
      expect(biller).toHaveProperty("type");
      expect(biller).toHaveProperty("dueDate");
      expect(biller).toHaveProperty("amount");
      expect(biller).toHaveProperty("status");
    });

    it("should format type as human readable", async () => {
      await createTestBillers(userId);

      const res = await request(app)
        .get("/api/dashboard/overview")
        .set("Authorization", `Bearer ${token}`);

      const creditCard = res.body.data.billers.find(
        (b) => b.type === "Credit Card"
      );
      const bill = res.body.data.billers.find((b) => b.type === "Bill");

      expect(creditCard).toBeDefined();
      expect(bill).toBeDefined();
    });

    it("should sort by due date", async () => {
      await createTestBillers(userId);

      const res = await request(app)
        .get("/api/dashboard/overview")
        .set("Authorization", `Bearer ${token}`);

      const billers = res.body.data.billers;
      for (let i = 1; i < billers.length; i++) {
        expect(billers[i].rawDueDate).toBeGreaterThanOrEqual(
          billers[i - 1].rawDueDate
        );
      }
    });
  });

  describe("Authentication checks", () => {
    const endpoints = [
      "/api/dashboard/summary",
      "/api/dashboard/upcoming",
      "/api/dashboard/monthly-overview",
      "/api/dashboard/status",
      "/api/dashboard/credit-cycle",
      "/api/dashboard/payment-history",
      "/api/dashboard/overview",
    ];

    endpoints.forEach((endpoint) => {
      it(`${endpoint} should require authentication`, async () => {
        const res = await request(app).get(endpoint);
        expect(res.status).toBe(401);
      });
    });
  });
});
