export const SIDEBAR_ITEMS = [
  {
    label: 'Dashboard',
    path: '/dashboard',
    permission: 'page.dashboard.view',
  },
  {
    label: 'Users',
    path: '/users',
    permission: 'page.users.view',
  },
  {
    label: 'Leads',
    path: '/leads',
    permission: 'page.leads.view',
  },
  {
    label: 'Tasks',
    path: '/tasks',
    permission: 'page.tasks.view',
  },
  {
    label: 'Reports',
    path: '/reports',
    permission: 'page.reports.view',
  },
  {
    label: 'Audit Logs',
    path: '/audit-logs',
    permission: 'page.audit.view',
  },
  {
    label: 'Customer Portal',
    path: '/portal',
    permission: 'page.customer_portal.view',
  },
  {
    label: 'Settings',
    path: '/settings',
    permission: 'page.settings.view',
  },
] as const;
