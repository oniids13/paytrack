import mongoose from "mongoose";

const paidMonthSchema = new mongoose.Schema(
  {
    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },
    year: {
      type: Number,
      required: true,
    },
    paidAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const billerSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, "Biller name is required"],
      trim: true,
    },
    type: {
      type: String,
      enum: ["bill", "credit"],
      required: [true, "Biller type is required"],
    },
    amount: {
      type: Number,
      required: [true, "Amount is required"],
      min: [0, "Amount cannot be negative"],
    },
    dueDate: {
      type: Number,
      required: [true, "Due date is required"],
      min: [1, "Due date must be between 1 and 31"],
      max: [31, "Due date must be between 1 and 31"],
    },
    // Credit card specific fields
    cutOffDate: {
      type: Number,
      min: [1, "Cut-off date must be between 1 and 31"],
      max: [31, "Cut-off date must be between 1 and 31"],
    },
    creditLimit: {
      type: Number,
      min: [0, "Credit limit cannot be negative"],
    },
    // Payment tracking - array of paid months
    paidMonths: [paidMonthSchema],
    // Organization
    category: {
      type: String,
      enum: [
        "utilities",
        "subscription",
        "loan",
        "credit_card",
        "insurance",
        "rent",
        "other",
      ],
      default: "other",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Validation: cutOffDate is required for credit type
billerSchema.pre("validate", function (next) {
  if (this.type === "credit" && !this.cutOffDate) {
    this.invalidate("cutOffDate", "Cut-off date is required for credit cards");
  }
  next();
});

// Method to check if paid for a specific month
billerSchema.methods.isPaidForMonth = function (month, year) {
  return this.paidMonths.some(
    (paid) => paid.month === month && paid.year === year
  );
};

// Method to get computed status
billerSchema.methods.getStatus = function () {
  const now = new Date();
  const currentMonth = now.getMonth() + 1; // 1-12
  const currentYear = now.getFullYear();
  const currentDay = now.getDate();

  const isPaid = this.isPaidForMonth(currentMonth, currentYear);

  if (isPaid) {
    return "paid";
  }

  // Check if overdue (due date has passed this month)
  if (currentDay > this.dueDate) {
    return "overdue";
  }

  // Check if due soon (within 7 days)
  const daysUntilDue = this.dueDate - currentDay;
  if (daysUntilDue <= 7 && daysUntilDue >= 0) {
    return "due_soon";
  }

  return "pending";
};

// Method to get days until due date
billerSchema.methods.getDaysUntilDue = function () {
  const now = new Date();
  const currentDay = now.getDate();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  // Create due date for current month
  let dueDate = new Date(currentYear, currentMonth, this.dueDate);

  // If due date has passed, calculate for next month
  if (currentDay > this.dueDate) {
    dueDate = new Date(currentYear, currentMonth + 1, this.dueDate);
  }

  const diffTime = dueDate - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
};

// Static method to add status to biller object
billerSchema.statics.withStatus = function (biller) {
  const billerObj = biller.toObject ? biller.toObject() : { ...biller };
  billerObj.status = biller.getStatus ? biller.getStatus() : null;
  billerObj.daysUntilDue = biller.getDaysUntilDue ? biller.getDaysUntilDue() : null;
  return billerObj;
};

const Biller = mongoose.model("Biller", billerSchema);

export default Biller;
