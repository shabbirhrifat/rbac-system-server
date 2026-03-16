const { randomBytes, scryptSync } = require('node:crypto');
const { PrismaPg } = require('@prisma/adapter-pg');
const {
  LeadStatus,
  PermissionEffect,
  PermissionModule,
  PermissionType,
  PrismaClient,
  TaskPriority,
  TaskStatus,
  UserStatus,
} = require('@prisma/client');

const databaseUrl =
  process.env.DATABASE_URL ||
  process.env.DIRECT_URL ||
  'postgresql://postgres:postgres@localhost:5432/rbac?schema=public';

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: databaseUrl,
  }),
});

const DEMO_MARKER = '[demo-seed]';

const roles = [
  { key: 'admin', name: 'Admin', level: 100 },
  { key: 'manager', name: 'Manager', level: 70 },
  { key: 'agent', name: 'Agent', level: 40 },
  { key: 'customer', name: 'Customer', level: 10 },
];

const permissions = [
  {
    key: 'page.dashboard.view',
    module: PermissionModule.DASHBOARD,
    type: PermissionType.PAGE,
    route: '/dashboard',
    label: 'Dashboard',
    description: 'Open the dashboard page',
  },
  {
    key: 'page.users.view',
    module: PermissionModule.USERS,
    type: PermissionType.PAGE,
    route: '/users',
    label: 'Users',
    description: 'Open the users page',
  },
  {
    key: 'page.permissions.view',
    module: PermissionModule.PERMISSIONS,
    type: PermissionType.PAGE,
    route: '/users/:id/permissions',
    label: 'Permission Editor',
    description: 'Open the per-user permission editor',
  },
  {
    key: 'page.leads.view',
    module: PermissionModule.LEADS,
    type: PermissionType.PAGE,
    route: '/leads',
    label: 'Leads',
    description: 'Open the leads page',
  },
  {
    key: 'page.tasks.view',
    module: PermissionModule.TASKS,
    type: PermissionType.PAGE,
    route: '/tasks',
    label: 'Tasks',
    description: 'Open the tasks page',
  },
  {
    key: 'page.reports.view',
    module: PermissionModule.REPORTS,
    type: PermissionType.PAGE,
    route: '/reports',
    label: 'Reports',
    description: 'Open the reports page',
  },
  {
    key: 'page.audit.view',
    module: PermissionModule.AUDIT,
    type: PermissionType.PAGE,
    route: '/audit-logs',
    label: 'Audit Logs',
    description: 'Open the audit log page',
  },
  {
    key: 'page.customer_portal.view',
    module: PermissionModule.PORTAL,
    type: PermissionType.PAGE,
    route: '/portal',
    label: 'Customer Portal',
    description: 'Open the customer portal page',
  },
  {
    key: 'page.settings.view',
    module: PermissionModule.SETTINGS,
    type: PermissionType.PAGE,
    route: '/settings',
    label: 'Settings',
    description: 'Open the settings page',
  },
  {
    key: 'users.create',
    module: PermissionModule.USERS,
    type: PermissionType.ACTION,
    route: null,
    label: 'Create Users',
    description: 'Create users inside allowed scope',
  },
  {
    key: 'users.read',
    module: PermissionModule.USERS,
    type: PermissionType.ACTION,
    route: null,
    label: 'Read Users',
    description: 'Read user records',
  },
  {
    key: 'users.update',
    module: PermissionModule.USERS,
    type: PermissionType.ACTION,
    route: null,
    label: 'Update Users',
    description: 'Update user records',
  },
  {
    key: 'users.suspend',
    module: PermissionModule.USERS,
    type: PermissionType.ACTION,
    route: null,
    label: 'Suspend Users',
    description: 'Suspend users',
  },
  {
    key: 'users.ban',
    module: PermissionModule.USERS,
    type: PermissionType.ACTION,
    route: null,
    label: 'Ban Users',
    description: 'Ban users',
  },
  {
    key: 'users.assign_manager',
    module: PermissionModule.USERS,
    type: PermissionType.ACTION,
    route: null,
    label: 'Assign Manager',
    description: 'Assign managers to users',
  },
  {
    key: 'users.assign_role',
    module: PermissionModule.USERS,
    type: PermissionType.ACTION,
    route: null,
    label: 'Assign Role',
    description: 'Assign roles to users',
  },
  {
    key: 'permissions.read',
    module: PermissionModule.PERMISSIONS,
    type: PermissionType.ACTION,
    route: null,
    label: 'Read Permissions',
    description: 'Read the permission catalog',
  },
  {
    key: 'permissions.assign',
    module: PermissionModule.PERMISSIONS,
    type: PermissionType.ACTION,
    route: null,
    label: 'Assign Permissions',
    description: 'Assign user permission overrides',
  },
  {
    key: 'permissions.revoke',
    module: PermissionModule.PERMISSIONS,
    type: PermissionType.ACTION,
    route: null,
    label: 'Revoke Permissions',
    description: 'Revoke user permission overrides',
  },
  {
    key: 'leads.create',
    module: PermissionModule.LEADS,
    type: PermissionType.ACTION,
    route: null,
    label: 'Create Leads',
    description: 'Create new leads',
  },
  {
    key: 'leads.read',
    module: PermissionModule.LEADS,
    type: PermissionType.ACTION,
    route: null,
    label: 'Read Leads',
    description: 'Read lead records',
  },
  {
    key: 'leads.update',
    module: PermissionModule.LEADS,
    type: PermissionType.ACTION,
    route: null,
    label: 'Update Leads',
    description: 'Update lead records',
  },
  {
    key: 'leads.assign',
    module: PermissionModule.LEADS,
    type: PermissionType.ACTION,
    route: null,
    label: 'Assign Leads',
    description: 'Assign leads to agents',
  },
  {
    key: 'leads.change_status',
    module: PermissionModule.LEADS,
    type: PermissionType.ACTION,
    route: null,
    label: 'Change Lead Status',
    description: 'Update lead status',
  },
  {
    key: 'leads.delete',
    module: PermissionModule.LEADS,
    type: PermissionType.ACTION,
    route: null,
    label: 'Delete Leads',
    description: 'Soft delete leads',
  },
  {
    key: 'tasks.create',
    module: PermissionModule.TASKS,
    type: PermissionType.ACTION,
    route: null,
    label: 'Create Tasks',
    description: 'Create new tasks',
  },
  {
    key: 'tasks.read',
    module: PermissionModule.TASKS,
    type: PermissionType.ACTION,
    route: null,
    label: 'Read Tasks',
    description: 'Read task records',
  },
  {
    key: 'tasks.update',
    module: PermissionModule.TASKS,
    type: PermissionType.ACTION,
    route: null,
    label: 'Update Tasks',
    description: 'Update task records',
  },
  {
    key: 'tasks.assign',
    module: PermissionModule.TASKS,
    type: PermissionType.ACTION,
    route: null,
    label: 'Assign Tasks',
    description: 'Assign tasks to agents',
  },
  {
    key: 'tasks.change_status',
    module: PermissionModule.TASKS,
    type: PermissionType.ACTION,
    route: null,
    label: 'Change Task Status',
    description: 'Update task status',
  },
  {
    key: 'tasks.delete',
    module: PermissionModule.TASKS,
    type: PermissionType.ACTION,
    route: null,
    label: 'Delete Tasks',
    description: 'Soft delete tasks',
  },
  {
    key: 'reports.read',
    module: PermissionModule.REPORTS,
    type: PermissionType.ACTION,
    route: null,
    label: 'Read Reports',
    description: 'Read reports',
  },
  {
    key: 'reports.export',
    module: PermissionModule.REPORTS,
    type: PermissionType.ACTION,
    route: null,
    label: 'Export Reports',
    description: 'Export reports',
  },
  {
    key: 'audit.read',
    module: PermissionModule.AUDIT,
    type: PermissionType.ACTION,
    route: null,
    label: 'Read Audit Logs',
    description: 'Read audit log records',
  },
  {
    key: 'portal.read_self',
    module: PermissionModule.PORTAL,
    type: PermissionType.ACTION,
    route: null,
    label: 'Read Own Portal',
    description: 'Read customer portal data',
  },
  {
    key: 'portal.update_self',
    module: PermissionModule.PORTAL,
    type: PermissionType.ACTION,
    route: null,
    label: 'Update Own Portal',
    description: 'Update customer portal profile',
  },
  {
    key: 'settings.read_self',
    module: PermissionModule.SETTINGS,
    type: PermissionType.ACTION,
    route: null,
    label: 'Read Own Settings',
    description: 'Read personal settings',
  },
  {
    key: 'settings.update_self',
    module: PermissionModule.SETTINGS,
    type: PermissionType.ACTION,
    route: null,
    label: 'Update Own Settings',
    description: 'Update personal settings',
  },
  {
    key: 'settings.read_app',
    module: PermissionModule.SETTINGS,
    type: PermissionType.ACTION,
    route: null,
    label: 'Read App Settings',
    description: 'Read app-level settings',
  },
  {
    key: 'settings.update_app',
    module: PermissionModule.SETTINGS,
    type: PermissionType.ACTION,
    route: null,
    label: 'Update App Settings',
    description: 'Update app-level settings',
  },
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

const userBlueprints = [
  {
    key: 'admin',
    id: '10000000-0000-4000-8000-000000000001',
    email: process.env.ADMIN_SEED_EMAIL || 'admin@rbac.local',
    password: process.env.ADMIN_SEED_PASSWORD || 'Admin123!',
    firstName: 'System',
    lastName: 'Admin',
    phone: '+1-555-0100',
    roleKey: 'admin',
    managerKey: null,
    status: UserStatus.ACTIVE,
    createdByKey: null,
    lastLoginAt: hoursAgo(6),
    userSetting: {
      timezone: 'UTC',
      locale: 'en',
      sidebarCollapsed: false,
    },
  },
  {
    key: 'manager-primary',
    id: '10000000-0000-4000-8000-000000000002',
    email: 'manager@rbac.local',
    password: 'Manager123!',
    firstName: 'Maya',
    lastName: 'Manager',
    phone: '+1-555-0101',
    roleKey: 'manager',
    managerKey: null,
    status: UserStatus.ACTIVE,
    createdByKey: 'admin',
    lastLoginAt: hoursAgo(3),
    userSetting: {
      timezone: 'Asia/Dhaka',
      locale: 'en-BD',
      sidebarCollapsed: false,
    },
  },
  {
    key: 'agent-primary',
    id: '10000000-0000-4000-8000-000000000003',
    email: 'agent@rbac.local',
    password: 'Agent123!',
    firstName: 'Ari',
    lastName: 'Agent',
    phone: '+1-555-0102',
    roleKey: 'agent',
    managerKey: 'manager-primary',
    status: UserStatus.ACTIVE,
    createdByKey: 'manager-primary',
    lastLoginAt: hoursAgo(2),
    userSetting: {
      timezone: 'Asia/Dhaka',
      locale: 'en',
      sidebarCollapsed: true,
    },
  },
  {
    key: 'customer-primary',
    id: '10000000-0000-4000-8000-000000000004',
    email: 'customer@rbac.local',
    password: 'Customer123!',
    firstName: 'Casey',
    lastName: 'Customer',
    phone: '+1-555-0103',
    roleKey: 'customer',
    managerKey: 'manager-primary',
    status: UserStatus.ACTIVE,
    createdByKey: 'manager-primary',
    lastLoginAt: hoursAgo(1),
    userSetting: {
      timezone: 'Europe/London',
      locale: 'en-GB',
      sidebarCollapsed: false,
    },
  },
  {
    key: 'manager-ops',
    id: '10000000-0000-4000-8000-000000000005',
    email: 'manager.ops@rbac.local',
    password: 'OpsManager123!',
    firstName: 'Owen',
    lastName: 'Operations',
    phone: '+1-555-0104',
    roleKey: 'manager',
    managerKey: null,
    status: UserStatus.ACTIVE,
    createdByKey: 'admin',
    lastLoginAt: daysAgo(1),
    userSetting: {
      timezone: 'America/New_York',
      locale: 'en-US',
      sidebarCollapsed: false,
    },
  },
  {
    key: 'agent-ops',
    id: '10000000-0000-4000-8000-000000000006',
    email: 'agent.ops@rbac.local',
    password: 'OpsAgent123!',
    firstName: 'Olivia',
    lastName: 'Ops',
    phone: '+1-555-0105',
    roleKey: 'agent',
    managerKey: 'manager-ops',
    status: UserStatus.ACTIVE,
    createdByKey: 'manager-ops',
    lastLoginAt: daysAgo(2),
    userSetting: {
      timezone: 'America/New_York',
      locale: 'en-US',
      sidebarCollapsed: true,
    },
  },
  {
    key: 'customer-ops',
    id: '10000000-0000-4000-8000-000000000007',
    email: 'customer.ops@rbac.local',
    password: 'OpsCustomer123!',
    firstName: 'Nadia',
    lastName: 'Northwind',
    phone: '+1-555-0106',
    roleKey: 'customer',
    managerKey: 'manager-ops',
    status: UserStatus.ACTIVE,
    createdByKey: 'manager-ops',
    lastLoginAt: daysAgo(4),
    userSetting: {
      timezone: 'America/Chicago',
      locale: 'en-US',
      sidebarCollapsed: false,
    },
  },
  {
    key: 'agent-paused',
    id: '10000000-0000-4000-8000-000000000008',
    email: 'agent.paused@rbac.local',
    password: 'PausedAgent123!',
    firstName: 'Peter',
    lastName: 'Paused',
    phone: '+1-555-0107',
    roleKey: 'agent',
    managerKey: 'manager-primary',
    status: UserStatus.SUSPENDED,
    createdByKey: 'manager-primary',
    lastLoginAt: daysAgo(8),
    userSetting: {
      timezone: 'Asia/Dhaka',
      locale: 'en',
      sidebarCollapsed: true,
    },
  },
  {
    key: 'customer-banned',
    id: '10000000-0000-4000-8000-000000000009',
    email: 'customer.banned@rbac.local',
    password: 'BannedCustomer123!',
    firstName: 'Bianca',
    lastName: 'Banned',
    phone: '+1-555-0108',
    roleKey: 'customer',
    managerKey: 'manager-primary',
    status: UserStatus.BANNED,
    createdByKey: 'manager-primary',
    lastLoginAt: daysAgo(16),
    userSetting: {
      timezone: 'Europe/Berlin',
      locale: 'de-DE',
      sidebarCollapsed: false,
    },
  },
];

const leadBlueprints = [
  {
    id: '20000000-0000-4000-8000-000000000001',
    name: 'Atlas Manufacturing Expansion',
    email: 'procurement@atlas.example.com',
    phone: '+1-800-201-1001',
    company: 'Atlas Manufacturing',
    source: 'website-demo-seed',
    status: LeadStatus.NEW,
    managerKey: 'manager-primary',
    assignedToKey: null,
    customerKey: null,
    createdByKey: 'manager-primary',
    updatedByKey: 'manager-primary',
    createdAt: daysAgo(6),
    updatedAt: daysAgo(6),
    deletedAt: null,
    notes: `${DEMO_MARKER} New inbound enterprise lead waiting for first outreach.`,
  },
  {
    id: '20000000-0000-4000-8000-000000000002',
    name: 'Bluebird Logistics Renewal',
    email: 'ops@bluebird.example.com',
    phone: '+1-800-201-1002',
    company: 'Bluebird Logistics',
    source: 'referral-demo-seed',
    status: LeadStatus.CONTACTED,
    managerKey: 'manager-primary',
    assignedToKey: 'agent-primary',
    customerKey: 'customer-primary',
    createdByKey: 'manager-primary',
    updatedByKey: 'agent-primary',
    createdAt: daysAgo(14),
    updatedAt: daysAgo(4),
    deletedAt: null,
    notes: `${DEMO_MARKER} Discovery call complete and proposal requested by the customer team.`,
  },
  {
    id: '20000000-0000-4000-8000-000000000003',
    name: 'Cedar Health Analytics Upgrade',
    email: 'technology@cedarhealth.example.com',
    phone: '+1-800-201-1003',
    company: 'Cedar Health',
    source: 'outbound-demo-seed',
    status: LeadStatus.QUALIFIED,
    managerKey: 'manager-primary',
    assignedToKey: 'agent-primary',
    customerKey: 'customer-primary',
    createdByKey: 'agent-primary',
    updatedByKey: 'agent-primary',
    createdAt: daysAgo(10),
    updatedAt: daysAgo(2),
    deletedAt: null,
    notes: `${DEMO_MARKER} Technical fit confirmed and solution design is in progress.`,
  },
  {
    id: '20000000-0000-4000-8000-000000000004',
    name: 'Delta Retail Support Retainer',
    email: 'it@deltaretail.example.com',
    phone: '+1-800-201-1004',
    company: 'Delta Retail',
    source: 'partner-demo-seed',
    status: LeadStatus.WON,
    managerKey: 'manager-primary',
    assignedToKey: 'agent-primary',
    customerKey: 'customer-primary',
    createdByKey: 'manager-primary',
    updatedByKey: 'agent-primary',
    createdAt: daysAgo(22),
    updatedAt: daysAgo(1),
    deletedAt: null,
    notes: `${DEMO_MARKER} Contract signed and handoff moved into delivery.`,
  },
  {
    id: '20000000-0000-4000-8000-000000000005',
    name: 'Elm Street Labs Migration',
    email: 'security@elmstreetlabs.example.com',
    phone: '+1-800-201-1005',
    company: 'Elm Street Labs',
    source: 'conference-demo-seed',
    status: LeadStatus.LOST,
    managerKey: 'manager-primary',
    assignedToKey: null,
    customerKey: 'customer-banned',
    createdByKey: 'manager-primary',
    updatedByKey: 'manager-primary',
    createdAt: daysAgo(30),
    updatedAt: daysAgo(12),
    deletedAt: null,
    notes: `${DEMO_MARKER} Lost to a competitor after the pricing round.`,
  },
  {
    id: '20000000-0000-4000-8000-000000000006',
    name: 'Northwind Commerce Rollout',
    email: 'delivery@northwind.example.com',
    phone: '+1-800-201-1006',
    company: 'Northwind Commerce',
    source: 'partner-demo-seed',
    status: LeadStatus.QUALIFIED,
    managerKey: 'manager-ops',
    assignedToKey: 'agent-ops',
    customerKey: 'customer-ops',
    createdByKey: 'manager-ops',
    updatedByKey: 'agent-ops',
    createdAt: daysAgo(9),
    updatedAt: daysAgo(3),
    deletedAt: null,
    notes: `${DEMO_MARKER} Secondary team lead so admin users can see cross-manager data.`,
  },
  {
    id: '20000000-0000-4000-8000-000000000007',
    name: 'Orchid Finance Legacy Cleanup',
    email: 'operations@orchidfinance.example.com',
    phone: '+1-800-201-1007',
    company: 'Orchid Finance',
    source: 'reactivation-demo-seed',
    status: LeadStatus.CONTACTED,
    managerKey: 'manager-primary',
    assignedToKey: 'agent-primary',
    customerKey: 'customer-primary',
    createdByKey: 'manager-primary',
    updatedByKey: 'manager-primary',
    createdAt: daysAgo(18),
    updatedAt: daysAgo(5),
    deletedAt: daysAgo(2),
    notes: `${DEMO_MARKER} Archived example lead to demonstrate soft deletes and related audit history.`,
  },
];

const taskBlueprints = [
  {
    id: '30000000-0000-4000-8000-000000000001',
    title: 'Send renewal proposal follow-up',
    description: `${DEMO_MARKER} Follow up with Bluebird after the initial proposal review meeting.`,
    status: TaskStatus.TODO,
    priority: TaskPriority.HIGH,
    dueAt: daysFromNow(2),
    assignedToKey: 'agent-primary',
    leadId: '20000000-0000-4000-8000-000000000002',
    customerKey: 'customer-primary',
    createdByKey: 'manager-primary',
    updatedByKey: 'manager-primary',
    createdAt: daysAgo(3),
    updatedAt: daysAgo(3),
    completedAt: null,
    deletedAt: null,
  },
  {
    id: '30000000-0000-4000-8000-000000000002',
    title: 'Collect integration requirements',
    description: `${DEMO_MARKER} Run a structured requirements workshop for Cedar Health.`,
    status: TaskStatus.IN_PROGRESS,
    priority: TaskPriority.HIGH,
    dueAt: daysFromNow(-1),
    assignedToKey: 'agent-primary',
    leadId: '20000000-0000-4000-8000-000000000003',
    customerKey: 'customer-primary',
    createdByKey: 'manager-primary',
    updatedByKey: 'agent-primary',
    createdAt: daysAgo(5),
    updatedAt: hoursAgo(12),
    completedAt: null,
    deletedAt: null,
  },
  {
    id: '30000000-0000-4000-8000-000000000003',
    title: 'Kick off onboarding checklist',
    description: `${DEMO_MARKER} Customer onboarding completed for the won Delta Retail deal.`,
    status: TaskStatus.DONE,
    priority: TaskPriority.MEDIUM,
    dueAt: daysAgo(7),
    assignedToKey: 'agent-primary',
    leadId: '20000000-0000-4000-8000-000000000004',
    customerKey: 'customer-primary',
    createdByKey: 'agent-primary',
    updatedByKey: 'agent-primary',
    createdAt: daysAgo(11),
    updatedAt: daysAgo(6),
    completedAt: daysAgo(6),
    deletedAt: null,
  },
  {
    id: '30000000-0000-4000-8000-000000000004',
    title: 'Prepare executive recap deck',
    description: `${DEMO_MARKER} Cancelled after the customer changed priorities this quarter.`,
    status: TaskStatus.CANCELLED,
    priority: TaskPriority.LOW,
    dueAt: daysAgo(2),
    assignedToKey: null,
    leadId: '20000000-0000-4000-8000-000000000001',
    customerKey: null,
    createdByKey: 'manager-primary',
    updatedByKey: 'manager-primary',
    createdAt: daysAgo(8),
    updatedAt: daysAgo(2),
    completedAt: null,
    deletedAt: null,
  },
  {
    id: '30000000-0000-4000-8000-000000000005',
    title: 'Review Northwind rollout plan',
    description: `${DEMO_MARKER} Secondary manager task for admin-level cross-team reporting.`,
    status: TaskStatus.TODO,
    priority: TaskPriority.MEDIUM,
    dueAt: daysFromNow(4),
    assignedToKey: 'agent-ops',
    leadId: '20000000-0000-4000-8000-000000000006',
    customerKey: 'customer-ops',
    createdByKey: 'manager-ops',
    updatedByKey: 'manager-ops',
    createdAt: daysAgo(2),
    updatedAt: daysAgo(2),
    completedAt: null,
    deletedAt: null,
  },
  {
    id: '30000000-0000-4000-8000-000000000006',
    title: 'Schedule success check-in call',
    description: `${DEMO_MARKER} Customer portal visible task not tied to a lead.`,
    status: TaskStatus.IN_PROGRESS,
    priority: TaskPriority.LOW,
    dueAt: daysFromNow(1),
    assignedToKey: 'agent-primary',
    leadId: null,
    customerKey: 'customer-primary',
    createdByKey: 'manager-primary',
    updatedByKey: 'agent-primary',
    createdAt: daysAgo(1),
    updatedAt: hoursAgo(8),
    completedAt: null,
    deletedAt: null,
  },
  {
    id: '30000000-0000-4000-8000-000000000007',
    title: 'Archive obsolete migration checklist',
    description: `${DEMO_MARKER} Soft-deleted task kept only for delete/audit examples.`,
    status: TaskStatus.TODO,
    priority: TaskPriority.LOW,
    dueAt: daysAgo(1),
    assignedToKey: 'agent-primary',
    leadId: '20000000-0000-4000-8000-000000000007',
    customerKey: 'customer-primary',
    createdByKey: 'manager-primary',
    updatedByKey: 'manager-primary',
    createdAt: daysAgo(4),
    updatedAt: daysAgo(2),
    completedAt: null,
    deletedAt: daysAgo(1),
  },
];

const auditLogBlueprints = [
  {
    id: '40000000-0000-4000-8000-000000000001',
    actorKey: 'admin',
    targetKey: 'manager-primary',
    module: 'users',
    action: 'create',
    entityType: 'user',
    entityKey: 'manager-primary',
    createdAt: daysAgo(20),
    metadata: {
      seedTag: DEMO_MARKER,
      summary: 'Admin created the first manager account.',
      roleKey: 'manager',
    },
  },
  {
    id: '40000000-0000-4000-8000-000000000002',
    actorKey: 'manager-primary',
    targetKey: 'agent-primary',
    module: 'users',
    action: 'create',
    entityType: 'user',
    entityKey: 'agent-primary',
    createdAt: daysAgo(19),
    metadata: {
      seedTag: DEMO_MARKER,
      summary: 'Manager onboarded a new agent to their team.',
      roleKey: 'agent',
    },
  },
  {
    id: '40000000-0000-4000-8000-000000000003',
    actorKey: 'manager-primary',
    targetKey: 'customer-primary',
    module: 'users',
    action: 'create',
    entityType: 'user',
    entityKey: 'customer-primary',
    createdAt: daysAgo(18),
    metadata: {
      seedTag: DEMO_MARKER,
      summary: 'Manager created a customer portal account.',
      roleKey: 'customer',
    },
  },
  {
    id: '40000000-0000-4000-8000-000000000004',
    actorKey: 'manager-primary',
    targetKey: 'agent-primary',
    module: 'permissions',
    action: 'override.replace',
    entityType: 'user_permission',
    entityKey: 'agent-primary',
    createdAt: daysAgo(7),
    metadata: {
      seedTag: DEMO_MARKER,
      summary: 'Manager granted reporting visibility to an agent.',
      overrides: [
        { permissionKey: 'page.reports.view', effect: 'allow' },
        { permissionKey: 'reports.read', effect: 'allow' },
      ],
    },
  },
  {
    id: '40000000-0000-4000-8000-000000000005',
    actorKey: 'manager-primary',
    targetKey: 'agent-primary',
    module: 'leads',
    action: 'assign',
    entityType: 'lead',
    entityId: '20000000-0000-4000-8000-000000000003',
    createdAt: daysAgo(6),
    metadata: {
      seedTag: DEMO_MARKER,
      summary: 'Qualified lead assigned to the primary agent.',
      leadName: 'Cedar Health Analytics Upgrade',
    },
  },
  {
    id: '40000000-0000-4000-8000-000000000006',
    actorKey: 'agent-primary',
    targetKey: 'customer-primary',
    module: 'leads',
    action: 'status.update',
    entityType: 'lead',
    entityId: '20000000-0000-4000-8000-000000000004',
    createdAt: daysAgo(1),
    metadata: {
      seedTag: DEMO_MARKER,
      summary: 'Won deal updated after contract signature.',
      nextStatus: 'won',
    },
  },
  {
    id: '40000000-0000-4000-8000-000000000007',
    actorKey: 'manager-primary',
    targetKey: 'agent-primary',
    module: 'tasks',
    action: 'create',
    entityType: 'task',
    entityId: '30000000-0000-4000-8000-000000000001',
    createdAt: daysAgo(3),
    metadata: {
      seedTag: DEMO_MARKER,
      summary: 'Manager created a high-priority follow-up task.',
      priority: 'high',
    },
  },
  {
    id: '40000000-0000-4000-8000-000000000008',
    actorKey: 'agent-primary',
    targetKey: 'customer-primary',
    module: 'tasks',
    action: 'status.update',
    entityType: 'task',
    entityId: '30000000-0000-4000-8000-000000000003',
    createdAt: daysAgo(6),
    metadata: {
      seedTag: DEMO_MARKER,
      summary: 'Agent completed a customer onboarding task.',
      nextStatus: 'done',
    },
  },
  {
    id: '40000000-0000-4000-8000-000000000009',
    actorKey: 'manager-primary',
    targetKey: 'agent-paused',
    module: 'users',
    action: 'status.update',
    entityType: 'user',
    entityKey: 'agent-paused',
    createdAt: daysAgo(5),
    metadata: {
      seedTag: DEMO_MARKER,
      summary: 'Manager suspended an inactive agent.',
      nextStatus: 'suspended',
    },
  },
  {
    id: '40000000-0000-4000-8000-000000000010',
    actorKey: 'admin',
    targetKey: null,
    module: 'settings',
    action: 'app.update',
    entityType: 'app_setting',
    entityId: null,
    createdAt: daysAgo(2),
    metadata: {
      seedTag: DEMO_MARKER,
      summary: 'Admin refreshed global support and identity settings.',
      settingKey: 'app.identity',
    },
  },
  {
    id: '40000000-0000-4000-8000-000000000011',
    actorKey: 'customer-primary',
    targetKey: 'customer-primary',
    module: 'portal',
    action: 'profile.update',
    entityType: 'user',
    entityKey: 'customer-primary',
    createdAt: hoursAgo(20),
    metadata: {
      seedTag: DEMO_MARKER,
      summary: 'Customer updated their own contact phone number.',
    },
  },
  {
    id: '40000000-0000-4000-8000-000000000012',
    actorKey: 'manager-primary',
    targetKey: null,
    module: 'leads',
    action: 'delete',
    entityType: 'lead',
    entityId: '20000000-0000-4000-8000-000000000007',
    createdAt: daysAgo(2),
    metadata: {
      seedTag: DEMO_MARKER,
      summary: 'Manager archived an outdated lead record.',
    },
  },
];

const userOverrideBlueprints = [
  {
    userKey: 'agent-primary',
    permissionKey: 'page.reports.view',
    effect: PermissionEffect.ALLOW,
    grantedByKey: 'manager-primary',
    expiresAt: daysFromNow(30),
  },
  {
    userKey: 'agent-primary',
    permissionKey: 'reports.read',
    effect: PermissionEffect.ALLOW,
    grantedByKey: 'manager-primary',
    expiresAt: daysFromNow(30),
  },
  {
    userKey: 'manager-primary',
    permissionKey: 'reports.export',
    effect: PermissionEffect.DENY,
    grantedByKey: 'admin',
    expiresAt: null,
  },
];

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function hoursAgo(hours) {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

function daysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function daysFromNow(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

async function seedRolesAndPermissions() {
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

  const roleIdByKey = Object.fromEntries(
    dbRoles.map((role) => [role.key, role.id]),
  );
  const permissionIdByKey = Object.fromEntries(
    dbPermissions.map((permission) => [permission.key, permission.id]),
  );

  await prisma.rolePermission.deleteMany({});

  await prisma.rolePermission.createMany({
    data: Object.entries(rolePermissionKeys).flatMap(
      ([roleKey, permissionKeys]) =>
        permissionKeys.map((permissionKey) => ({
          roleId: roleIdByKey[roleKey],
          permissionId: permissionIdByKey[permissionKey],
        })),
    ),
    skipDuplicates: true,
  });

  return { roleIdByKey, permissionIdByKey };
}

async function seedUsers(roleIdByKey) {
  const usersByKey = {};

  for (const blueprint of userBlueprints) {
    const user = await prisma.user.upsert({
      where: { email: blueprint.email },
      update: {
        firstName: blueprint.firstName,
        lastName: blueprint.lastName,
        phone: blueprint.phone,
        roleId: roleIdByKey[blueprint.roleKey],
        managerId: blueprint.managerKey
          ? usersByKey[blueprint.managerKey].id
          : null,
        status: blueprint.status,
        mustChangePassword: false,
        passwordHash: hashPassword(blueprint.password),
        createdBy: blueprint.createdByKey
          ? usersByKey[blueprint.createdByKey].id
          : null,
        lastLoginAt: blueprint.lastLoginAt,
        suspendedAt:
          blueprint.status === UserStatus.SUSPENDED ? daysAgo(5) : null,
        bannedAt: blueprint.status === UserStatus.BANNED ? daysAgo(16) : null,
      },
      create: {
        id: blueprint.id,
        email: blueprint.email,
        passwordHash: hashPassword(blueprint.password),
        firstName: blueprint.firstName,
        lastName: blueprint.lastName,
        phone: blueprint.phone,
        roleId: roleIdByKey[blueprint.roleKey],
        managerId: blueprint.managerKey
          ? usersByKey[blueprint.managerKey].id
          : null,
        status: blueprint.status,
        mustChangePassword: false,
        createdBy: blueprint.createdByKey
          ? usersByKey[blueprint.createdByKey].id
          : null,
        lastLoginAt: blueprint.lastLoginAt,
        suspendedAt:
          blueprint.status === UserStatus.SUSPENDED ? daysAgo(5) : null,
        bannedAt: blueprint.status === UserStatus.BANNED ? daysAgo(16) : null,
      },
    });

    usersByKey[blueprint.key] = user;

    await prisma.userSetting.upsert({
      where: { userId: user.id },
      update: blueprint.userSetting,
      create: {
        userId: user.id,
        ...blueprint.userSetting,
      },
    });
  }

  return usersByKey;
}

async function seedUserOverrides(usersByKey, permissionIdByKey) {
  await prisma.userPermission.deleteMany({
    where: {
      userId: {
        in: userOverrideBlueprints.map(
          (override) => usersByKey[override.userKey].id,
        ),
      },
    },
  });

  await prisma.userPermission.createMany({
    data: userOverrideBlueprints.map((override) => ({
      userId: usersByKey[override.userKey].id,
      permissionId: permissionIdByKey[override.permissionKey],
      effect: override.effect,
      grantedBy: usersByKey[override.grantedByKey].id,
      expiresAt: override.expiresAt,
    })),
  });

  const overrideCountByUserId = userOverrideBlueprints.reduce(
    (accumulator, override) => {
      const userId = usersByKey[override.userKey].id;
      accumulator[userId] = (accumulator[userId] || 0) + 1;
      return accumulator;
    },
    {},
  );

  for (const user of Object.values(usersByKey)) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        permissionVersion: overrideCountByUserId[user.id] ? 2 : 1,
      },
    });
  }
}

