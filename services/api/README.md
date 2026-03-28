# API README

This document describes the Fastify API exposed by `services/api`.

## Base Notes

- Base URL: `http://localhost:4000` in local development unless overridden.
- Auth: send `Authorization: Bearer <supabase_access_token>` for protected routes.
- Roles: some routes require `user`, `merchant`, or `admin`.
- Common error response:

```json
{
  "error": "Human readable message",
  "details": {}
}
```

- Global health route error format may also include:

```json
{
  "error": "Human readable message",
  "requestId": "uuid"
}
```

## Common Resource Shapes

These responses usually return raw Supabase rows, so the main shapes are:

- `Profile`: `id`, `full_name`, `phone`, `wallet_address`, `role`, `kyc_status`, `created_at`, `updated_at`
- `Wallet`: `id`, `user_id`, `balance_crypto`, `balance_inr_equivalent`, `locked_balance`, `currency_code`, `created_at`, `updated_at`
- `WalletTransaction`: `id`, `wallet_id`, `type`, `inr_amount`, `crypto_amount`, `exchange_rate`, `rate_locked_at`, `razorpay_payment_id`, `status`, `created_at`
- `Merchant`: `id`, `business_name`, `business_type`, `gstin`, `pan_number`, `bank_account_number`, `bank_ifsc`, `bank_account_name`, `upi_id`, `razorpay_contact_id`, `razorpay_fund_account_id`, `settlement_status`, `qr_secret`, `onboarded_at`
- `Venue`: `id`, `merchant_id`, `name`, `description`, `category`, `address`, `city`, `lat`, `lng`, `is_active`, `created_at`, `updated_at`
- `Geofence`: `id`, `venue_id`, `type`, `center_lat`, `center_lng`, `radius_meters`, `polygon_coordinates`, `created_at`
- `PricingPlan`: `id`, `venue_id`, `name`, `billing_unit`, `rate_crypto`, `rate_inr_equivalent`, `base_fee_inr`, `minimum_charge_inr`, `maximum_cap_inr`, `grace_period_seconds`, `is_active`, `created_at`
- `Session`: `id`, `user_id`, `venue_id`, `pricing_plan_id`, `status`, `trigger_mode`, `qr_nonce_used`, `pause_reason`, `entry_lat`, `entry_lng`, `exit_lat`, `exit_lng`, `entry_time`, `exit_time`, `duration_seconds`, `locked_rate`, `crypto_charged`, `inr_equivalent`, `platform_fee_inr`, `platform_fee_rate`, `merchant_payout_inr`, `superfluid_stream_id`, `settlement_batch_id`, `created_at`, `updated_at`
- `SettlementBatch`: `id`, `merchant_id`, `batch_date`, `total_sessions`, `gross_inr`, `platform_fee_inr`, `net_inr`, `status`, `razorpay_payout_id`, `locked_rate_usdc`, `initiated_at`, `completed_at`
- `Notification`: `id`, `user_id`, `type`, `title`, `body`, `read`, `created_at`
- `VenueQrCode`: `id`, `venue_id`, `type`, `nonce`, `signature`, `expires_at`, `is_demo`, `created_at`

## Health

### `GET /health`
- Auth: none
- Payload: none
- Response `200`:

```json
{
  "status": "ok",
  "requestId": "uuid",
  "env": "development"
}
```

## Auth

### `POST /auth/register`
- Auth: none
- Body:

```json
{
  "email": "user@example.com",
  "password": "password123",
  "fullName": "A User",
  "phone": "9876543210"
}
```

- Response `201`:

```json
{
  "userId": "uuid",
  "role": "user"
}
```

### `POST /auth/login`
- Auth: none
- Body:

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

- Response `200`:

```json
{
  "session": {},
  "user": {}
}
```

### `POST /auth/logout`
- Auth: none
- Payload: none
- Response `204`

### `POST /auth/refresh`
- Auth: none
- Body:

```json
{
  "refreshToken": "token"
}
```

- Response `200`: Supabase refresh payload, typically:

```json
{
  "session": {},
  "user": {}
}
```

