// convex/appUsers.ts
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const permissionsValidator = v.object({
  viewMainStudents: v.boolean(),
  viewDigitalStudents: v.boolean(),
  viewParentContacts: v.boolean(),
  markMealsServed: v.boolean(),
  editMealRegistration: v.boolean(),
  viewHistoricalData: v.boolean(),
  generateReports: v.boolean(),
  viewAllClasses: v.boolean(),
  viewFullHistory: v.boolean(),
});

function defaultPermissions() {
  return {
    viewMainStudents: false,
    viewDigitalStudents: false,
    viewParentContacts: false,
    markMealsServed: false,
    editMealRegistration: false,
    viewHistoricalData: false,
    generateReports: false,
    viewAllClasses: false,
    viewFullHistory: false,
  };
}

function generateStaffId() {
  return `STAFF-${Date.now()}`;
}

export const createPendingUser = mutation({
  args: {
    authUserId: v.optional(v.string()),
    email: v.string(),
    name: v.string(),
    requestedSchool: v.optional(
      v.union(v.literal("main"), v.literal("digital"), v.literal("both"))
    ),
  },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    const name = args.name.trim();
    const now = new Date().toISOString();

    const existing = await ctx.db
      .query("appUsers")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    if (existing) {
      if (!existing.authUserId && args.authUserId) {
        await ctx.db.patch(existing._id, {
          authUserId: args.authUserId,
          updatedAt: now,
        });
      }
      return existing;
    }

    const id = await ctx.db.insert("appUsers", {
      authUserId: args.authUserId ?? null,
      email,
      name,
      staff_id: generateStaffId(),
      requestedSchool: args.requestedSchool,
      school: args.requestedSchool ?? "main",
      role: "staff",
      status: "pending",
      permissions: defaultPermissions(),
      createdBy: null,
      approvedBy: null,
      approvedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    return await ctx.db.get(id);
  },
});

export const getUserProfileByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    return await ctx.db
      .query("appUsers")
      .withIndex("by_email", (q) => q.eq("email", email.trim().toLowerCase()))
      .first();
  },
});

export const getUserProfileByAuthUserId = query({
  args: { authUserId: v.string() },
  handler: async (ctx, { authUserId }) => {
    return await ctx.db
      .query("appUsers")
      .withIndex("by_authUserId", (q) => q.eq("authUserId", authUserId))
      .first();
  },
});

export const listPendingUsers = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db
      .query("appUsers")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();

    return users.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
});

export const listAllUsers = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("appUsers").collect();
    return users.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
});

export const approveUser = mutation({
  args: {
    userId: v.id("appUsers"),
    approvedBy: v.string(),
    role: v.union(
      v.literal("super_admin"),
      v.literal("admin"),
      v.literal("manager"),
      v.literal("staff"),
      v.literal("teacher"),
      v.literal("headteacher")
    ),
    school: v.union(
      v.literal("main"),
      v.literal("digital"),
      v.literal("both")
    ),
    permissions: permissionsValidator,
    class_assigned: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found.");
    }

    const now = new Date().toISOString();

    await ctx.db.patch(args.userId, {
      role: args.role,
      school: args.school,
      status: "active",
      permissions: args.permissions,
      class_assigned: args.class_assigned,
      approvedBy: args.approvedBy,
      approvedAt: now,
      updatedAt: now,
    });

    return await ctx.db.get(args.userId);
  },
});

export const deactivateUser = mutation({
  args: {
    userId: v.id("appUsers"),
  },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found.");
    }

    await ctx.db.patch(userId, {
      status: "deactivated",
      updatedAt: new Date().toISOString(),
    });

    return await ctx.db.get(userId);
  },
});

export const reactivateUser = mutation({
  args: {
    userId: v.id("appUsers"),
  },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found.");
    }

    await ctx.db.patch(userId, {
      status: "active",
      updatedAt: new Date().toISOString(),
    });

    return await ctx.db.get(userId);
  },
});

export const updateUserPermissions = mutation({
  args: {
    userId: v.id("appUsers"),
    role: v.union(
      v.literal("super_admin"),
      v.literal("admin"),
      v.literal("manager"),
      v.literal("staff"),
      v.literal("teacher"),
      v.literal("headteacher")
    ),
    school: v.union(
      v.literal("main"),
      v.literal("digital"),
      v.literal("both")
    ),
    permissions: permissionsValidator,
    class_assigned: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found.");
    }

    await ctx.db.patch(args.userId, {
      role: args.role,
      school: args.school,
      permissions: args.permissions,
      class_assigned: args.class_assigned,
      updatedAt: new Date().toISOString(),
    });

    return await ctx.db.get(args.userId);
  },
});

export const bootstrapSuperAdmin = mutation({
  args: {},
  handler: async (ctx) => {
    const email = "bobonation09@gmail.com";
    const name = "Bobo";
    const now = new Date().toISOString();

    const existing = await ctx.db
      .query("appUsers")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    const superAdminPermissions = {
      viewMainStudents: true,
      viewDigitalStudents: true,
      viewParentContacts: true,
      markMealsServed: true,
      editMealRegistration: true,
      viewHistoricalData: true,
      generateReports: true,
      viewAllClasses: true,
      viewFullHistory: true,
    };

    if (existing) {
      await ctx.db.patch(existing._id, {
        role: "super_admin",
        school: "both",
        status: "active",
        permissions: superAdminPermissions,
        approvedBy: "system",
        approvedAt: now,
        updatedAt: now,
      });

      return await ctx.db.get(existing._id);
    }

    const id = await ctx.db.insert("appUsers", {
      authUserId: null,
      email,
      name,
      staff_id: "SUPER-ADMIN-001",
      requestedSchool: "both",
      school: "both",
      role: "super_admin",
      status: "active",
      permissions: superAdminPermissions,
      createdBy: "system",
      approvedBy: "system",
      approvedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    return await ctx.db.get(id);
  },
});