async function seedAppSettings(usersByKey) {
  const adminId = usersByKey.admin.id;

  const appSettings = [
    {
      key: 'app.identity',
      value: {
        name: 'RBAC System Demo Workspace',
        supportEmail: userBlueprints.find((user) => user.key === 'admin').email,
        supportPhone: '+1-555-0199',
        primaryColor: '#1f6feb',
      },
    },
    {
      key: 'auth.policy',
      value: {
        accessTokenMinutes: 15,
        refreshTokenDays: 7,
        loginLockWindowMinutes: 15,
        loginMaxAttempts: 5,
      },
    },
    {
      key: 'dashboard.preferences',
      value: {
        defaultDateRange: '30d',
        showRecentAuditCard: true,
        highlightOverdueTasks: true,
      },
    },
    {
      key: 'lead.pipeline',
      value: {
        statuses: ['new', 'contacted', 'qualified', 'won', 'lost'],
        defaultOwnerRole: 'manager',
        scoringEnabled: false,
      },
    },
  ];

  for (const setting of appSettings) {
    await prisma.appSetting.upsert({
      where: { key: setting.key },
      update: {
        value: setting.value,
        updatedBy: adminId,
      },
      create: {
        key: setting.key,
        value: setting.value,
        updatedBy: adminId,
      },
    });
  }
}