### `GET /auth/google`
- Auth: none
- Payload: none
- Response `302`: redirects to Google OAuth

### `GET /auth/google/callback`
- Auth: none
- Query: `code`
- Response `302`: redirects to `${DASHBOARD_URL}/auth/callback?access_token=...&refresh_token=...&provider=google`

### `GET /auth/github`
- Auth: none
- Payload: none
- Response `302`: redirects to GitHub OAuth

### `GET /auth/github/callback`
- Auth: none
- Query: `code`
- Response `302`: redirects to `${DASHBOARD_URL}/auth/callback?access_token=...&refresh_token=...&provider=github`

### `POST /auth/web3-login`
- Auth: none
- Body:

```json
{
  "email": "user@example.com",
  "walletAddress": "0xabc...",
  "idToken": "optional-web3auth-token",
  "appPublicKey": "optional-public-key"
}
```

- Response `200`: Supabase auth payload, usually:

```json
{
  "session": {},
  "user": {}
}
```

### `POST /auth/kyc/upload`
- Auth: required
- Role: any authenticated user
- Body:

```json
{
  "documentType": "merchant_kyc",
  "gstNumber": "22AAAAA0000A1Z5",
  "panNumber": "AAAAA0000A",
  "businessName": "Detrix Gym",
  "bankAccountNumber": "1234567890",
  "bankIfsc": "HDFC0001234",
  "bankAccountName": "Detrix Gym Pvt Ltd"
}
```

- Response `200`:

```json
{
  "kycStatus": "pending",
  "message": "KYC documents submitted successfully. Review in progress."
}
```

### `GET /sessions/active/reconcile`
- Auth: required
- Role: any authenticated user
- Payload: none
- Response `200` when no session:

```json
{
  "activeSession": null
}
```

- Response `200` when active:

```json
{
  "activeSession": {},
  "currentCharge": 125,
  "elapsedSeconds": 900,
  "lockedRate": 83.25,
  "billingUnit": "per_minute"
}
```

### `POST /sessions/:id/resume`
- Auth: required
- Role: any authenticated user
- Params: `id` = session id
- Payload: none
- Response `200`: updated `Session`

## Users

### `GET /users/me`
- Auth: required
- Role: any authenticated user
- Payload: none
- Response `200`: `Profile`

### `GET /users/me/wallet`
- Auth: required
- Role: any authenticated user
- Payload: none
- Response `200`: `Wallet`

### `GET /users/me/sessions`
- Auth: required
- Role: any authenticated user
- Payload: none
- Response `200`: array of `Session` rows with nested `venues(name, city)`

### `GET /users/me/notifications`
- Auth: required
- Role: any authenticated user
- Payload: none
- Response `200`: array of `Notification`

## Merchants

### `GET /merchants/me`
- Auth: required
- Role: `merchant`, `admin`
- Payload: none
- Response `200`: `Merchant`

### `POST /merchants/onboard`
- Auth: required
- Role: any authenticated user
- Body:

```json
{
  "businessName": "Detrix Parking",
  "businessType": "parking",
  "gstin": "22AAAAA0000A1Z5",
  "panNumber": "AAAAA0000A",
  "bankAccountNumber": "1234567890",
  "bankIfsc": "HDFC0001234",
  "bankAccountName": "Detrix Parking",
  "upiId": "merchant@upi"
}
```

- Response `201`: `Merchant`

### `GET /merchants/me/sessions`
- Auth: required
- Role: `merchant`, `admin`
- Payload: none
- Response `200`: array of `Session` rows with nested `venues(merchant_id, name, city)`

### `GET /merchants/me/settlements`
- Auth: required
- Role: `merchant`, `admin`
- Payload: none
- Response `200`: array of `SettlementBatch`

### `GET /merchants/me/venues`
- Auth: required
- Role: `merchant`, `admin`
- Payload: none
- Response `200`: array of `Venue`

## Wallet

### `POST /wallet/topup/order`
- Auth: required
- Role: any authenticated user
- Body:

```json
{
  "amountInr": 500,
  "currency": "INR"
}
```

- Response `200`:

