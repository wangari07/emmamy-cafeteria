// convex/seed.ts

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import studentsData from "./students_data.json";

/**
 * Run:
 *   npx convex dev
 *
 * Then in another terminal:
 *   npx convex run seed:importStudents
 *   npx convex run seed:getStats
 *   npx convex run seed:getDigitalSchoolStudents
 *   npx convex run seed:getMainSchoolStudents
 *   npx convex run seed:getByAdmNo 3206
 */

// ------------------------------------
// MUTATIONS
// ------------------------------------

export const importStudents = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("students").first();

    if (existing) {
      return {
        status: "skipped",
        imported: 0,
        message:
          "Students already exist. Run seed:clearStudents first if you want to re-import.",
      };
    }

    let imported = 0;

    for (const student of studentsData.students) {
      await ctx.db.insert("students", {
        admNo: String(student.admNo ?? "").trim(),
        studentName: String(student.studentName ?? "").trim(),
        class: String(student.class ?? "").trim(),
        school:
          student.school === "DIGITAL_SCHOOL"
            ? "DIGITAL_SCHOOL"
            : "MAIN_SCHOOL",
        parentName: String(student.parentName ?? "").trim(),
        contact: String(student.contact ?? "").trim(),
        meals: {
          lunch: Boolean(student.meals?.lunch),
          fruit: Boolean(student.meals?.fruit),
          tea: Boolean(student.meals?.tea),
          snacks: Boolean(student.meals?.snacks),
        },
        mealPackage: student.mealPackage ? String(student.mealPackage) : null,
        hasMealRegistration: Boolean(student.hasMealRegistration),
        createdAt: student.createdAt || new Date().toISOString(),
        updatedAt: student.updatedAt || new Date().toISOString(),
      });

      imported++;
    }

    return {
      status: "success",
      imported,
      totalInFile: studentsData.students.length,
      message: `Successfully imported ${imported} students`,
    };
  },
});

export const clearStudents = mutation({
  args: {},
  handler: async (ctx) => {
    const students = await ctx.db.query("students").collect();

    for (const student of students) {
      await ctx.db.delete(student._id);
    }

    return {
      status: "success",
      deleted: students.length,
      message: `Deleted ${students.length} students`,
    };
  },
});

export const resetStudents = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("students").collect();

    for (const student of existing) {
      await ctx.db.delete(student._id);
    }

    let imported = 0;

    for (const student of studentsData.students) {
      await ctx.db.insert("students", {
        admNo: String(student.admNo ?? "").trim(),
        studentName: String(student.studentName ?? "").trim(),
        class: String(student.class ?? "").trim(),
        school:
          student.school === "DIGITAL_SCHOOL"
            ? "DIGITAL_SCHOOL"
            : "MAIN_SCHOOL",
        parentName: String(student.parentName ?? "").trim(),
        contact: String(student.contact ?? "").trim(),
        meals: {
          lunch: Boolean(student.meals?.lunch),
          fruit: Boolean(student.meals?.fruit),
          tea: Boolean(student.meals?.tea),
          snacks: Boolean(student.meals?.snacks),
        },
        mealPackage: student.mealPackage ? String(student.mealPackage) : null,
        hasMealRegistration: Boolean(student.hasMealRegistration),
        createdAt: student.createdAt || new Date().toISOString(),
        updatedAt: student.updatedAt || new Date().toISOString(),
      });

      imported++;
    }

    return {
      status: "success",
      deleted: existing.length,
      imported,
      totalInFile: studentsData.students.length,
      message: `Reset complete. Deleted ${existing.length} and imported ${imported} students.`,
    };
  },
});

// ------------------------------------
// QUERIES
// ------------------------------------

export const getAllStudents = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("students").collect();
  },
});

export const getByClass = query({
  args: { class: v.string() },
  handler: async (ctx, { class: className }) => {
    return await ctx.db
      .query("students")
      .withIndex("by_class", (q) => q.eq("class", className))
      .collect();
  },
});

export const getBySchool = query({
  args: {
    school: v.union(v.literal("MAIN_SCHOOL"), v.literal("DIGITAL_SCHOOL")),
  },
  handler: async (ctx, { school }) => {
    return await ctx.db
      .query("students")
      .withIndex("by_school", (q) => q.eq("school", school))
      .collect();
  },
});

export const getDigitalSchoolStudents = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("students")
      .withIndex("by_school", (q) => q.eq("school", "DIGITAL_SCHOOL"))
      .collect();
  },
});

export const getMainSchoolStudents = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("students")
      .withIndex("by_school", (q) => q.eq("school", "MAIN_SCHOOL"))
      .collect();
  },
});

export const getBySchoolAndClass = query({
  args: {
    school: v.union(v.literal("MAIN_SCHOOL"), v.literal("DIGITAL_SCHOOL")),
    class: v.string(),
  },
  handler: async (ctx, { school, class: className }) => {
    return await ctx.db
      .query("students")
      .withIndex("by_school_and_class", (q) =>
        q.eq("school", school).eq("class", className)
      )
      .collect();
  },
});

export const getByAdmNo = query({
  args: {
    admNo: v.union(v.string(), v.number()),
  },
  handler: async (ctx, { admNo }) => {
    const normalizedAdmNo = String(admNo).trim();

    return await ctx.db
      .query("students")
      .withIndex("by_admNo", (q) => q.eq("admNo", normalizedAdmNo))
      .first();
  },
});

export const getWithMeals = query({
  args: {
    school: v.optional(
      v.union(v.literal("MAIN_SCHOOL"), v.literal("DIGITAL_SCHOOL"))
    ),
  },
  handler: async (ctx, { school }) => {
    const results = await ctx.db
      .query("students")
      .withIndex("by_hasMealRegistration", (q) =>
        q.eq("hasMealRegistration", true)
      )
      .collect();

    if (school) {
      return results.filter((student) => student.school === school);
    }

    return results;
  },
});

export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const students = await ctx.db.query("students").collect();

    const totalStudents = students.length;
    const mainSchoolStudents = students.filter(
      (s) => s.school === "MAIN_SCHOOL"
    ).length;
    const digitalSchoolStudents = students.filter(
      (s) => s.school === "DIGITAL_SCHOOL"
    ).length;
    const withMealRegistration = students.filter(
      (s) => s.hasMealRegistration
    ).length;
    const noMealRegistration = totalStudents - withMealRegistration;

    const mealBreakdown = {
      lunch: students.filter((s) => s.meals.lunch).length,
      fruit: students.filter((s) => s.meals.fruit).length,
      tea: students.filter((s) => s.meals.tea).length,
      snacks: students.filter((s) => s.meals.snacks).length,
    };

    return {
      totalStudents,
      mainSchoolStudents,
      digitalSchoolStudents,
      withMealRegistration,
      noMealRegistration,
      mealBreakdown,
    };
  },
});

export const getClasses = query({
  args: {},
  handler: async (ctx) => {
    const students = await ctx.db.query("students").collect();
    const classes = [...new Set(students.map((s) => s.class))].sort();
    return classes;
  },
});

export const searchStudents = query({
  args: { search: v.string() },
  handler: async (ctx, { search }) => {
    const term = search.trim().toLowerCase();

    if (!term) {
      return [];
    }

    const students = await ctx.db.query("students").collect();

    return students.filter((student) => {
      return (
        student.studentName.toLowerCase().includes(term) ||
        student.admNo.toLowerCase().includes(term) ||
        student.parentName.toLowerCase().includes(term) ||
        student.class.toLowerCase().includes(term) ||
        student.contact.toLowerCase().includes(term)
      );
    });
  },
});