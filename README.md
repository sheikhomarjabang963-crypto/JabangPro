# JabangPro

A multi-business POS, inventory and business-management SaaS for SMEs in The Gambia.
React 18 + Vite 6, plain CSS, `@supabase/supabase-js`. No suppliers, no tax, branches are optional
(a default branch is created automatically for every approved business).

## What's implemented

- Supabase Auth (email/password) with automatic profile creation on signup.
- Super Admin area: review/approve/reject business applications, suspend/reactivate businesses.
- Business onboarding: authenticated users submit a request; approval creates the business,
  a default branch, business settings, and an Owner membership, with a 7-day trial.
- Roles: Owner (full access), Manager (owner-configurable, per-module permissions — nothing
  by default), Cashier (POS/sales only, no cost/profit/expense data at any layer).
- Dashboard (real sales/expenses/credit/low-stock summary for Owner/Manager-with-reports;
  a safe "my sales" view for everyone else).
- POS, Products (with categories), Inventory, Customers, Sales (with void/return), Purchases
  (no supplier field), Expenses, Settings (business profile + staff/permission management).
- All financial writes (sales, purchases, returns, voids, inventory adjustments, expenses) go
  through atomic SECURITY DEFINER RPCs in Postgres, never direct table writes from the client.
- RLS on every table, enforced and tested directly against the live Supabase project — not just
  hidden in the UI.

## Run locally

```bash
npm install
npm run dev
```

`.env` already has real `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` for the JabangPro Supabase
project. `.env` is gitignored — don't commit it.

## First-time use

1. Sign up as the first user — that account should be promoted manually to Super Admin
   (`insert into super_admins (user_id) values ('<their profile id>');` in the Supabase SQL editor;
   there is no UI path to create a Super Admin, by design).
2. Sign up a second account and submit a business application from the app.
3. Sign in as the Super Admin and approve it. The applicant becomes the Owner of a new trial
   business with a default branch.
4. As Owner, add products/categories, then staff (Manager/Cashier) from Settings, granting a
   Manager only the modules they need.

## Database

`supabase/schema.sql` is the schema currently applied to the live JabangPro Supabase project —
tables, RLS policies, triggers and RPCs. Re-running it is safe (`create table if not exists`,
`create or replace function`) but grants (`grant ... to authenticated`) were applied as a
separate migration and are not repeated in this file; see the Supabase project's migration
history for the full applied set.

## Not yet built

Barcode scanning, product images (Storage), printed receipts, and Vercel deployment — intentionally
left for a later pass, per the current build plan.