```json
{
  "orderId": "order_or_demo_id",
  "amount": 50000,
  "currency": "INR",
  "status": "created",
  "receipt": "topup_user_timestamp",
  "keyId": "rzp_key",
  "mode": "live"
}
```

### `GET /wallet/balance`
- Auth: required
- Role: any authenticated user
- Payload: none
- Response `200`: `Wallet`

### `POST /wallet/topup/verify`
- Auth: required
- Role: any authenticated user
- Body:

```json
{
  "amountInr": 500,
  "paymentId": "pay_123",
  "exchangeRate": 83.25
}
```

- Response `200`: updated `Wallet`

### `GET /wallet/transactions`
- Auth: required
- Role: any authenticated user
- Payload: none
- Response `200`: array of `WalletTransaction`

## Venues

### `GET /venues`
- Auth: none
- Query: optional `city`
- Response `200`: array of active `Venue`

### `POST /venues`
- Auth: required
- Role: `merchant`, `admin`
- Body:

```json
{
  "name": "Detrix Coworking Hub",
  "description": "Flexible desks",
  "category": "coworking",
  "address": "123 Residency Road, Bengaluru",
  "city": "Bengaluru",
  "lat": 12.9716,
  "lng": 77.5946
}
```

- Response `201`: `Venue`

### `GET /venues/:id`
- Auth: none
- Params: `id` = venue id
- Response `200`: `Venue | null`

### `PUT /venues/:id`
- Auth: required
- Role: `merchant`, `admin`
- Params: `id` = venue id
- Body: same as `POST /venues`
- Response `200`: updated `Venue`

### `DELETE /venues/:id`
- Auth: required
- Role: `merchant`, `admin`
- Params: `id` = venue id
- Payload: none
- Response `204`

### `POST /venues/:id/geofences`
- Auth: required
- Role: `merchant`, `admin`
- Params: `id` = venue id
- Body for circle:

```json
{
  "type": "circle",
  "centerLat": 12.9716,
  "centerLng": 77.5946,
  "radiusMeters": 50
}
```

- Body for polygon:

```json
{
  "type": "polygon",
  "polygonCoordinates": [
    [12.9716, 77.5946],
    [12.9717, 77.5947],
    [12.9718, 77.5948]
  ]
}
```

- Response `201`: `Geofence`

### `GET /venues/:id/geofences`
- Auth: none
- Params: `id` = venue id
- Response `200`: array of `Geofence`

### `PUT /geofences/:id`
- Auth: required
- Role: `merchant`, `admin`
- Params: `id` = geofence id
- Body: same as create geofence
- Response `200`: updated `Geofence`

### `DELETE /geofences/:id`
- Auth: required
- Role: `merchant`, `admin`
- Params: `id` = geofence id
- Payload: none
- Response `204`

### `POST /venues/:id/pricing`
- Auth: required
- Role: `merchant`, `admin`
- Params: `id` = venue id
- Body:

```json
{
  "name": "Standard Plan",
  "billingUnit": "per_minute",
  "rateCrypto": 0.01,
  "rateInrEquivalent": 0.83,
  "baseFeeInr": 5,
  "minimumChargeInr": 20,
  "maximumCapInr": 500,
  "gracePeriodSeconds": 30
}
```

- Response `201`: `PricingPlan`

### `GET /venues/:id/pricing`
- Auth: none
- Params: `id` = venue id
- Response `200`: array of `PricingPlan`

### `PUT /pricing/:id`
- Auth: required
- Role: `merchant`, `admin`
- Params: `id` = pricing plan id
- Body for full update:

```json
{
  "name": "Premium Plan",
  "billingUnit": "per_minute",
  "rateCrypto": 0.02,
  "rateInrEquivalent": 1.66,
  "baseFeeInr": 10,
  "minimumChargeInr": 30,
  "maximumCapInr": 700,
  "gracePeriodSeconds": 45,
  "isActive": true
}
```

- Body for status-only update:

```json
{
  "isActive": false
}
```

- Response `200`: updated `PricingPlan`

### `GET /venues/:id/qr.png`
- Auth: none
- Params: `id` = venue id
- Payload: none
- Response `200`: PNG file download

