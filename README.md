# RBAC Backend Status

## Current State

This backend is now structured around the RBAC blueprint and currently includes:

- core NestJS domain modules for auth, access control, users, leads, tasks, reports, audit logs, customer portal, settings, dashboard, common, and database
- Prisma 7 database setup with PostgreSQL datasource config moved into `prisma.config.ts`
- a full RBAC-oriented schema with roles, permissions, users, user permission overrides, refresh sessions, login attempts, audit logs, leads, tasks, user settings, and app settings
- auth route implementation for login, refresh, logout, current user, route context, session listing, and session revocation
- shared backend infrastructure for permission checks, scope checks, audit metadata, request context middleware, and request validation

## Checkpoint Commits

- `5cdcb1b` `complete necessary modules creation`
- `4a7880c` `complete necessary database schema setup`
- `44b852d` `complete necessary auth routes setup`
- `63796c8` `complete necessary middleware setup`
- `ffd7698` `complete necessary users and access control setup`
- `bb6bd47` `complete necessary dashboard leads tasks setup`

## Implemented Module Status

| Module | Status | Notes |
|--------|--------|-------|
| `AuthModule` | implemented | Controller, service, DTO, access-token guard, token utilities |
| `AccessControlModule` | implemented | Resolved permissions, routes, sidebar item derivation |
| `DatabaseModule` | implemented | Prisma service using Prisma 7 + `@prisma/adapter-pg` |
| `CommonModule` | implemented | Request context middleware, permission guard, scope guard, audit interceptor |
| `UsersModule` | implemented | list, create, detail, update, status, manager assignment, activity |
| `DashboardModule` | implemented | summary and recent activity endpoints |
| `LeadsModule` | implemented | list, create, detail, update, status, assign, soft delete |
| `TasksModule` | implemented | list, create, detail, update, status, assign, soft delete |
| `ReportsModule` | scaffolded | no endpoints yet |
| `AuditLogsModule` | scaffolded | no read endpoints yet |
| `CustomerPortalModule` | scaffolded | no endpoints yet |
| `SettingsModule` | scaffolded | no endpoints yet |

## Runtime Infrastructure

### Global app behavior

- API prefix: `/api/v1`
- cookie parsing enabled in `src/main.ts`
- global validation pipe enabled with whitelist, transform, and forbid-non-whitelisted
- Prisma service bootstrapped on application startup

### Shared request infrastructure

- `RequestContextMiddleware` attaches `requestId`, `ipAddress`, `userAgent`, and `startedAt`
- `PermissionGuard` checks `@RequirePermissions(...)` metadata against resolved permissions
- `ScopeGuard` checks `@RouteScope(...)` metadata for `self`, `team`, `team_or_self`, and `global`
- `AuditLogInterceptor` writes audit log records when `@AuditAction(...)` metadata is present
- `ActorContextService` centralizes actor role checks and scoped Prisma filters

### Access resolution behavior

Resolved permission logic currently works as:

`role_permissions + active allow overrides - active deny overrides`

What it returns:

- full permission list
- separated page permissions and action permissions
- allowed routes for frontend middleware usage
- dynamic sidebar items for the frontend shell
- current user role and settings snapshot

## Database Design Status

### Implemented files

- Prisma schema: `prisma/schema.prisma`
- Prisma config: `prisma.config.ts`
- Seed script: `prisma/seed.cjs`
- Environment template: `.env.example`

### Prisma 7 setup decision

This project uses the latest Prisma pattern:

- `datasource` URL is defined in `prisma.config.ts`, not inside `prisma/schema.prisma`
- runtime database connection uses `PrismaPg` from `@prisma/adapter-pg`
- Prisma client is still generated via `prisma-client-js` for compatibility with the current NestJS CommonJS setup

### Seed behavior

The seed script currently:

- creates the four system roles: `admin`, `manager`, `agent`, `customer`
- creates page and action permission atoms
- assigns baseline role permissions
- creates a seeded admin account from env values
- creates initial `user_settings` and `app_settings`

## Auth Endpoint Status

All current auth routes live in `src/auth/auth.controller.ts`.

| Method | Path | Status | Guard | Purpose |
|--------|------|--------|-------|---------|
| `POST` | `/api/v1/auth/login` | implemented | public | validates credentials, applies brute-force protection, issues access token, sets refresh cookie |
| `POST` | `/api/v1/auth/refresh` | implemented | public by refresh cookie | rotates refresh token, updates session hash, returns new access token |
| `POST` | `/api/v1/auth/logout` | implemented | `AccessTokenGuard` | revokes current refresh session and clears cookie |
| `POST` | `/api/v1/auth/logout-all` | implemented | `AccessTokenGuard` | revokes all active refresh sessions for current user |
| `GET` | `/api/v1/auth/me` | implemented | `AccessTokenGuard` | returns current user snapshot, permissions, routes, sidebar items, current session id |
| `GET` | `/api/v1/auth/route-context` | implemented | optional token/cookie context | returns lightweight auth and page-route context for frontend middleware |
| `GET` | `/api/v1/auth/sessions` | implemented | `AccessTokenGuard` | returns active sessions for current user |
| `DELETE` | `/api/v1/auth/sessions/:id` | implemented | `AccessTokenGuard` | revokes one session by id |

