import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * 🔹 LIST STUDENTS
 */
export const list = query({
  args: {
    search: v.optional(v.string()),
    school: v.optional(
      v.union(v.literal("MAIN_SCHOOL"), v.literal("DIGITAL_SCHOOL"))
    ),
    className: v.optional(v.string()),
    mealsOnly: v.optional(v.boolean()),
  },

  handler: async (ctx, args) => {
    let students = await ctx.db.query("students").collect();

    if (args.school) {
      students = students.filter((s) => s.school === args.school);
    }

    if (args.className) {
      students = students.filter((s) => s.class === args.className);
    }

    if (args.mealsOnly) {
      students = students.filter((s) => s.hasMealRegistration);
    }

    if (args.search?.trim()) {
      const term = args.search.trim().toLowerCase();

      students = students.filter(
        (s) =>
          s.studentName.toLowerCase().includes(term) ||
          s.admNo.toLowerCase().includes(term) ||
          s.parentName.toLowerCase().includes(term) ||
          s.contact.toLowerCase().includes(term)
      );
    }

    return students
      .sort((a, b) => a.studentName.localeCompare(b.studentName))
      .map((s) => ({
        _id: s._id,
        admNo: s.admNo,
        studentName: s.studentName,
        class: s.class,
        school: s.school,
        currentPoints: s.currentPoints ?? 0,
        debtBalance: s.debtBalance ?? 0,
        debtLimit: s.debtLimit ?? 200,
        lowBalanceThreshold: s.lowBalanceThreshold ?? 100,
        hasMealRegistration: s.hasMealRegistration,
        parentName: s.parentName,
        contact: s.contact,
        mealPackage: s.mealPackage ?? null,
        meals: {
          lunch: s.meals?.lunch ?? false,
          fruit: s.meals?.fruit ?? false,
          tea: s.meals?.tea ?? false,
          snacks: s.meals?.snacks ?? false,
        },
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      }));
  },
});

/**
 * 🔹 GET STUDENT BY ID
 * Useful for the upcoming Student Account Manager page.
 */
export const getById = query({
  args: {
    studentId: v.id("students"),
  },

  handler: async (ctx, { studentId }) => {
    const student = await ctx.db.get(studentId);

    if (!student) return null;

    return {
      _id: student._id,
      admNo: student.admNo,
      studentName: student.studentName,
      class: student.class,
      school: student.school,
      parentName: student.parentName,
      contact: student.contact,

      currentPoints: student.currentPoints ?? 0,
      debtBalance: student.debtBalance ?? 0,
      debtLimit: student.debtLimit ?? 200,
      lowBalanceThreshold: student.lowBalanceThreshold ?? 100,

      hasMealRegistration: student.hasMealRegistration ?? false,
      mealPackage: student.mealPackage ?? null,
      status: student.hasMealRegistration ? "Active" : "Inactive",

      meals: {
        lunch: student.meals?.lunch ?? false,
        fruit: student.meals?.fruit ?? false,
        tea: student.meals?.tea ?? false,
        snacks: student.meals?.snacks ?? false,
      },

      createdAt: student.createdAt,
      updatedAt: student.updatedAt,
    };
  },
});

/**
 * 🔹 GET FULL STUDENT PROFILE BY ADMISSION NUMBER
 * Used by StudentProfile.tsx
 */
export const getProfileByAdmNo = query({
  args: { admNo: v.string() },

  handler: async (ctx, { admNo }) => {
    const cleanAdmNo = admNo.trim();

    const student = await ctx.db
      .query("students")
      .filter((q) => q.eq(q.field("admNo"), cleanAdmNo))
      .first();

    if (!student) return null;

    /**
     * These are your actual exported table names:
     * - mealHistory
     * - walletTransactions
     */
    const mealsServed = await ctx.db
      .query("mealHistory")
      .filter((q) => q.eq(q.field("studentId"), student._id))
      .order("desc")
      .collect();

    const transactions = await ctx.db
      .query("walletTransactions")
      .filter((q) => q.eq(q.field("studentId"), student._id))
      .order("desc")
      .collect();

    return {
      id: student.admNo,
      _id: student._id,

      name: student.studentName,
      studentName: student.studentName,
      admNo: student.admNo,

      class: student.class,
      school: student.school,
      status: student.hasMealRegistration ? "Active" : "Inactive",

      current_points: student.currentPoints ?? 0,
      currentPoints: student.currentPoints ?? 0,

      debt_balance: student.debtBalance ?? 0,
      debtBalance: student.debtBalance ?? 0,

      debt_limit: student.debtLimit ?? 200,
      debtLimit: student.debtLimit ?? 200,

      low_balance_threshold: student.lowBalanceThreshold ?? 100,
      lowBalanceThreshold: student.lowBalanceThreshold ?? 100,

      parent_name: student.parentName ?? null,
      parentName: student.parentName ?? null,

      parent_phone: student.contact ?? null,
      contact: student.contact ?? null,

      mealPackage: student.mealPackage ?? null,
      hasMealRegistration: student.hasMealRegistration ?? false,

      meals: {
        lunch: student.meals?.lunch ?? false,
        fruit: student.meals?.fruit ?? false,
        tea: student.meals?.tea ?? false,
        snacks: student.meals?.snacks ?? false,
      },

      meals_served: mealsServed.map((m: any) => ({
        id: m._id,
        meal_type: m.mealType ?? m.meal_type ?? m.type ?? "Meal",
        served_at:
          m.servedAt ??
          m.served_at ??
          m.createdAt ??
          m._creationTime,
        item: m.item ?? null,
        pointsDeducted: m.pointsDeducted ?? m.amount ?? 0,
      })),

      transactions: transactions.map((t: any) => ({
        id: t._id,
        type: t.type ?? "Transaction",
        item: t.item ?? t.description ?? t.reason ?? null,
        amount: t.amount ?? 0,
        status: t.status ?? "Completed",
        balanceBefore: t.balanceBefore ?? null,
        balanceAfter: t.balanceAfter ?? null,
        source: t.source ?? null,
        created_at:
          t.createdAt ??
          t.created_at ??
          t._creationTime,
      })),
    };
  },
});