## Sessions

### `POST /sessions/location-event`
- Auth: required
- Role: any authenticated user
- Body:

```json
{
  "venueId": "uuid",
  "lat": 12.9716,
  "lng": 77.5946,
  "occurredAt": "2026-03-28T10:00:00.000Z",
  "idempotencyKey": "location-event-unique-key"
}
```

- Response `200`: current or updated `Session`

### `POST /sessions/qr-start`
- Auth: required
- Role: any authenticated user
- Body:

```json
{
  "token": {
    "venueId": "uuid",
    "pricingPlanId": "uuid",
    "nonce": "unique-qr-nonce",
    "expiresAt": "2026-03-28T10:10:00.000Z",
    "signature": "signed-token"
  },
  "idempotencyKey": "qr-start-unique-key"
}
```

- Response `201`: created `Session`

### `POST /sessions/qr-stop`
- Auth: required
- Role: any authenticated user
- Body:

```json
{
  "token": {
    "venueId": "uuid",
    "action": "exit",
    "nonce": "unique-exit-qr-nonce",
    "expiresAt": "2026-03-28T10:20:00.000Z",
    "signature": "signed-token"
  },
  "idempotencyKey": "qr-stop-unique-key"
}
```

- Response `200`: closed `Session`

### `POST /venues/:id/qr/generate`
- Auth: required
- Role: `merchant`, `admin`
- Params: `id` = venue id
- Query:
  - `type`: `entry` or `exit`, default `entry`
  - `pricingPlanId`: required for entry QR usage in clients
  - `demo`: `true` or `false`
- Response `201`:

```json
{
  "qrCode": {
    "venueId": "uuid",
    "pricingPlanId": "uuid",
    "nonce": "uuid",
    "expiresAt": "2026-03-28T10:10:00.000Z",
    "signature": "signature"
  },
  "record": {}
}
```

For exit QR, `qrCode` also includes `"action": "exit"`.

### `GET /venues/:id/qr`
- Auth: required
- Role: `merchant`, `admin`
- Params: `id` = venue id
- Response `200`: array of non-expired `VenueQrCode`

### `GET /sessions/active`
- Auth: required
- Role: any authenticated user
- Payload: none
- Response `200`: active `Session | null`

### `GET /sessions/:id`
- Auth: required
- Role: owner or `admin`
- Params: `id` = session id
- Response `200`: `Session` with nested `venues(name, city, address)`

### `GET /sessions/:id/charge`
- Auth: required
- Role: owner
- Params: `id` = session id
- Response `200`:

```json
{
  "sessionId": "uuid",
  "status": "active",
  "elapsedSeconds": 900,
  "billingUnit": "per_minute",
  "lockedRate": 83.25,
  "currentChargeInr": 125,
  "currentChargeCrypto": 1.5015,
  "merchantPayoutInr": 124.38,
  "platformFeeInr": 0.62
}
```

### `POST /sessions/:id/checkout`
- Auth: required
- Role: owner
- Params: `id` = session id
- Payload: none
- Response `200`: closed `Session`

### `POST /sessions/:id/close`
- Auth: required
- Role: owner
- Params: `id` = session id
- Payload: none
- Response `200`: closed `Session`

## Billing

### `GET /billing/preview`
- Auth: none
- Query:
  - `elapsedSeconds`
  - `billingUnit`: `per_second`, `per_minute`, `per_hour`
  - `rateCrypto`
  - `lockedRate`
  - `minimumChargeInr`
  - `maximumCapInr`
  - `baseFeeInr`
- Response `200`: billing-core output, typically:

```json
{
  "elapsedSeconds": 600,
  "grossInr": 100,
  "cryptoAmount": 1.2012012,
  "platformFeeInr": 0.5,
  "merchantPayoutInr": 99.5
}
```

### `GET /billing/receipts/:id`
- Auth: required
- Params: `id` = session id
- Response `200`: session row used as receipt payload

### `POST /billing/refund/:id`
- Auth: required
- Params: `id` = session id
- Payload: none
- Response `202`:

```json
{
  "sessionId": "uuid",
  "status": "queued"
}
```