## Current Auth Rules

- access token secret comes from `JWT_ACCESS_SECRET`
- refresh token secret comes from `JWT_REFRESH_SECRET`
- access token TTL defaults to `15m`
- refresh token TTL defaults to `7d`
- refresh token is stored in an `httpOnly` cookie
- refresh sessions are stored in the database with hashed refresh tokens only
- suspended and banned users are blocked during auth checks
- login attempts are tracked in `login_attempts`
- lockout currently applies after 5 failed attempts in a 15 minute window

## Endpoint Responsibility Map

### Auth endpoints

- `login`: credential verification, failed-attempt tracking, session creation, token issuing
- `refresh`: refresh-token verification, session validation, token rotation
- `logout`: current session revocation
- `logout-all`: revoke all sessions for current user
- `me`: frontend bootstrap payload for current authenticated user
- `route-context`: frontend middleware-safe route permission payload
- `sessions`: list active sessions
- `sessions/:id`: revoke a single session

### Users endpoints

- `GET /api/v1/users`: scoped paginated user list with search, role, status, and manager filters
- `POST /api/v1/users`: create user inside actor role and manager scope
- `GET /api/v1/users/:id`: get one scoped user record
- `PATCH /api/v1/users/:id`: update user profile, role, and manager assignment data
- `PATCH /api/v1/users/:id/status`: activate, suspend, or ban a scoped user
- `PATCH /api/v1/users/:id/manager`: assign or clear a scoped manager
- `GET /api/v1/users/:id/activity`: return audit activity linked to that user

### Access control endpoints

- `GET /api/v1/access/catalog`: full permission catalog grouped by module
- `GET /api/v1/access/grantable`: permissions current actor is allowed to grant
- `GET /api/v1/access/roles`: roles with baseline role permissions
- `GET /api/v1/access/users/:id`: target user resolved access profile and overrides
- `PUT /api/v1/access/users/:id`: replace user-level permission overrides and bump permission version

### Dashboard endpoints

- `GET /api/v1/dashboard/summary`: role-scoped summary counts and highlights
- `GET /api/v1/dashboard/activity`: scoped recent audit activity feed

### Leads endpoints

- `GET /api/v1/leads`: scoped paginated lead list with search and filters
- `POST /api/v1/leads`: create a lead within actor manager scope
- `GET /api/v1/leads/:id`: get one scoped lead
- `PATCH /api/v1/leads/:id`: update lead fields
- `PATCH /api/v1/leads/:id/status`: change lead status
- `PATCH /api/v1/leads/:id/assign`: assign lead to a scoped agent
- `DELETE /api/v1/leads/:id`: soft delete lead

### Tasks endpoints

- `GET /api/v1/tasks`: scoped paginated task list with search and filters
- `POST /api/v1/tasks`: create task with scoped relations
- `GET /api/v1/tasks/:id`: get one scoped task
- `PATCH /api/v1/tasks/:id`: update task fields
- `PATCH /api/v1/tasks/:id/status`: change task status and `completedAt`
- `PATCH /api/v1/tasks/:id/assign`: assign task to a scoped agent
- `DELETE /api/v1/tasks/:id`: soft delete task

### Shared non-route responsibilities

- `AccessControlService`: resolve role permissions + user overrides into effective access
- `UsersService`: scoped user CRUD and manager/status management
- `DashboardService`: scoped summary counters and recent activity aggregation
- `LeadsService`: scoped lead CRUD, status, assignment, and archive handling
- `TasksService`: scoped task CRUD, status, assignment, and archive handling
- `PrismaService`: Prisma 7 adapter-backed DB client
- `ActorContextService`: reusable scope rules for admin, manager, agent, and customer access
- `PermissionGuard`: action-level permission enforcement helper
- `ScopeGuard`: scope enforcement helper for self/team/global access
- `AuditLogInterceptor`: append-only audit write helper

## Decorators And Guards Ready To Use

These are implemented and ready for the next modules:

- `@RequirePermissions(...permissions)`
- `@RequireAnyPermissions(...permissions)`
- `@RouteScope(scope)`
- `@AuditAction({...})`
- `@CurrentAuthUser()`
- `AccessTokenGuard`
- `PermissionGuard`
- `ScopeGuard`

Recommended usage example for the next user endpoints:

```ts
@UseGuards(AccessTokenGuard, PermissionGuard, ScopeGuard)
@RequirePermissions('users.read')
@RouteScope('team_or_self')
@Get('users/:id')
getUser() {}
```

