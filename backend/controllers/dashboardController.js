import Biller from "../models/Biller.js";

/**
 * Helper to get current month/year
 */
const getCurrentPeriod = () => {
  const now = new Date();
  return {
    month: now.getMonth() + 1,
    year: now.getFullYear(),
    day: now.getDate(),
  };
};

/**
 * Helper to calculate status for a biller
 */
const calculateStatus = (biller, currentDay, currentMonth, currentYear) => {
  const isPaid = biller.paidMonths?.some(
    (paid) => paid.month === currentMonth && paid.year === currentYear
  );

  if (isPaid) return "paid";
  if (currentDay > biller.dueDate) return "overdue";
  if (biller.dueDate - currentDay <= 7) return "due_soon";
  return "pending";
};

/**
 * @desc    Get dashboard summary (top cards)
 * @route   GET /api/dashboard/summary
 * @access  Private
 */
export const getSummary = async (req, res) => {
  try {
    const { month, year, day } = getCurrentPeriod();
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];

    const billers = await Biller.find({ user: req.user._id, isActive: true });

    let totalDue = 0;
    const upcomingPayments = [];
    let overdueCount = 0;
    const activeCreditCards = [];

    billers.forEach((biller) => {
      const status = calculateStatus(biller, day, month, year);

      // Calculate total due (unpaid billers)
      if (status !== "paid") {
        totalDue += biller.amount;
      }

      // Overdue count
      if (status === "overdue") {
        overdueCount++;
      }

      // Upcoming payments (due within 7 days, not paid)
      if (status === "due_soon" || status === "pending") {
        const daysUntilDue = biller.dueDate - day;
        if (daysUntilDue > 0 && daysUntilDue <= 7) {
          upcomingPayments.push({
            id: biller._id,
            name: biller.name,
            daysUntilDue,
            amount: biller.amount,
          });
        }
      }

      // Active credit cards
      if (biller.type === "credit") {
        activeCreditCards.push({
          id: biller._id,
          name: biller.name,
        });
      }
    });

    // Sort upcoming by days until due
    upcomingPayments.sort((a, b) => a.daysUntilDue - b.daysUntilDue);

    res.status(200).json({
      success: true,
      data: {
        totalDue,
        month: monthNames[month - 1],
        year,
        upcomingPayments: upcomingPayments.slice(0, 5), // Top 5
        overdueCount,
        activeCreditCards,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching dashboard summary",
      error: error.message,
    });
  }
};

/**
 * @desc    Get upcoming due dates data for chart
 * @route   GET /api/dashboard/upcoming
 * @access  Private
 */
