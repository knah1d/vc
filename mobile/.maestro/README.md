# E2E flows (Maestro)

## Setup (one-time)

1. Install the Maestro CLI: `curl -Ls "https://get.maestro.mobile.dev" | bash`
2. Seed two test accounts by hand through the app (signup screen) — these flows
   log in rather than sign up, so they're repeatable without hitting "email
   already in use":
   - a primary account (`TEST_EMAIL` / `TEST_PASSWORD`)
   - a second account to message/call (`TEST_CONTACT_EMAIL`)
3. Install the dev-client build on the device/emulator you'll run these against
   (see the root README for `eas build --profile development`).

## Running

```
maestro test .maestro/login.yaml \
  -e TEST_EMAIL=you@example.com -e TEST_PASSWORD=testpassword123

maestro test .maestro/send-message.yaml \
  -e TEST_EMAIL=you@example.com -e TEST_PASSWORD=testpassword123 \
  -e TEST_CONTACT_EMAIL=contact@example.com

maestro test .maestro/place-call.yaml \
  -e TEST_EMAIL=you@example.com -e TEST_PASSWORD=testpassword123 \
  -e TEST_CONTACT_EMAIL=contact@example.com
```

## What's covered vs. not

- `login.yaml`, `send-message.yaml`: real, repeatable checks.
- `place-call.yaml`: only verifies the call-initiation pipeline runs (permission
  check → `call:invite`) on one device. It does **not** verify the other side
  actually rings — that needs two devices/emulators running concurrently,
  which isn't set up here yet. The permission-dialog step is also Android
  version/OEM-specific and may need adjusting per test device.
