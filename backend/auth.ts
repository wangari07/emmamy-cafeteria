import { betterAuth } from "better-auth";
// import { dash, sentinel } from "@better-auth/infra";
import { admin, organization } from "better-auth/plugins";
import { ac, roles } from "./permissions.js";
import { getDbInstance, query } from "./db.js";

export const db = getDbInstance();

const isProd = process.env.NODE_ENV === "production";

console.log("Initializing Better Auth...");
let authInstance: any;
try {
    authInstance = betterAuth({
        database: db,
        secret: process.env.BETTER_AUTH_SECRET || "a-very-secret-key-that-is-at-least-32-characters-long-for-better-auth",
        baseURL: process.env.APP_URL || process.env.BETTER_AUTH_URL || "http://localhost:3000",
        trustedOrigins: [
            process.env.APP_URL,
            process.env.SHARED_APP_URL,
            "http://localhost:3000",
            "https://dash.better-auth.com",
        ].filter(Boolean) as string[],
        basePath: process.env.BETTER_AUTH_BASE_PATH || "/api/auth",
        advanced: {
            cookiePrefix: "better-auth",
            useSecureCookies: isProd,
            cookieSameSite: isProd ? "none" : "lax",
        },
        plugins: [
            /*
            dash({
                apiKey: process.env.BETTER_AUTH_API_KEY,
                activityTracking: {
                    enabled: true,
                    updateInterval: 300000, // 5 minutes
                },
            }),
            */
            admin({
                ac: ac,
                roles: roles,
                adminRoles: ["super_admin", "admin"]
            }),
            organization({
                ac: ac,
                roles: roles,
            }),
            /*
            sentinel({
                apiKey: process.env.BETTER_AUTH_API_KEY
            })
            */
        ],
        emailAndPassword: {
            enabled: true,
            minPasswordLength: 6
        },
        user: {
            additionalFields: {
                staff_id: { type: "string", required: false },
                school: { type: "string", required: false },
                role: { type: "string", required: false, defaultValue: "user" },
                permissions: { type: "string", required: false },
                temp_password: { type: "string", required: false },
                is_active: { type: "boolean", required: false, defaultValue: true },
                requires_password_change: { type: "boolean", required: false, defaultValue: false },
                status: { type: "string", required: false, defaultValue: "pending" },
                class_assigned: { type: "string", required: false },
                lastActiveAt: { type: "date", required: false }
            }
        },
        databaseHooks: {
            user: {
                create: {
                    before: async (user) => {
                        console.log(`Creating user: ${user.email}`);
                        if (user.email === "bobonation09@gmail.com") {
                            console.log(`Setting bobonation09@gmail.com as super_admin and active`);
                            return {
                                data: {
                                    ...user,
                                    role: "super_admin",
                                    status: "active"
                                }
                            };
                        }
                        return { data: user };
                    },
                    after: async (user) => {
                        // Log the registration
                        await query('INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)', [
                            user.id,
                            'user_registration',
                            JSON.stringify({ email: user.email, name: user.name })
                        ]);

                        // Notify super admin
                        const superAdmins = await query('SELECT id FROM user WHERE role = ?', ['super_admin']) as { id: string }[];
                        for (const admin of superAdmins) {
                            await query('INSERT INTO notifications (user_id, message, type) VALUES (?, ?, ?)', [
                                admin.id,
                                `New user registered: ${user.name} (${user.email})`,
                                'registration'
                            ]);
                        }
                    }
                }
            }
        }
    });
    console.log("Better Auth initialized successfully.");
} catch (error) {
    console.error("Critical error during Better Auth initialization:", error);
    throw error;
}

export const auth = authInstance;