# Sushi public-beta launch kit

Sushi turns uploaded data files into a clear, plain-English analysis workspace.

## Current launch status

### Verified on July 17, 2026

- `https://trysushi.xyz` serves over HTTPS.
- The public site, documentation, examples, pricing, privacy, sign-up page, and backend health endpoint respond successfully.
- The production **Try sample data** journey opens the completed sample report without browser-console errors.
- The public file types are CSV, TSV, XLSX, JSON, Parquet, and SQLite, with a 25 MB limit.
- Production CORS accepts `https://trysushi.xyz` with credentials.
- The repository contains only template environment files; the credential-shaped values found in tests are test fixtures, not production values.

### Launch gates before announcing broadly

- Create one fresh production account and complete a real upload, analysis, report view, logout, and re-login. Do this with a disposable test file only.
- In Render, confirm `ENVIRONMENT=production`, `ALLOWED_ORIGINS=https://trysushi.xyz,https://www.trysushi.xyz`, `DATABASE_URL`, Supabase verification settings, and all R2 variables are present only in the backend service that serves the API.
- In Vercel, confirm only `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_UPLOAD_API_URL`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are exposed to the browser. Do not add service-role keys, database URLs, R2 secrets, or AI provider keys there.
- Enable GitHub secret scanning for `premxai/sushi-eda`; its API currently reports that secret scanning is disabled.
- Confirm R2 is private and Render has the only R2 read/write credentials.
- Monitor the first launch day: Vercel errors, Render logs, Supabase auth failures, and R2 access errors.

## Positioning

**Name:** Sushi

**Tagline:** Understand your data in minutes, not formulas.

**One-line description:** Upload a spreadsheet or data file and get an approachable report with data quality, patterns, charts, and plain-English findings.

### What to say

- Supports CSV, TSV, XLSX, JSON, Parquet, and SQLite files up to 25 MB.
- Start with a ready-to-explore sample report, no account needed.
- Create an account to upload your own files.
- Unsaved uploads and generated reports are deleted after seven days; saved dashboard items remain until the user deletes them.
- Users can bring their own AI key for the AI Summary.

### What not to say

- Do not claim files are deleted after seven days without the word **unsaved**.
- Do not claim zero-retention or end-to-end encryption unless those properties are separately verified.
- Do not claim data is never sent to an AI provider when a user requests an AI summary.
- Do not claim AI conclusions are guaranteed accurate; frame them as analysis aids.

## Product Hunt draft

**Product name:** Sushi

**Tagline:** Turn data files into clear, plain-English reports.

**Description (under 260 characters):**

Sushi helps you understand a spreadsheet or data file without wrestling with formulas. Upload CSV, TSV, XLSX, JSON, Parquet, or SQLite and explore data quality, patterns, charts, and a plain-English report.

**Maker comment:**

Hi Product Hunt! I built Sushi for the moment when you have a data file but no quick way to understand what is inside it. Upload a file and Sushi surfaces data quality, field health, patterns, charts, and a plain-English report. You can try the sample report without an account; sign up only when you are ready to analyze your own file.

I would love feedback on two things: which insight is most useful first, and what would make you trust a report enough to share it with your team?

**Recommended gallery sequence:**

1. Hero: file in, clear report out.
2. AI Summary and data-quality score.
3. A chart/trend section with a real finding.
4. Field Health or unusual-values detail.
5. Private dashboard and saved-item limit.

Use genuine product screenshots with readable UI. Avoid animation that makes product text hard to read.

## X launch copy

**Primary post**

I built Sushi: a calmer way to understand a data file.

Upload CSV, TSV, XLSX, JSON, Parquet, or SQLite and get data-quality checks, charts, patterns, and a clear report in minutes.

Try the sample report—no account needed: https://trysushi.xyz

**Follow-up post**

Sushi is for the point before you open a notebook or start building formulas: “What is actually in this file?”

I would love candid feedback from people who work with messy spreadsheets and exports. What should the first report answer for you?

## Launch-day checklist

- [ ] Run the production-account upload test above.
- [ ] Capture five 16:9 screenshots in the gallery order.
- [ ] Create a Product Hunt draft using the direct product URL: `https://trysushi.xyz`.
- [ ] Add the maker account(s) and publish the maker comment immediately after launch.
- [ ] Post the X launch message only after the Product Hunt page is live.
- [ ] Respond to every first-day question with product context, not engagement incentives.
- [ ] Record sign-ups, sample-report opens, file-upload starts, completed analyses, failures, and support requests.

Product Hunt recommends posting with a personal account, using the direct product URL, including a first maker comment, and preparing the launch as a draft when needed. See its [launch guide](https://www.producthunt.com/launch) and [posting instructions](https://help.producthunt.com/en/articles/479557-how-to-post-a-product).