async function seedLeads(usersByKey) {
  for (const lead of leadBlueprints) {
    await prisma.lead.upsert({
      where: { id: lead.id },
      update: {
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        company: lead.company,
        source: lead.source,
        status: lead.status,
        managerId: usersByKey[lead.managerKey].id,
        assignedToUserId: lead.assignedToKey
          ? usersByKey[lead.assignedToKey].id
          : null,
        customerId: lead.customerKey ? usersByKey[lead.customerKey].id : null,
        notes: lead.notes,
        createdBy: usersByKey[lead.createdByKey].id,
        updatedBy: usersByKey[lead.updatedByKey].id,
        createdAt: lead.createdAt,
        updatedAt: lead.updatedAt,
        deletedAt: lead.deletedAt,
      },
      create: {
        id: lead.id,
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        company: lead.company,
        source: lead.source,
        status: lead.status,
        managerId: usersByKey[lead.managerKey].id,
        assignedToUserId: lead.assignedToKey
          ? usersByKey[lead.assignedToKey].id
          : null,
        customerId: lead.customerKey ? usersByKey[lead.customerKey].id : null,
        notes: lead.notes,
        createdBy: usersByKey[lead.createdByKey].id,
        updatedBy: usersByKey[lead.updatedByKey].id,
        createdAt: lead.createdAt,
        updatedAt: lead.updatedAt,
        deletedAt: lead.deletedAt,
      },
    });
  }
}

