# AUTH FLOWS

## 1) Signup
1. User submits `/register` form.
2. `signupAction` calls Supabase `auth.signUp` with email confirmation redirect to `/auth/callback`.
3. On confirmation, callback exchanges code for session.

## 2) Login
1. User submits `/login` form.
2. `loginAction` calls `auth.signInWithPassword`.
3. Session token hash stored in `auth_sessions`.
4. `auth.login` audit event written to `audit_logs`.

## 3) Logout
1. User submits sign-out form in dashboard header.
2. `logoutAction` revokes active rows in `auth_sessions` and calls `auth.signOut`.
3. `auth.logout` audit event written.

## 4) Password reset
1. User requests reset from `/forgot-password`.
2. Supabase sends recovery link to `/auth/callback?next=/reset-password`.
3. User sets new password on `/reset-password`.
4. `auth.password_reset` audit event written.

## 5) Permission change
1. Admin submits role change from `/admin` or POST `/api/v1/admin/permissions`.
2. Request validated with Zod.
3. Guard enforces `admin:manage_permissions`.
4. `user_role_assignments` updated and permission audit event written.
