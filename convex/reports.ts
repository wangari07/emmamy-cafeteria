import { query } from "./_generated/server";

/**
 * 🔹 SUMMARY STATS
 */
export const getSummary = query({
  handler: async (ctx) => {
    const meals = await ctx.db.query("mealHistory").collect();

    const totalMeals = meals.length;

    const totalPoints = meals.reduce(
      (sum, m) => sum + (m.pointsCost || 0),
      0
    );

    const uniqueStudents = new Set(meals.map((m) => m.studentId)).size;

    return {
      totalMeals,
      totalPoints,
      uniqueStudents,
    };
  },
});

/**
 * 🔹 POPULAR ITEMS
 */
export const getPopularItems = query({
  handler: async (ctx) => {
    const meals = await ctx.db.query("mealHistory").collect();

    const counts: Record<string, number> = {};

    meals.forEach((m) => {
      const item = m.menuItem || "Unknown";
      counts[item] = (counts[item] || 0) + 1;
    });

    return Object.entries(counts).map(([name, count]) => ({
      name,
      count,
    }));
  },
});

/**
 * 🔹 DISTRIBUTION (MEALS BY CATEGORY)
 */
export const getDistribution = query({
  handler: async (ctx) => {
    const meals = await ctx.db.query("mealHistory").collect();

    const dist: Record<string, number> = {};

    meals.forEach((m) => {
      const cat = m.category || "Other";
      dist[cat] = (dist[cat] || 0) + 1;
    });

    return Object.entries(dist).map(([category, value]) => ({
      category,
      value,
    }));
  },
});

/**
 * 🔹 RECENT ACTIVITY
 */
export const getRecentActivity = query({
  handler: async (ctx) => {
    const meals = await ctx.db
      .query("mealHistory")
      .order("desc")
      .take(10);

    return meals.map((m) => ({
      student: m.studentName,
      item: m.menuItem,
      time: m.servedAt,
      points: m.pointsCost,
    }));
  },
});