export const getUpcoming = async (req, res) => {
  try {
    const { month, year, day } = getCurrentPeriod();

    const billers = await Biller.find({ user: req.user._id, isActive: true });

    let totalAmount = 0;
    let billsCount = 0;
    let creditCardsCount = 0;
    const chartData = {};

    billers.forEach((biller) => {
      const status = calculateStatus(biller, day, month, year);

      if (status !== "paid") {
        totalAmount += biller.amount;

        if (biller.type === "bill") {
          billsCount++;
        } else {
          creditCardsCount++;
        }

        // Group by due date for chart
        const dateKey = `${month.toString().padStart(2, "0")}/${biller.dueDate.toString().padStart(2, "0")}`;
        if (!chartData[dateKey]) {
          chartData[dateKey] = { date: dateKey, bills: 0, credit: 0 };
        }

        if (biller.type === "bill") {
          chartData[dateKey].bills += biller.amount;
        } else {
          chartData[dateKey].credit += biller.amount;
        }
      }
    });

    // Convert to array and sort by date
    const chartArray = Object.values(chartData).sort((a, b) => {
      const [aMonth, aDay] = a.date.split("/").map(Number);
      const [bMonth, bDay] = b.date.split("/").map(Number);
      return aDay - bDay;
    });

    res.status(200).json({
      success: true,
      data: {
        totalAmount,
        billsCount,
        creditCardsCount,
        chartData: chartArray,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching upcoming data",
      error: error.message,
    });
  }
};

/**
 * @desc    Get monthly spending overview by type
 * @route   GET /api/dashboard/monthly-overview
 * @access  Private
 */
export const getMonthlyOverview = async (req, res) => {
  try {
    const targetYear = parseInt(req.query.year) || new Date().getFullYear();
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    const billers = await Biller.find({ user: req.user._id });

    // Initialize monthly data
    const monthlyData = monthNames.map((month) => ({
      month,
      bills: 0,
      credit: 0,
    }));

    // Calculate spending based on paid months
    billers.forEach((biller) => {
      biller.paidMonths.forEach((paid) => {
        if (paid.year === targetYear) {
          const monthIndex = paid.month - 1;
          if (biller.type === "bill") {
            monthlyData[monthIndex].bills += biller.amount;
          } else {
            monthlyData[monthIndex].credit += biller.amount;
          }
        }
      });
    });

    res.status(200).json({
      success: true,
      data: {
        year: targetYear,
        monthlyData,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching monthly overview",
      error: error.message,
    });
  }
};

/**
 * @desc    Get bill status breakdown for pie chart
 * @route   GET /api/dashboard/status
 * @access  Private
 */
export const getStatusBreakdown = async (req, res) => {
  try {
    const { month, year, day } = getCurrentPeriod();

    const billers = await Biller.find({ user: req.user._id, isActive: true });

    const statusData = {
      paid: { count: 0, amount: 0 },
      due_soon: { count: 0, amount: 0 },
      overdue: { count: 0, amount: 0 },
      pending: { count: 0, amount: 0 },
    };

    let totalAmount = 0;

    billers.forEach((biller) => {
      const status = calculateStatus(biller, day, month, year);
      statusData[status].count++;
      statusData[status].amount += biller.amount;
      totalAmount += biller.amount;
    });

    res.status(200).json({
      success: true,
      data: {
        totalAmount,
        paid: statusData.paid,
        dueSoon: statusData.due_soon,
        overdue: statusData.overdue,
        pending: statusData.pending,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching status breakdown",
      error: error.message,
    });
  }
};

/**
 * @desc    Get credit card cycle tracker
 * @route   GET /api/dashboard/credit-cycle
 * @access  Private
 */
export const getCreditCycle = async (req, res) => {
  try {
    const { day } = getCurrentPeriod();

    const creditCards = await Biller.find({
      user: req.user._id,
      type: "credit",
      isActive: true,
    });

    const cards = creditCards.map((card) => {
      let daysRemaining = card.dueDate - day;

      // If due date has passed, calculate days until next month's due date
      if (daysRemaining < 0) {
        const daysInMonth = new Date(
          new Date().getFullYear(),
          new Date().getMonth() + 1,
          0
        ).getDate();
        daysRemaining = daysInMonth - day + card.dueDate;
      }

      return {
        id: card._id,
        name: card.name,
        daysRemaining,
        dueDate: card.dueDate,
        cutOffDate: card.cutOffDate,
        creditLimit: card.creditLimit,
        amount: card.amount,
      };
    });

    // Sort by days remaining
    cards.sort((a, b) => a.daysRemaining - b.daysRemaining);

    res.status(200).json({
      success: true,
      data: {
        cards,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching credit cycle data",
      error: error.message,
    });
  }
};

/**
 * @desc    Get payment history for line chart
 * @route   GET /api/dashboard/payment-history
 * @access  Private
 */
export const getPaymentHistory = async (req, res) => {
  try {
    const targetYear = parseInt(req.query.year) || new Date().getFullYear();
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    const billers = await Biller.find({ user: req.user._id });

    // Initialize monthly totals
    const monthlyTotals = monthNames.map((month) => ({
      month,
      amount: 0,
    }));

    let totalThisYear = 0;

    // Sum up payments by month
    billers.forEach((biller) => {
      biller.paidMonths.forEach((paid) => {
        if (paid.year === targetYear) {
          const monthIndex = paid.month - 1;
          monthlyTotals[monthIndex].amount += biller.amount;
          totalThisYear += biller.amount;
        }
      });
    });

    res.status(200).json({
      success: true,
      data: {
        year: targetYear,
        totalThisYear,
        monthlyData: monthlyTotals,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching payment history",
      error: error.message,
    });
  }
};

/**
 * @desc    Get bills and credit card overview (table data)
 * @route   GET /api/dashboard/overview
 * @access  Private
 */
export const getBillersOverview = async (req, res) => {
  try {
    const { month, year, day } = getCurrentPeriod();
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];

    const billers = await Biller.find({ user: req.user._id, isActive: true }).sort({
      dueDate: 1,
    });

    const overview = billers.map((biller) => {
      const status = calculateStatus(biller, day, month, year);

      // Format due date
      const dueDate = new Date(year, month - 1, biller.dueDate);
      const formattedDueDate = `${monthNames[month - 1].slice(0, 3)} ${biller.dueDate}, ${year}`;

      return {
        id: biller._id,
        name: biller.name,
        type: biller.type === "credit" ? "Credit Card" : "Bill",
        dueDate: formattedDueDate,
        rawDueDate: biller.dueDate,
        amount: biller.amount,
        status,
        category: biller.category,
      };
    });

    res.status(200).json({
      success: true,
      data: {
        billers: overview,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching billers overview",
      error: error.message,
    });
  }
};
