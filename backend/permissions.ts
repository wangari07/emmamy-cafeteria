import { createAccessControl } from "better-auth/plugins/access";

export const statement = {
    students: ["view", "create", "edit", "delete"],
    meals: ["view", "mark-served", "edit", "export"],
    reports: ["view", "generate", "export"],
    users: ["view", "create", "edit", "delete", "assign-role", "deactivate"],
    contacts: ["view"],
} as const;

export const ac = createAccessControl(statement);

export const super_admin = ac.newRole({
    students: ["view", "create", "edit", "delete"],
    meals: ["view", "mark-served", "edit", "export"],
    reports: ["view", "generate", "export"],
    users: ["view", "create", "edit", "delete", "assign-role", "deactivate"],
    contacts: ["view"],
});

export const admin = ac.newRole({
    students: ["view", "create", "edit", "delete"],
    meals: ["view", "mark-served", "edit", "export"],
    reports: ["view", "generate", "export"],
    contacts: ["view"],
});

export const cafeteria_manager = ac.newRole({
    students: ["view"],
    meals: ["view", "mark-served", "edit", "export"],
    reports: ["view", "generate", "export"],
});

export const cafeteria_staff = ac.newRole({
    students: ["view"],
    meals: ["mark-served"],
});

export const class_teacher = ac.newRole({
    students: ["view"],
    meals: ["view"],
    reports: ["view"],
});

export const headteacher = ac.newRole({
    students: ["view"],
    meals: ["view"],
    reports: ["view", "generate"],
    contacts: ["view"],
});

export const roles = {
    super_admin,
    admin,
    cafeteria_manager,
    cafeteria_staff,
    class_teacher,
    headteacher,
};

export type Role = keyof typeof roles;