async function seedTasks(usersByKey) {
  for (const task of taskBlueprints) {
    await prisma.task.upsert({
      where: { id: task.id },
      update: {
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        dueAt: task.dueAt,
        assignedToUserId: task.assignedToKey
          ? usersByKey[task.assignedToKey].id
          : null,
        leadId: task.leadId,
        customerId: task.customerKey ? usersByKey[task.customerKey].id : null,
        createdBy: usersByKey[task.createdByKey].id,
        updatedBy: usersByKey[task.updatedByKey].id,
        completedAt: task.completedAt,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        deletedAt: task.deletedAt,
      },
      create: {
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        dueAt: task.dueAt,
        assignedToUserId: task.assignedToKey
          ? usersByKey[task.assignedToKey].id
          : null,
        leadId: task.leadId,
        customerId: task.customerKey ? usersByKey[task.customerKey].id : null,
        createdBy: usersByKey[task.createdByKey].id,
        updatedBy: usersByKey[task.updatedByKey].id,
        completedAt: task.completedAt,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        deletedAt: task.deletedAt,
      },
    });
  }
}

async function seedAuditLogs(usersByKey) {
  for (const auditLog of auditLogBlueprints) {
    const resolvedEntityId =
      auditLog.entityId ||
      (auditLog.entityKey ? usersByKey[auditLog.entityKey].id : null);

    await prisma.auditLog.upsert({
      where: { id: auditLog.id },
      update: {
        actorUserId: usersByKey[auditLog.actorKey].id,
        targetUserId: auditLog.targetKey
          ? usersByKey[auditLog.targetKey].id
          : null,
        module: auditLog.module,
        action: auditLog.action,
        entityType: auditLog.entityType,
        entityId: resolvedEntityId,
        metadata: auditLog.metadata,
        ipAddress: '127.0.0.1',
        userAgent: 'demo-seed-script/1.0',
        createdAt: auditLog.createdAt,
      },
      create: {
        id: auditLog.id,
        actorUserId: usersByKey[auditLog.actorKey].id,
        targetUserId: auditLog.targetKey
          ? usersByKey[auditLog.targetKey].id
          : null,
        module: auditLog.module,
        action: auditLog.action,
        entityType: auditLog.entityType,
        entityId: resolvedEntityId,
        metadata: auditLog.metadata,
        ipAddress: '127.0.0.1',
        userAgent: 'demo-seed-script/1.0',
        createdAt: auditLog.createdAt,
      },
    });
  }
}

