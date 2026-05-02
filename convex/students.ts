import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * 🔹 LIST STUDENTS (FIXED FILTERING)
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

    // ✅ FILTER BY CAMPUS
    if (args.school) {
      students = students.filter((s) => s.school === args.school);
    }

    // ✅ FILTER BY CLASS
    if (args.className) {
      students = students.filter((s) => s.class === args.className);
    }

    // OPTIONAL
    if (args.mealsOnly) {
      students = students.filter((s) => s.hasMealRegistration);
    }

    // ✅ SEARCH
    if (args.search?.trim()) {
      const term = args.search.trim().toLowerCase();

      students = students.filter(
        (s) =>
          s.studentName.toLowerCase().includes(term) ||
          s.admNo.toLowerCase().includes(term)
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
        hasMealRegistration: s.hasMealRegistration,
        parentName: s.parentName,
        contact: s.contact,
        mealPackage: s.mealPackage ?? null,
      }));
  },
});

/**
 * 🔹 GET FULL STUDENT PROFILE BY ADMISSION NUMBER
 * Used by StudentProfile.tsx
 */
export const getProfileByAdmNo = query({
  args: { admNo: v.string() },
  handler: async (ctx, { admNo }) => {
    // Find the student
    const student = await ctx.db
      .query("students")
      .filter((q) => q.eq(q.field("admNo"), admNo))
      .first();

    if (!student) return null;

    // Fetch related meals served
    const mealsServed = await ctx.db
      .query("meals_served")
      .filter((q) => q.eq(q.field("studentId"), student._id))
      .order("desc")
      .collect();

    // Fetch related transactions
    const transactions = await ctx.db
      .query("transactions")
      .filter((q) => q.eq(q.field("studentId"), student._id))
      .order("desc")
      .collect();

    return {
      // Identity
      id: student.admNo,
      name: student.studentName,
      class: student.class,
      school: student.school,
      status: student.hasMealRegistration ? "Active" : "Inactive",

      // Wallet
      current_points: student.currentPoints ?? 0,
      debt_balance: student.debtBalance ?? 0,
      debt_limit: student.debtLimit ?? 200,
      low_balance_threshold: student.lowBalanceThreshold ?? 100,

      // Parent / Guardian
      parent_name: student.parentName ?? null,
      parent_phone: student.contact ?? null,

      // Meal info
      mealPackage: student.mealPackage ?? null,
      hasMealRegistration: student.hasMealRegistration ?? false,
      meals: {
        lunch: student.meals?.lunch ?? false,
        fruit: student.meals?.fruit ?? false,
        tea: student.meals?.tea ?? false,
        snacks: student.meals?.snacks ?? false,
      },

      // Related records
      meals_served: mealsServed.map((m) => ({
        id: m._id,
        meal_type: m.mealType ?? m.meal_type ?? "Meal",
        served_at: m.servedAt ?? m.served_at ?? m._creationTime,
      })),

      transactions: transactions.map((t) => ({
        id: t._id,
        type: t.type ?? "Transaction",
        item: t.item ?? t.description ?? null,
        amount: t.amount ?? 0,
        status: t.status ?? "Completed",
        created_at: t.createdAt ?? t.created_at ?? t._creationTime,
      })),
    };
  },
});

/**
 * 🔹 GET CLASSES (BY CAMPUS)
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

    return [...new Set(students.map((s) => s.class))].sort();
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
    // Check for duplicate admission number
    const existing = await ctx.db
      .query("students")
      .filter((q) => q.eq(q.field("admNo"), args.admNo))
      .first();

    if (existing) {
      throw new Error(`A student with admission number ${args.admNo} already exists.`);
    }

    return await ctx.db.insert("students", {
      admNo: args.admNo,
      studentName: args.studentName,
      class: args.className,
      school: args.school,
      parentName: args.parentName,
      contact: args.contact,
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
    });
  },
});