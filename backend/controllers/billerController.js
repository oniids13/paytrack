import Biller from "../models/Biller.js";

/**
 * @desc    Get all billers for authenticated user
 * @route   GET /api/billers
 * @access  Private
 */
export const getBillers = async (req, res) => {
  try {
    const { type, category, isActive } = req.query;

    // Build filter
    const filter = { user: req.user._id };
    if (type) filter.type = type;
    if (category) filter.category = category;
    if (isActive !== undefined) filter.isActive = isActive === "true";

    const billers = await Biller.find(filter).sort({ dueDate: 1 });

    // Add computed status to each biller
    const billersWithStatus = billers.map((biller) => Biller.withStatus(biller));

    res.status(200).json({
      success: true,
      count: billersWithStatus.length,
      billers: billersWithStatus,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching billers",
      error: error.message,
    });
  }
};

/**
 * @desc    Get a single biller
 * @route   GET /api/billers/:id
 * @access  Private
 */
export const getBiller = async (req, res) => {
  try {
    const biller = await Biller.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!biller) {
      return res.status(404).json({
        success: false,
        message: "Biller not found",
      });
    }

    res.status(200).json({
      success: true,
      biller: Biller.withStatus(biller),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching biller",
      error: error.message,
    });
  }
};

/**
 * @desc    Create a new biller
 * @route   POST /api/billers
 * @access  Private
 */
export const createBiller = async (req, res) => {
  try {
    const { name, type, amount, dueDate, cutOffDate, creditLimit, category, notes } =
      req.body;

    const biller = await Biller.create({
      user: req.user._id,
      name,
      type,
      amount,
      dueDate,
      cutOffDate,
      creditLimit,
      category,
      notes,
    });

    res.status(201).json({
      success: true,
      biller: Biller.withStatus(biller),
    });
  } catch (error) {
    // Handle validation errors
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: messages.join(", "),
      });
    }

    res.status(500).json({
      success: false,
      message: "Error creating biller",
      error: error.message,
    });
  }
};

/**
 * @desc    Update a biller
 * @route   PUT /api/billers/:id
 * @access  Private
 */
export const updateBiller = async (req, res) => {
  try {
    const { name, type, amount, dueDate, cutOffDate, creditLimit, category, notes, isActive } =
      req.body;

    const biller = await Biller.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!biller) {
      return res.status(404).json({
        success: false,
        message: "Biller not found",
      });
    }

    // Update fields if provided
    if (name !== undefined) biller.name = name;
    if (type !== undefined) biller.type = type;
    if (amount !== undefined) biller.amount = amount;
    if (dueDate !== undefined) biller.dueDate = dueDate;
    if (cutOffDate !== undefined) biller.cutOffDate = cutOffDate;
    if (creditLimit !== undefined) biller.creditLimit = creditLimit;
    if (category !== undefined) biller.category = category;
    if (notes !== undefined) biller.notes = notes;
    if (isActive !== undefined) biller.isActive = isActive;

    await biller.save();

    res.status(200).json({
      success: true,
      biller: Biller.withStatus(biller),
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: messages.join(", "),
      });
    }

    res.status(500).json({
      success: false,
      message: "Error updating biller",
      error: error.message,
    });
  }
};

/**
 * @desc    Delete a biller
 * @route   DELETE /api/billers/:id
 * @access  Private
 */
export const deleteBiller = async (req, res) => {
  try {
    const biller = await Biller.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!biller) {
      return res.status(404).json({
        success: false,
        message: "Biller not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Biller deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting biller",
      error: error.message,
    });
  }
};

/**
 * @desc    Mark biller as paid for current month
 * @route   PATCH /api/billers/:id/pay
 * @access  Private
 */
export const markAsPaid = async (req, res) => {
  try {
    const { month, year } = req.body;

    const now = new Date();
    const targetMonth = month || now.getMonth() + 1;
    const targetYear = year || now.getFullYear();

    const biller = await Biller.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!biller) {
      return res.status(404).json({
        success: false,
        message: "Biller not found",
      });
    }

    // Check if already paid for this month
    const alreadyPaid = biller.isPaidForMonth(targetMonth, targetYear);

    if (alreadyPaid) {
      return res.status(400).json({
        success: false,
        message: `Biller already marked as paid for ${targetMonth}/${targetYear}`,
      });
    }

    // Add to paidMonths
    biller.paidMonths.push({
      month: targetMonth,
      year: targetYear,
      paidAt: new Date(),
    });

    await biller.save();

    res.status(200).json({
      success: true,
      message: `Biller marked as paid for ${targetMonth}/${targetYear}`,
      biller: Biller.withStatus(biller),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error marking biller as paid",
      error: error.message,
    });
  }
};

/**
 * @desc    Unmark payment for current month
 * @route   PATCH /api/billers/:id/unpay
 * @access  Private
 */
export const markAsUnpaid = async (req, res) => {
  try {
    const { month, year } = req.body;

    const now = new Date();
    const targetMonth = month || now.getMonth() + 1;
    const targetYear = year || now.getFullYear();

    const biller = await Biller.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!biller) {
      return res.status(404).json({
        success: false,
        message: "Biller not found",
      });
    }

    // Find and remove the payment record
    const paymentIndex = biller.paidMonths.findIndex(
      (paid) => paid.month === targetMonth && paid.year === targetYear
    );

    if (paymentIndex === -1) {
      return res.status(400).json({
        success: false,
        message: `No payment record found for ${targetMonth}/${targetYear}`,
      });
    }

    biller.paidMonths.splice(paymentIndex, 1);
    await biller.save();

    res.status(200).json({
      success: true,
      message: `Payment removed for ${targetMonth}/${targetYear}`,
      biller: Biller.withStatus(biller),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error unmarking payment",
      error: error.message,
    });
  }
};
