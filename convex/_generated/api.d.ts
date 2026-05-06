/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as activityLogs from "../activityLogs.js";
import type * as appUsers from "../appUsers.js";
import type * as campusOrders from "../campusOrders.js";
import type * as dashboard from "../dashboard.js";
import type * as inventory from "../inventory.js";
import type * as kitchen from "../kitchen.js";
import type * as mealReports from "../mealReports.js";
import type * as mealService from "../mealService.js";
import type * as migrations from "../migrations.js";
import type * as payments from "../payments.js";
import type * as purchases from "../purchases.js";
import type * as reports from "../reports.js";
import type * as seed from "../seed.js";
import type * as students from "../students.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  activityLogs: typeof activityLogs;
  appUsers: typeof appUsers;
  campusOrders: typeof campusOrders;
  dashboard: typeof dashboard;
  inventory: typeof inventory;
  kitchen: typeof kitchen;
  mealReports: typeof mealReports;
  mealService: typeof mealService;
  migrations: typeof migrations;
  payments: typeof payments;
  purchases: typeof purchases;
  reports: typeof reports;
  seed: typeof seed;
  students: typeof students;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