async function main() {
  const { roleIdByKey, permissionIdByKey } = await seedRolesAndPermissions();
  const usersByKey = await seedUsers(roleIdByKey);

  await seedUserOverrides(usersByKey, permissionIdByKey);
  await seedAppSettings(usersByKey);
  await seedLeads(usersByKey);
  await seedTasks(usersByKey);
  await seedAuditLogs(usersByKey);

  const [userCount, leadCount, taskCount, auditCount] = await Promise.all([
    prisma.user.count(),
    prisma.lead.count({ where: { deletedAt: null } }),
    prisma.task.count({ where: { deletedAt: null } }),
    prisma.auditLog.count(),
  ]);

  console.log('Seed complete.');
  console.log('Primary demo logins:');
  console.log(
    `- Admin: ${usersByKey.admin.email} / ${userBlueprints.find((user) => user.key === 'admin').password}`,
  );
  console.log('- Manager: manager@rbac.local / Manager123!');
  console.log('- Agent: agent@rbac.local / Agent123!');
  console.log('- Customer: customer@rbac.local / Customer123!');
  console.log('Additional seeded examples:');
  console.log('- Secondary manager/team for admin-only cross-scope data');
  console.log('- Suspended agent and banned customer for status filtering');
  console.log('- Leads across every status plus soft-deleted examples');
  console.log('- Tasks across every status and priority plus overdue work');
  console.log(
    `Current counts => users: ${userCount}, active leads: ${leadCount}, active tasks: ${taskCount}, audit logs: ${auditCount}`,
  );
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