### `POST /sessions/:id/dispute`
- Auth: required
- Role: any authenticated user
- Params: `id` = session id
- Body:

```json
{
  "reason": "I was charged after I already exited the venue."
}
```

- Response `200`: updated `Session` with `status: "disputed"`

## Tax

### `POST /tax/chat`
- Auth: required
- Role: `merchant`, `admin`
- Body:

```json
{
  "question": "What GST treatment applies to my monthly revenue?",
  "financialYear": "2025-2026"
}
```

- Response `200`:

```json
{
  "answer": "LLM or fallback answer",
  "context": {}
}
```

### `GET /tax/summary`
- Auth: required
- Role: `merchant`, `admin`
- Query: optional `financialYear`, default `2025-2026`
- Response `200`: tax context summary object

### `POST /tax/summary/generate-pdf`
- Auth: required
- Role: `merchant`, `admin`
- Body:

```json
{
  "financialYear": "2025-2026"
}
```

- Response `200`:

```json
{
  "fileName": "tax-summary-merchantId-2025-2026.pdf",
  "publicUrl": "https://..."
}
```

## Notifications

### `POST /notifications/register-token`
- Auth: required
- Role: `user`, `merchant`, `admin`
- Body:

```json
{
  "pushToken": "ExponentPushToken[...]",
  "platform": "android",
  "deviceName": "Pixel 8"
}
```

- Response `200`:

```json
{
  "registered": true
}
```

### `DELETE /notifications/unregister-token`
- Auth: required
- Role: `user`, `merchant`, `admin`
- Body:

```json
{
  "pushToken": "ExponentPushToken[...]"
}
```

- Response `204`

### `GET /notifications`
- Auth: required
- Role: `user`, `merchant`, `admin`
- Payload: none
- Response `200`: up to 50 `Notification` rows

### `PUT /notifications/:id/read`
- Auth: required
- Role: `user`, `merchant`, `admin`
- Params: `id` = notification id
- Payload: none
- Response `204`

## Analytics

### `GET /analytics/revenue`
- Auth: required
- Role: `merchant`, `admin`
- Payload: none
- Response `200`: array of closed merchant session analytics rows:
  - `created_at`
  - `inr_equivalent`
  - `platform_fee_inr`
  - `merchant_payout_inr`
  - `trigger_mode`
  - `venue_id`
  - nested `venues(merchant_id, category, name)`

### `GET /merchants/me/tax-summary`
- Auth: required
- Role: `merchant`, `admin`
- Query: optional `financialYear`
- Response `200`: tax assistant context object

### `GET /admin/operator/live`
- Auth: required
- Role: `admin`
- Payload: none
- Response `200`: operator analytics live-feed array/object from `OperatorAnalyticsService`

### `GET /analytics/customer-overview`
- Auth: required
- Role: `user`, `admin`
- Payload: none
- Response `200`: up to 20 session overview rows with `created_at`, `inr_equivalent`, `duration_seconds`, nested `venues(name)`

### `GET /merchants/me/analytics`
- Auth: required
- Role: `merchant`, `admin`
- Payload: none
- Response `200`:

```json
{
  "totalRevenueThisMonth": 0,
  "totalSessionsThisMonth": 0,
  "averageSessionValue": 0,
  "platformFeePaid": 0
}
```

### `GET /analytics/occupancy`
- Auth: required
- Role: `merchant`, `admin`
- Payload: none
- Response `200`: flattened 7x24 heatmap:

```json
[
  {
    "day": 0,
    "hour": 0,
    "count": 0
  }
]
```

### `GET /analytics/export`
- Auth: required
- Role: `merchant`, `admin`
- Payload: none
- Response `200`: CSV text with header
  - `created_at,venue_id,inr_equivalent,platform_fee_inr,merchant_payout_inr,trigger_mode`

### `GET /analytics/operator`
- Auth: required
- Role: `admin`
- Payload: none
- Response `200`:

