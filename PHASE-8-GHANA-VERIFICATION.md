# Phase 8 — Ghana Broker Verification Layer

## Purpose

Ghana recommendations must distinguish **country availability** from **local regulatory authorisation** and from **affiliate eligibility**.

A broker should enter Ghana's recommendation pool only when:

1. `broker_country_availability.status = 'available'`
2. `broker_country_verification.availability_verified = true`
3. The verification record has a source and verification date.

Affiliate CPA is never a ranking factor.

## SQL order

Run:

1. `sql/PHASE-8-GHANA-COMMERCIAL-TOPICAL.sql`
2. `sql/PHASE-8-GHANA-BROKER-VERIFICATION.sql`
3. `sql/PHASE-8-GHANA-VALIDATE.sql` (read-only)

Do not mark a broker as Ghana-locally authorised unless the current official Ghana regulator source supports that claim.

## User-facing language

Use:

> Ghana availability verified

when availability is verified.

Do not automatically display:

> Ghana regulated

because accepting Ghanaian clients and being locally authorised are separate facts.
