# Deploy Tradeline to production

Step-by-step guide to take this repo from GitHub → live SaaS on the internet. **No engineering background required.** Total time: ~30 minutes. Total cost: ~$18/year (domain only).

> The same checklist lives inside the app at [/app/launch](https://tradelineos.com/app/launch) once you're deployed — but you can't see that until you deploy, so this file is the bootstrap.

---

## Prerequisites

- The repo is pushed: ✓ https://github.com/KWanus/tradeline.io
- You have an Anthropic API key with credits (already set up locally in `apps/web/.env.local`)
- Free accounts on:
  - [vercel.com](https://vercel.com) (deploy host)
  - [resend.com](https://resend.com) (transactional email — free tier covers ~3k/mo)

That's it. **You do not need a custom domain to start** — Vercel gives you a free `*.vercel.app` URL.

---

## Step 1 — Deploy to Vercel (5 minutes)

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click **Import** next to `KWanus/tradeline.io`
3. In the import screen, expand the **Root Directory** option and click **Edit** → select `apps/web`
4. Leave Framework Preset = **Next.js** (auto-detected)
5. Expand **Environment Variables** and add these two now (the rest comes later):
   - `ANTHROPIC_API_KEY` = `sk-ant-api03-...` (your key from `apps/web/.env.local`)
   - `NEXT_PUBLIC_USER_EMAIL` = your email (shown in the top-bar profile chip)
6. Click **Deploy**

Wait ~90 seconds. You'll get a URL like `https://tradeline-io-abc123.vercel.app`. Open it. The app should render in dark mode with the new amber-pink gradient.

**What works now:** every page renders, Tradeline AI works (you have the key), but the radar will show whatever was in `data/output/radar_snapshot.json` at the last commit (4 days old). The cron isn't running yet.

---

## Step 2 — Wire the data cron (5 minutes)

This is what makes the radar refresh every 6 hours.

1. Go to https://github.com/KWanus/tradeline.io/actions
2. If you see a prompt **"Workflows aren't being run on this repository"** — click **I understand my workflows, go ahead and enable them**
3. Open **Settings** → **Secrets and variables** → **Actions** → **New repository secret**
4. Add this secret:
   - Name: `TRADELINE_SEC_UA`
   - Value: `Tradeline workers your-email@example.com` (SEC requires a contact email in their User-Agent header — use a real address you check)
5. Go back to Actions, click **workers** in the left sidebar, click **Run workflow** → **Run workflow** (this triggers it once manually so you don't have to wait 6 hours)

The workflow takes ~2 minutes. When it finishes (green check), it has pushed a fresh snapshot to a new branch called `data` on your repo. You can verify by visiting:

```
https://github.com/KWanus/tradeline.io/tree/data
```

You should see `radar_snapshot.json` there.

---

## Step 3 — Connect Vercel to the snapshot (2 minutes)

Now wire your live site to read that fresh snapshot.

1. Back in Vercel → your project → **Settings** → **Environment Variables**
2. Add one more variable:
   - `TRADELINE_SNAPSHOT_URL` = `https://raw.githubusercontent.com/KWanus/tradeline.io/data/radar_snapshot.json`
3. Click **Save**
4. Go to **Deployments** → click the **...** menu on the latest deployment → **Redeploy**

Wait ~60 seconds. Refresh your Vercel URL. The radar should now show **57 banks with today's signals** instead of the 4-day-old snapshot.

From now on, every 6 hours the cron refreshes the data branch and Vercel serves it.

---

## Step 4 — Email delivery via Resend (5 minutes)

So the public report subscribe form and Tradeline AI alerts can actually send emails.

1. Sign up at [resend.com](https://resend.com)
2. **Domains** → **Add Domain**. If you don't have a custom domain yet, skip this and use Resend's onboarding sandbox sender (`onboarding@resend.dev`) for now.
3. Once you have a verified domain, copy the SMTP key from **API Keys** → **Create API Key**
4. In Vercel, add:
   - `RESEND_API_KEY` = `re_...` (the key from Resend)
   - `RESEND_FROM` = `noreply@yourdomain.com` (the from address)
   - `REPORT_LEADS_NOTIFY_TO` = your email (where subscribe-form leads are forwarded)
5. Redeploy.

---

## Step 5 — Custom domain (optional, 10 minutes)

Recommended when you start selling. Default Vercel URL works fine for demos.

1. Buy a domain (~$15/year). Recommended registrar: [Cloudflare](https://dash.cloudflare.com/?to=/:account/domains).
2. In Vercel → **Settings** → **Domains** → **Add**. Enter your domain (e.g. `tradelineos.com`).
3. Vercel shows you two DNS records (or instructions to point your nameservers).
4. In Cloudflare DNS, add those records. Or transfer nameservers.
5. Wait ~5 minutes for DNS propagation.
6. SSL cert auto-issues. Your site is live at your custom domain.

Tradeline's public marketing pages (`/`, `/report`) are now SEO-discoverable.

---

## Step 6 — First customer outreach (this is the actual business)

The product is live. Time to sell it.

The full playbook is at [/app/launch](https://your-vercel-url.vercel.app/app/launch) step 4, but the 20-minute version:

1. **Fill your buyer profile** at `/app/profile`. This auto-fills every outreach email + AI tutor context.
2. **Open `/app/playbook`** — the email templates auto-fill from your profile.
3. **Send 20 emails this week.** Targets:
   - 5 debt brokers (Garnet, NLEX, RMG, Kondaur, IndustryUp) — pitch them as supply-side Tradeline subscribers
   - 5 collection attorneys in your state — pitch them as supply-side subscribers
   - 5 small hypothecation lenders — pitch them as supply-side subscribers
   - 5 small licensed debt buyers — pitch them as buy-side customers
4. **Set up Stripe Payment Links** (not yet integrated in-app). Go to dashboard.stripe.com → Payment Links → create one per tier ($99, $499, $1,499, $4,999, $9,999/mo). Paste links in your closing emails until we wire native checkout.

Your first $5k MRR target: 30 days from today.

---

## What's not yet wired (Phase 2)

This is what's still on me to build before the workbase scales past ~10 customers:

- **Stripe billing integration** (in-app checkout instead of Payment Links)
- **Auth + login** (Clerk drop-in, so customers see only their own data)
- **Postgres multi-tenant** (move localStorage data to Supabase or Vercel Postgres)
- **Customer self-service preferences** (subscribers edit own alert criteria)
- **Automated daily/weekly alert schedule** (instead of clicking send per subscriber)
- **Analytics dashboard** (conversion funnel, MRR growth, churn)

Each is roughly half a day to a day of focused build. You can start charging via Stripe Payment Links + manual `/app/subscribers` entry today, then wire native billing once you have 5–10 paying customers.

---

## When something breaks

- **The cron didn't run** → Actions tab → click the failed run → read the logs. Common cause: missing `TRADELINE_SEC_UA` secret or SEC rate-limited (try again in an hour).
- **The site shows stale data** → check that `TRADELINE_SNAPSHOT_URL` matches the actual raw GitHub URL. Open the URL in a browser; should download JSON.
- **AI tutor says "disabled"** → `ANTHROPIC_API_KEY` not set in Vercel env vars. Add it and redeploy.
- **Emails not sending** → `RESEND_API_KEY` missing, or sending from an unverified domain. Use `onboarding@resend.dev` while you verify your domain.
- **Anything else** → open [/app/tutor](https://your-vercel-url.vercel.app/app/tutor), flip Research mode on, ask Claude. It knows the whole codebase.

---

## Sanity check after each step

| Step | How you know it worked |
|---|---|
| 1. Vercel | Visit your URL → see the dark UI with amber-pink gradient |
| 2. GH Actions | `https://github.com/KWanus/tradeline.io/tree/data` shows a `radar_snapshot.json` file |
| 3. Snapshot wired | `/app/banks` shows 57 banks with **today**'s `Data refreshed` time in the sidebar footer |
| 4. Resend | Subscribe form at `/report` accepts a test email, you receive a notification |
| 5. Custom domain | Browse to `https://yourdomain.com` and see the landing page |
| 6. First sale | Someone Stripe-pays you. Add them to `/app/customers`. Cake. |