```json
{
  "daily": [
    {
      "date": "2026-03-28",
      "revenue": 1000,
      "sessions": 10,
      "fees": 5
    }
  ],
  "byCategory": [
    {
      "category": "parking",
      "value": 1000
    }
  ],
  "topMerchants": [
    {
      "name": "merchant",
      "revenue": 1000
    }
  ],
  "summary": {
    "totalRevenue": 1000,
    "totalSessions": 10,
    "totalFees": 5,
    "activeMerchants": 3
  }
}
```

### `GET /analytics/merchant-sessions`
- Auth: required
- Role: `merchant`, `admin`
- Query: optional `status`
- Response `200`: up to 100 rows with:
  - `id`
  - `user_id`
  - `venue_id`
  - `status`
  - `entry_time`
  - `exit_time`
  - `inr_equivalent`
  - `crypto_charged`
  - `trigger_mode`

## Admin

### `GET /admin/merchants`
- Auth: required
- Role: `admin`
- Payload: none
- Response `200`: array of `Merchant`

### `PUT /admin/merchants/:id/verify`
- Auth: required
- Role: `admin`
- Params: `id` = merchant/profile id
- Payload: none
- Response `204`

### `PUT /admin/merchants/:id/suspend`
- Auth: required
- Role: `admin`
- Params: `id` = merchant id
- Payload: none
- Response `204`

### `PUT /admin/merchants/:id/reactivate`
- Auth: required
- Role: `admin`
- Params: `id` = merchant id
- Payload: none
- Response `204`

### `GET /admin/operator/stats`
- Auth: required
- Role: `admin`
- Payload: none
- Response `200`:

```json
{
  "ledger": [],
  "totalMerchants": 0,
  "totalUsers": 0,
  "activeSessions": 0
}
```

### `GET /admin/operator/revenue`
- Auth: required
- Role: `admin`
- Payload: none
- Response `200`: array of `operator_ledger` rows limited to `recorded_at`, `fee_inr`, `gross_inr`

### `GET /admin/operator/ledger`
- Auth: required
- Role: `admin`
- Payload: none
- Response `200`: array of `operator_ledger` rows

### `GET /admin/operator/sessions`
- Auth: required
- Role: `admin`
- Payload: none
- Response `200`: array of `Session`

### `GET /admin/operator/settlements`
- Auth: required
- Role: `admin`
- Payload: none
- Response `200`: array of `SettlementBatch`

### `GET /admin/operator/merchants`
- Auth: required
- Role: `admin`
- Payload: none
- Response `200`: array of merchant rows with nested `profiles(full_name, kyc_status)`

### `POST /admin/settlements/run`
- Auth: required
- Role: `admin`
- Body:

```json
{
  "batchDate": "2026-03-27"
}
```

- Response `200`:

```json
{
  "batchDate": "2026-03-27",
  "result": {}
}
```

### `POST /admin/operator/settlements/:id/retry`
- Auth: required
- Role: `admin`
- Params: `id` = settlement batch id
- Payload: none
- Response `200`:

```json
{
  "batchId": "uuid",
  "retried": true
}
```

### `GET /admin/operator/export/ledger`
- Auth: required
- Role: `admin`
- Payload: none
- Response `200`: CSV text with header
  - `recorded_at,session_id,merchant_id,venue_id,gross_inr,fee_rate,fee_inr`

## Webhooks

### `POST /webhooks/razorpay`
- Auth: webhook signature via header
- Header: `x-razorpay-signature`
- Body: Razorpay webhook payload
- Response `202` varies by event:

`payment.captured`

```json
{
  "credited": true,
  "userId": "uuid",
  "wallet": {}
}
```

`payment.failed`

```json
{
  "acknowledged": true,
  "paymentId": "pay_123"
}
```

`payment.refunded`

```json
{
  "refunded": true,
  "userId": "uuid",
  "wallet": {}
}
```

`order.paid`

```json
{
  "accepted": true,
  "orderId": "order_123"
}
```

`payout.processed`, `payout.failed`, `payout.reversed`

```json
{
  "payoutUpdated": true,
  "payoutId": "pout_123",
  "status": "completed"
}
```

Unhandled events:

```json
{
  "accepted": true,
  "event": "event.name"
}
```

Duplicate webhook replay:

```json
{
  "duplicate": true
}
```
