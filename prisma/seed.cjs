const { randomBytes, scryptSync } = require('node:crypto');
const { PrismaClient, PermissionEffect, PermissionModule, PermissionType, UserStatus } = require('@prisma/client');

const prisma = new PrismaClient();

const roles = [
  { key: 'admin', name: 'Admin', level: 100 },
  { key: 'manager', name: 'Manager', level: 70 },
  { key: 'agent', name: 'Agent', level: 40 },
  { key: 'customer', name: 'Customer', level: 10 },
];

const permissions = [
  { key: 'page.dashboard.view', module: PermissionModule.DASHBOARD, type: PermissionType.PAGE, route: '/dashboard', label: 'Dashboard' },
  { key: 'page.users.view', module: PermissionModule.USERS, type: PermissionType.PAGE, route: '/users', label: 'Users' },
  { key: 'page.permissions.view', module: PermissionModule.PERMISSIONS, type: PermissionType.PAGE, route: '/users/:id/permissions', label: 'Permission Editor' },
  { key: 'page.leads.view', module: PermissionModule.LEADS, type: PermissionType.PAGE, route: '/leads', label: 'Leads' },
  { key: 'page.tasks.view', module: PermissionModule.TASKS, type: PermissionType.PAGE, route: '/tasks', label: 'Tasks' },
  { key: 'page.reports.view', module: PermissionModule.REPORTS, type: PermissionType.PAGE, route: '/reports', label: 'Reports' },
  { key: 'page.audit.view', module: PermissionModule.AUDIT, type: PermissionType.PAGE, route: '/audit-logs', label: 'Audit Logs' },
  { key: 'page.customer_portal.view', module: PermissionModule.PORTAL, type: PermissionType.PAGE, route: '/portal', label: 'Customer Portal' },
  { key: 'page.settings.view', module: PermissionModule.SETTINGS, type: PermissionType.PAGE, route: '/settings', label: 'Settings' },
  { key: 'users.create', module: PermissionModule.USERS, type: PermissionType.ACTION, route: null, label: 'Create Users' },
  { key: 'users.read', module: PermissionModule.USERS, type: PermissionType.ACTION, route: null, label: 'Read Users' },
  { key: 'users.update', module: PermissionModule.USERS, type: PermissionType.ACTION, route: null, label: 'Update Users' },
  { key: 'users.suspend', module: PermissionModule.USERS, type: PermissionType.ACTION, route: null, label: 'Suspend Users' },
  { key: 'users.ban', module: PermissionModule.USERS, type: PermissionType.ACTION, route: null, label: 'Ban Users' },
  { key: 'users.assign_manager', module: PermissionModule.USERS, type: PermissionType.ACTION, route: null, label: 'Assign Manager' },
  { key: 'users.assign_role', module: PermissionModule.USERS, type: PermissionType.ACTION, route: null, label: 'Assign Role' },
  { key: 'permissions.read', module: PermissionModule.PERMISSIONS, type: PermissionType.ACTION, route: null, label: 'Read Permissions' },
  { key: 'permissions.assign', module: PermissionModule.PERMISSIONS, type: PermissionType.ACTION, route: null, label: 'Assign Permissions' },
  { key: 'permissions.revoke', module: PermissionModule.PERMISSIONS, type: PermissionType.ACTION, route: null, label: 'Revoke Permissions' },
  { key: 'leads.create', module: PermissionModule.LEADS, type: PermissionType.ACTION, route: null, label: 'Create Leads' },
  { key: 'leads.read', module: PermissionModule.LEADS, type: PermissionType.ACTION, route: null, label: 'Read Leads' },
  { key: 'leads.update', module: PermissionModule.LEADS, type: PermissionType.ACTION, route: null, label: 'Update Leads' },
  { key: 'leads.assign', module: PermissionModule.LEADS, type: PermissionType.ACTION, route: null, label: 'Assign Leads' },
  { key: 'leads.change_status', module: PermissionModule.LEADS, type: PermissionType.ACTION, route: null, label: 'Change Lead Status' },
  { key: 'leads.delete', module: PermissionModule.LEADS, type: PermissionType.ACTION, route: null, label: 'Delete Leads' },
  { key: 'tasks.create', module: PermissionModule.TASKS, type: PermissionType.ACTION, route: null, label: 'Create Tasks' },
  { key: 'tasks.read', module: PermissionModule.TASKS, type: PermissionType.ACTION, route: null, label: 'Read Tasks' },
  { key: 'tasks.update', module: PermissionModule.TASKS, type: PermissionType.ACTION, route: null, label: 'Update Tasks' },
  { key: 'tasks.assign', module: PermissionModule.TASKS, type: PermissionType.ACTION, route: null, label: 'Assign Tasks' },
  { key: 'tasks.change_status', module: PermissionModule.TASKS, type: PermissionType.ACTION, route: null, label: 'Change Task Status' },
  { key: 'tasks.delete', module: PermissionModule.TASKS, type: PermissionType.ACTION, route: null, label: 'Delete Tasks' },
  { key: 'reports.read', module: PermissionModule.REPORTS, type: PermissionType.ACTION, route: null, label: 'Read Reports' },
  { key: 'reports.export', module: PermissionModule.REPORTS, type: PermissionType.ACTION, route: null, label: 'Export Reports' },
  { key: 'audit.read', module: PermissionModule.AUDIT, type: PermissionType.ACTION, route: null, label: 'Read Audit Logs' },
  { key: 'portal.read_self', module: PermissionModule.PORTAL, type: PermissionType.ACTION, route: null, label: 'Read Own Portal' },
  { key: 'portal.update_self', module: PermissionModule.PORTAL, type: PermissionType.ACTION, route: null, label: 'Update Own Portal' },
  { key: 'settings.read_self', module: PermissionModule.SETTINGS, type: PermissionType.ACTION, route: null, label: 'Read Own Settings' },
  { key: 'settings.update_self', module: PermissionModule.SETTINGS, type: PermissionType.ACTION, route: null, label: 'Update Own Settings' },
  { key: 'settings.read_app', module: PermissionModule.SETTINGS, type: PermissionType.ACTION, route: null, label: 'Read App Settings' },
  { key: 'settings.update_app', module: PermissionModule.SETTINGS, type: PermissionType.ACTION, route: null, label: 'Update App Settings' },
];

