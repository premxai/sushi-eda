# Cloudflare R2 setup for Sushi

Sushi stores each uploaded source file and a durable JSON copy of every
completed report in a private R2 bucket. Postgres still stores the metadata,
ownership, and fast report query data.

## Cloudflare dashboard

1. Open **Cloudflare Dashboard → R2 Object Storage** and create a bucket named
   `sushi-production` (or another private name of your choice).
2. Keep the bucket private. Sushi accesses objects through the backend only;
   do not enable a public bucket URL for user uploads.
3. Go to **Manage R2 API Tokens → Create API token**.
4. Give it **Object Read & Write** access, scoped only to the Sushi bucket.
5. Copy the Account ID, Access Key ID, and Secret Access Key. The secret is
   shown once—store it directly in Render, never in Git.

## Render environment variables

In Render → `sushi-backend` → **Environment**, add:

```text
R2_ACCOUNT_ID=<Cloudflare account ID>
R2_ACCESS_KEY_ID=<R2 API token access key ID>
R2_SECRET_ACCESS_KEY=<R2 API token secret>
R2_BUCKET_NAME=sushi-production
R2_PUBLIC_URL=
```

Leave `R2_PUBLIC_URL` blank unless you deliberately configure a protected
custom-domain delivery layer. The application uses private R2 access by
default.

Then select **Save, rebuild, and deploy**. The backend writes source files to
`uploads/<org>/<dataset>/…` and report JSON to
`reports/<org>/<dataset>/<analysis>.json`.