## Implemented Endpoint Matrix

| Module | Endpoint | Status |
|--------|----------|--------|
| Auth | `POST /api/v1/auth/login` | implemented |
| Auth | `POST /api/v1/auth/refresh` | implemented |
| Auth | `POST /api/v1/auth/logout` | implemented |
| Auth | `POST /api/v1/auth/logout-all` | implemented |
| Auth | `GET /api/v1/auth/me` | implemented |
| Auth | `GET /api/v1/auth/route-context` | implemented |
| Auth | `GET /api/v1/auth/sessions` | implemented |
| Auth | `DELETE /api/v1/auth/sessions/:id` | implemented |
| Users | `GET /api/v1/users` | implemented |
| Users | `POST /api/v1/users` | implemented |
| Users | `GET /api/v1/users/:id` | implemented |
| Users | `PATCH /api/v1/users/:id` | implemented |
| Users | `PATCH /api/v1/users/:id/status` | implemented |
| Users | `PATCH /api/v1/users/:id/manager` | implemented |
| Users | `GET /api/v1/users/:id/activity` | implemented |
| Access | `GET /api/v1/access/catalog` | implemented |
| Access | `GET /api/v1/access/grantable` | implemented |
| Access | `GET /api/v1/access/roles` | implemented |
| Access | `GET /api/v1/access/users/:id` | implemented |
| Access | `PUT /api/v1/access/users/:id` | implemented |
| Dashboard | `GET /api/v1/dashboard/summary` | implemented |
| Dashboard | `GET /api/v1/dashboard/activity` | implemented |
| Leads | `GET /api/v1/leads` | implemented |
| Leads | `POST /api/v1/leads` | implemented |
| Leads | `GET /api/v1/leads/:id` | implemented |
| Leads | `PATCH /api/v1/leads/:id` | implemented |
| Leads | `PATCH /api/v1/leads/:id/status` | implemented |
| Leads | `PATCH /api/v1/leads/:id/assign` | implemented |
| Leads | `DELETE /api/v1/leads/:id` | implemented |
| Tasks | `GET /api/v1/tasks` | implemented |
| Tasks | `POST /api/v1/tasks` | implemented |
| Tasks | `GET /api/v1/tasks/:id` | implemented |
| Tasks | `PATCH /api/v1/tasks/:id` | implemented |
| Tasks | `PATCH /api/v1/tasks/:id/status` | implemented |
| Tasks | `PATCH /api/v1/tasks/:id/assign` | implemented |
| Tasks | `DELETE /api/v1/tasks/:id` | implemented |

## What Is Not Implemented Yet

The following API areas are still pending:

- reports endpoints
- audit log read endpoints
- customer portal endpoints
- settings endpoints

## Current Backend File Map

- `src/auth/auth.controller.ts` - implemented auth endpoints
- `src/auth/auth.service.ts` - login, refresh, logout, session, and token logic
- `src/auth/guards/access-token.guard.ts` - bearer token guard
- `src/access-control/access-control.service.ts` - resolved permission and sidebar builder
- `src/access-control/access-control.controller.ts` - permission catalog, grantable, role, and user override routes
- `src/users/users.controller.ts` - scoped user CRUD endpoints
- `src/users/users.service.ts` - user CRUD, status, manager assignment, activity
- `src/dashboard/dashboard.controller.ts` - dashboard summary and recent activity
- `src/dashboard/dashboard.service.ts` - dashboard aggregations
- `src/leads/leads.controller.ts` - scoped lead endpoints
- `src/leads/leads.service.ts` - lead CRUD, assignment, and status logic
- `src/tasks/tasks.controller.ts` - scoped task endpoints
- `src/tasks/tasks.service.ts` - task CRUD, assignment, and status logic
- `src/database/prisma.service.ts` - Prisma 7 runtime adapter setup
- `src/common/common.module.ts` - shared infrastructure wiring
- `src/common/guards/permission.guard.ts` - permission metadata guard
- `src/common/guards/scope.guard.ts` - scope metadata guard
- `src/common/interceptors/audit-log.interceptor.ts` - audit writer interceptor
- `src/common/middleware/request-context.middleware.ts` - request metadata middleware
- `src/common/services/actor-context.service.ts` - actor scope helper service
- `prisma/schema.prisma` - database schema
- `prisma/seed.cjs` - roles, permissions, and admin seed
- `prisma.config.ts` - Prisma 7 datasource configuration

## Recommended Next Build Order

1. implement `ReportsModule`
2. implement `AuditLogsModule`
3. implement `CustomerPortalModule`
4. implement `SettingsModule`

## Quick Start Commands

```bash
npm install
npm run prisma:validate
npx prisma generate
npm run build
```

If you want DB migration and seed locally:

```bash
npx prisma migrate dev
npx prisma db seed
```
