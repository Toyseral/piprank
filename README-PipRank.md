# PipRank — Forex Broker Review & Comparison Platform

Full-stack Vite + React + TypeScript + Tailwind v4 app with Vercel serverless API routes and Supabase Postgres.

## Highlights in this export
- 32-broker index with deep profiles (fees, regulation tabs, platforms, account cards, funding rails, FAQs, community reviews)
- Comparison engine (+ programmatic /compare/a-vs-b pair pages), geo-aware 6-step quiz, calculators
- Country + intent + promotions SEO pages; advertiser disclosure + risk warning in footer
- Admin console at /archypage: role-based access (super admin / admin / brokers / content / moderator), team invites with initial passwords, logo uploads, promotion management, analytics (CTA clicks, quiz funnel, conversions)
- Anonymous product analytics pipeline (events table + tracking lib)

## Run locally
1. npm ci
2. cp .env.example .env and fill in Supabase values
3. npm run dev

## Deploy to Vercel
1. Push to GitHub, Import into Vercel — it auto-detects Vite + api/ routes
2. Set the env vars from .env.example in project settings
3. Deploy