const rolePermissionKeys = {
  admin: permissions.map((permission) => permission.key),
  manager: [
    'page.dashboard.view',
    'page.users.view',
    'page.permissions.view',
    'page.leads.view',
    'page.tasks.view',
    'page.reports.view',
    'page.audit.view',
    'page.settings.view',
    'users.create',
    'users.read',
    'users.update',
    'users.suspend',
    'users.ban',
    'users.assign_manager',
    'users.assign_role',
    'permissions.read',
    'permissions.assign',
    'permissions.revoke',
    'leads.create',
    'leads.read',
    'leads.update',
    'leads.assign',
    'leads.change_status',
    'leads.delete',
    'tasks.create',
    'tasks.read',
    'tasks.update',
    'tasks.assign',
    'tasks.change_status',
    'tasks.delete',
    'reports.read',
    'reports.export',
    'audit.read',
    'settings.read_self',
    'settings.update_self',
  ],
  agent: [
    'page.dashboard.view',
    'page.leads.view',
    'page.tasks.view',
    'page.settings.view',
    'leads.read',
    'leads.update',
    'leads.change_status',
    'tasks.read',
    'tasks.update',
    'tasks.change_status',
    'settings.read_self',
    'settings.update_self',
  ],
  customer: [
    'page.customer_portal.view',
    'page.settings.view',
    'portal.read_self',
    'portal.update_self',
    'settings.read_self',
    'settings.update_self',
  ],
};

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

async function main() {
  for (const role of roles) {
    await prisma.role.upsert({
      where: { key: role.key },
      update: { name: role.name, level: role.level, isSystem: true },
      create: { ...role, isSystem: true },
    });
  }

  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: { key: permission.key },
      update: permission,
      create: permission,
    });
  }

  const [dbRoles, dbPermissions] = await Promise.all([
    prisma.role.findMany(),
    prisma.permission.findMany(),
  ]);

  const roleIdByKey = Object.fromEntries(dbRoles.map((role) => [role.key, role.id]));
  const permissionIdByKey = Object.fromEntries(dbPermissions.map((permission) => [permission.key, permission.id]));

  await prisma.rolePermission.deleteMany({});

  await prisma.rolePermission.createMany({
    data: Object.entries(rolePermissionKeys).flatMap(([roleKey, permissionKeys]) =>
      permissionKeys.map((permissionKey) => ({
        roleId: roleIdByKey[roleKey],
        permissionId: permissionIdByKey[permissionKey],
      })),
    ),
    skipDuplicates: true,
  });

  const adminRoleId = roleIdByKey.admin;
  const adminEmail = process.env.ADMIN_SEED_EMAIL || 'admin@rbac.local';
  const adminPassword = process.env.ADMIN_SEED_PASSWORD || 'Admin123!';
  const adminPasswordHash = hashPassword(adminPassword);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      firstName: 'System',
      lastName: 'Admin',
      roleId: adminRoleId,
      status: UserStatus.ACTIVE,
      passwordHash: adminPasswordHash,
      mustChangePassword: false,
    },
    create: {
      email: adminEmail,
      passwordHash: adminPasswordHash,
      firstName: 'System',
      lastName: 'Admin',
      roleId: adminRoleId,
      status: UserStatus.ACTIVE,
      mustChangePassword: false,
    },
  });

  await prisma.userSetting.upsert({
    where: { userId: admin.id },
    update: {},
    create: {
      userId: admin.id,
      locale: 'en',
      timezone: 'UTC',
    },
  });

  await prisma.appSetting.upsert({
    where: { key: 'app.identity' },
    update: {
      updatedBy: admin.id,
      value: {
        name: 'RBAC System',
        supportEmail: adminEmail,
      },
    },
    create: {
      key: 'app.identity',
      updatedBy: admin.id,
      value: {
        name: 'RBAC System',
        supportEmail: adminEmail,
      },
    },
  });

  await prisma.appSetting.upsert({
    where: { key: 'auth.policy' },
    update: {
      updatedBy: admin.id,
      value: {
        accessTokenMinutes: 15,
        refreshTokenDays: 7,
      },
    },
    create: {
      key: 'auth.policy',
      updatedBy: admin.id,
      value: {
        accessTokenMinutes: 15,
        refreshTokenDays: 7,
      },
    },
  });

  console.log(`Seed complete. Admin email: ${adminEmail}`);
}

main()
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