/**
 * 🔹 GET CLASSES BY CAMPUS
 */
export const getClasses = query({
  args: {
    campus: v.optional(
      v.union(v.literal("MAIN_SCHOOL"), v.literal("DIGITAL_SCHOOL"))
    ),
  },

  handler: async (ctx, { campus }) => {
    let students = await ctx.db.query("students").collect();

    if (campus) {
      students = students.filter((s) => s.school === campus);
    }

    return [...new Set(students.map((s) => s.class).filter(Boolean))].sort();
  },
});

/**
 * 🔹 GET CAMPUSES
 */
export const getCampuses = query({
  handler: async (ctx) => {
    const students = await ctx.db.query("students").collect();
    return [...new Set(students.map((s) => s.school).filter(Boolean))];
  },
});

/**
 * 🔹 CREATE STUDENT
 */
export const createStudent = mutation({
  args: {
    admNo: v.string(),
    studentName: v.string(),
    className: v.string(),
    school: v.union(v.literal("MAIN_SCHOOL"), v.literal("DIGITAL_SCHOOL")),
    parentName: v.string(),
    contact: v.string(),
  },

  handler: async (ctx, args) => {
    const cleanAdmNo = args.admNo.trim();
    const cleanStudentName = args.studentName.trim();
    const cleanClassName = args.className.trim();
    const cleanParentName = args.parentName.trim();
    const cleanContact = args.contact.trim();

    if (!cleanAdmNo) {
      throw new Error("Admission number is required.");
    }

    if (!cleanStudentName) {
      throw new Error("Student name is required.");
    }

    if (!cleanClassName) {
      throw new Error("Class is required.");
    }

    if (!cleanParentName) {
      throw new Error("Parent or guardian name is required.");
    }

    if (!cleanContact) {
      throw new Error("Parent or guardian contact is required.");
    }

    const existing = await ctx.db
      .query("students")
      .filter((q) => q.eq(q.field("admNo"), cleanAdmNo))
      .first();

    if (existing) {
      throw new Error(
        `A student with admission number ${cleanAdmNo} already exists.`
      );
    }

    const now = new Date().toISOString();

    return await ctx.db.insert("students", {
      admNo: cleanAdmNo,
      studentName: cleanStudentName,
      class: cleanClassName,
      school: args.school,

      parentName: cleanParentName,
      contact: cleanContact,

      currentPoints: 0,
      debtBalance: 0,
      debtLimit: 200,
      lowBalanceThreshold: 100,

      hasMealRegistration: false,
      mealPackage: null,

      meals: {
        lunch: false,
        fruit: false,
        tea: false,
        snacks: false,
      },

      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * 🔹 ADMIN: UPDATE STUDENT BASIC INFO
 */
export const updateStudentBasicInfo = mutation({
  args: {
    studentId: v.id("students"),
    admNo: v.optional(v.string()),
    studentName: v.optional(v.string()),
    className: v.optional(v.string()),
    school: v.optional(
      v.union(v.literal("MAIN_SCHOOL"), v.literal("DIGITAL_SCHOOL"))
    ),
    parentName: v.optional(v.string()),
    contact: v.optional(v.string()),
  },

  handler: async (ctx, args) => {
    const student = await ctx.db.get(args.studentId);

    if (!student) {
      throw new Error("Student not found.");
    }

    const patch: Partial<{
      admNo: string;
      studentName: string;
      class: string;
      school: "MAIN_SCHOOL" | "DIGITAL_SCHOOL";
      parentName: string;
      contact: string;
      updatedAt: string;
    }> = {};

    if (args.admNo !== undefined) {
      const cleanAdmNo = args.admNo.trim();

      if (!cleanAdmNo) {
        throw new Error("Admission number cannot be empty.");
      }

      if (cleanAdmNo !== student.admNo) {
        const existing = await ctx.db
          .query("students")
          .filter((q) => q.eq(q.field("admNo"), cleanAdmNo))
          .first();

        if (existing) {
          throw new Error(
            `A student with admission number ${cleanAdmNo} already exists.`
          );
        }
      }

      patch.admNo = cleanAdmNo;
    }

    if (args.studentName !== undefined) {
      const cleanName = args.studentName.trim();

      if (!cleanName) {
        throw new Error("Student name cannot be empty.");
      }

      patch.studentName = cleanName;
    }

    if (args.className !== undefined) {
      const cleanClassName = args.className.trim();

      if (!cleanClassName) {
        throw new Error("Class cannot be empty.");
      }

      patch.class = cleanClassName;
    }

    if (args.school !== undefined) {
      patch.school = args.school;
    }

    if (args.parentName !== undefined) {
      const cleanParentName = args.parentName.trim();

      if (!cleanParentName) {
        throw new Error("Parent or guardian name cannot be empty.");
      }

      patch.parentName = cleanParentName;
    }

    if (args.contact !== undefined) {
      const cleanContact = args.contact.trim();

      if (!cleanContact) {
        throw new Error("Contact cannot be empty.");
      }

      patch.contact = cleanContact;
    }

    patch.updatedAt = new Date().toISOString();

    await ctx.db.patch(args.studentId, patch);

    return {
      success: true,
      studentId: args.studentId,
    };
  },
});

/**
 * 🔹 ADMIN: UPDATE MEAL REGISTRATION
 */
export const updateMealRegistration = mutation({
  args: {
    studentId: v.id("students"),
    hasMealRegistration: v.boolean(),
    mealPackage: v.union(v.string(), v.null()),
    meals: v.object({
      lunch: v.boolean(),
      fruit: v.boolean(),
      tea: v.boolean(),
      snacks: v.boolean(),
    }),
  },

  handler: async (ctx, args) => {
    const student = await ctx.db.get(args.studentId);

    if (!student) {
      throw new Error("Student not found.");
    }

    const cleanMealPackage =
      args.mealPackage === null ? null : args.mealPackage.trim();

    if (args.hasMealRegistration && !cleanMealPackage) {
      throw new Error("Meal package is required when activating a student.");
    }

    const now = new Date().toISOString();

    await ctx.db.patch(args.studentId, {
      hasMealRegistration: args.hasMealRegistration,
      mealPackage: args.hasMealRegistration ? cleanMealPackage : null,
      meals: args.hasMealRegistration
        ? args.meals
        : {
            lunch: false,
            fruit: false,
            tea: false,
            snacks: false,
          },
      updatedAt: now,
    });

    return {
      success: true,
      studentId: args.studentId,
      hasMealRegistration: args.hasMealRegistration,
      mealPackage: args.hasMealRegistration ? cleanMealPackage : null,
    };
  },
});

/**
 * 🔹 ADMIN: SET WALLET SETTINGS
 */
export const updateWalletSettings = mutation({
  args: {
    studentId: v.id("students"),
    debtLimit: v.optional(v.float64()),
    lowBalanceThreshold: v.optional(v.float64()),
  },

  handler: async (ctx, args) => {
    const student = await ctx.db.get(args.studentId);

    if (!student) {
      throw new Error("Student not found.");
    }

    const patch: Partial<{
      debtLimit: number;
      lowBalanceThreshold: number;
      updatedAt: string;
    }> = {};

    if (args.debtLimit !== undefined) {
      if (args.debtLimit < 0) {
        throw new Error("Debt limit cannot be negative.");
      }

      patch.debtLimit = args.debtLimit;
    }

    if (args.lowBalanceThreshold !== undefined) {
      if (args.lowBalanceThreshold < 0) {
        throw new Error("Low balance threshold cannot be negative.");
      }

      patch.lowBalanceThreshold = args.lowBalanceThreshold;
    }

    patch.updatedAt = new Date().toISOString();

    await ctx.db.patch(args.studentId, patch);

    return {
      success: true,
      studentId: args.studentId,
    };
  },
});

/**
 * 🔹 ADMIN: MANUAL POINTS ADJUSTMENT
 *
 * type:
 * - TOP_UP: adds to current points
 * - DEDUCTION: subtracts from current points
 * - SET_BALANCE: replaces current points with amount
 *
 * NOTE:
 * This safely updates the student balance.
 * After you send schema.ts, we can also add guaranteed walletTransactions/activityLogs inserts.
 */
export const manualAdjustStudentPoints = mutation({
  args: {
    studentId: v.id("students"),
    amount: v.float64(),
    type: v.union(
      v.literal("TOP_UP"),
      v.literal("DEDUCTION"),
      v.literal("SET_BALANCE")
    ),
    reason: v.optional(v.string()),
  },

  handler: async (ctx, args) => {
    const student = await ctx.db.get(args.studentId);

    if (!student) {
      throw new Error("Student not found.");
    }

    if (args.amount < 0) {
      throw new Error("Amount cannot be negative.");
    }

    const currentPoints = student.currentPoints ?? 0;
    let newPoints = currentPoints;

    if (args.type === "TOP_UP") {
      if (args.amount <= 0) {
        throw new Error("Top up amount must be greater than zero.");
      }

      newPoints = currentPoints + args.amount;
    }

    if (args.type === "DEDUCTION") {
      if (args.amount <= 0) {
        throw new Error("Deduction amount must be greater than zero.");
      }

      newPoints = currentPoints - args.amount;
    }

    if (args.type === "SET_BALANCE") {
      newPoints = args.amount;
    }

    const now = new Date().toISOString();

    await ctx.db.patch(args.studentId, {
      currentPoints: newPoints,
      updatedAt: now,
    });

    return {
      success: true,
      studentId: args.studentId,
      type: args.type,
      reason: args.reason ?? null,
      previousPoints: currentPoints,
      amount: args.amount,
      newPoints,
    };
  },
});

/**
 * 🔹 CLI COMPATIBILITY: TOP UP STUDENT POINTS
 *
 * This keeps your old command working:
 * npx convex run students:topUpStudentPoints --prod ...
 */
export const topUpStudentPoints = mutation({
  args: {
    studentId: v.id("students"),
    points: v.float64(),
  },

  handler: async (ctx, args) => {
    const student = await ctx.db.get(args.studentId);

    if (!student) {
      throw new Error("Student not found.");
    }

    if (args.points <= 0) {
      throw new Error("Points must be greater than zero.");
    }

    const currentPoints = student.currentPoints ?? 0;
    const newPoints = currentPoints + args.points;
    const now = new Date().toISOString();

    await ctx.db.patch(args.studentId, {
      currentPoints: newPoints,
      updatedAt: now,
    });

    return {
      success: true,
      studentId: args.studentId,
      previousPoints: currentPoints,
      addedPoints: args.points,
      newPoints,
    };
  },
});

/**
 * 🔹 ADMIN: ACTIVATE STUDENT AND SET OPENING BALANCE
 *
 * Best for mid-term onboarding where parents already paid before the system started.
 */
export const activateStudentWithOpeningBalance = mutation({
  args: {
    studentId: v.id("students"),
    mealPackage: v.string(),
    meals: v.object({
      lunch: v.boolean(),
      fruit: v.boolean(),
      tea: v.boolean(),
      snacks: v.boolean(),
    }),
    openingPoints: v.float64(),
    reason: v.optional(v.string()),
  },

  handler: async (ctx, args) => {
    const student = await ctx.db.get(args.studentId);

    if (!student) {
      throw new Error("Student not found.");
    }

    const cleanMealPackage = args.mealPackage.trim();

    if (!cleanMealPackage) {
      throw new Error("Meal package is required.");
    }

    if (args.openingPoints < 0) {
      throw new Error("Opening points cannot be negative.");
    }

    const currentPoints = student.currentPoints ?? 0;
    const now = new Date().toISOString();

    await ctx.db.patch(args.studentId, {
      hasMealRegistration: true,
      mealPackage: cleanMealPackage,
      meals: args.meals,
      currentPoints: args.openingPoints,
      updatedAt: now,
    });

    return {
      success: true,
      studentId: args.studentId,
      reason: args.reason ?? null,
      previousPoints: currentPoints,
      newPoints: args.openingPoints,
      mealPackage: cleanMealPackage,
      hasMealRegistration: true,
    };
  },
});

/**
 * 🔹 ADMIN: DEACTIVATE MEAL REGISTRATION
 */
export const deactivateMealRegistration = mutation({
  args: {
    studentId: v.id("students"),
    reason: v.optional(v.string()),
  },

  handler: async (ctx, args) => {
    const student = await ctx.db.get(args.studentId);

    if (!student) {
      throw new Error("Student not found.");
    }

    const now = new Date().toISOString();

    await ctx.db.patch(args.studentId, {
      hasMealRegistration: false,
      mealPackage: null,
      meals: {
        lunch: false,
        fruit: false,
        tea: false,
        snacks: false,
      },
      updatedAt: now,
    });

    return {
      success: true,
      studentId: args.studentId,
      reason: args.reason ?? null,
      hasMealRegistration: false,
    };
  },
});