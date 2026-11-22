# Weavoryn

Static storefront with serverless order, customer, contact, and admin endpoints. Card checkout uses Safepay hosted checkout. The store currently prices products in USD.

## Safepay setup

1. Create a Safepay sandbox account and copy its API key, v1 secret, and webhook secret into the deployment environment variables shown in `.env.example`.
2. Set `SAFEPAY_ENV` to `sandbox` and `SITE_URL` to the store's public HTTPS URL.
3. Run `supabase.sql` in the Supabase SQL editor.
4. Deploy the project, then register `https://your-store-domain.example/api/safepay-webhook` as the payment webhook endpoint in Safepay. Enable Safepay payment events for the endpoint.
5. Use Safepay's sandbox card numbers to complete test checkouts. The browser return page does not mark orders paid; only a verified Safepay webhook does.
6. Apply for Safepay production onboarding. After approval, add the production credentials and change `SAFEPAY_ENV` to `production` in the deployment environment.

Never put Safepay secrets in frontend code or commit them to Git. Add them only as server environment variables in the hosting dashboard.

## Vercel routes

The `api/` directory exposes the serverless routes used by the storefront. Deploy from this folder as the project root. The store owner can view orders at `/admin.html`.

## Existing services

Supabase stores customer accounts and orders. Gmail SMTP sends customer and store-owner emails. Configure all required values from `.env.example` before using the related features.

Refunds are issued through the Safepay merchant dashboard. Order cancellation and shipment status are managed in `/admin.html`.
