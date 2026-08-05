# 📊 LogSherlock Pro — User Tracking Guide

## How Machine-Lock Works

When a user activates a license key:
1. App generates a **Machine Fingerprint** (unique per device)
2. Key gets **bound** to that fingerprint
3. Same key on different device → ❌ BLOCKED

```
Key: IEAZ-00FC-0BC1-12RQ
    ↓
Machine Fingerprint: M-4A8F2C01 (based on screen, browser, hardware)
    ↓
Stored: ls_license_machine_IEAZ-00FC-0BC1-12RQ = M-4A8F2C01
    ↓
Another machine tries same key → fingerprint = M-7D3E9B02 → MISMATCH → BLOCKED
```

---

## How to Check Who's Using Your Keys

### Option 1: Ask user to run in console (F12)

Ask the user to open browser console (F12) and run:

```javascript
console.table({
  Name: localStorage.getItem('ls_username'),
  Key: localStorage.getItem('ls_license_key'),
  Machine: localStorage.getItem('ls_license_machine'),
  Activated: localStorage.getItem('ls_license_date'),
  Expiry: localStorage.getItem('ls_license_days') + ' days'
});
```

### Option 2: Check on their machine directly

Open LogSherlock Pro on their machine → F12 → Console → paste above command.

---

## How to Revoke a Key

Since keys are validated client-side, you can't remotely revoke them. But you can:

1. **Let it expire** — Give short-expiry keys (7 days). After expiry, they need a new one from you.
2. **Change the SECRET** — If you change `LSPRO2026KRISHNA` in both `Generate-License.ps1` and `index.html`, all old keys become invalid.
3. **New version** — Release a new version of the app with updated validation. Old keys won't work.

---

## Tracking Data Stored (per user, in their browser)

| localStorage Key | What it stores |
|-----------------|----------------|
| `ls_username` | User's full name |
| `ls_license_key` | The license key they entered |
| `ls_license_date` | ISO date when they activated |
| `ls_license_days` | How many days the key is valid |
| `ls_license_machine` | Their machine fingerprint |
| `ls_license_validated` | "true" if active |
| `ls_license_machine_{KEY}` | Binds specific key to specific machine |

---

## Future: Google Sheets Live Tracking

When Google Apps Script access is available, the app will automatically send activation data to a Google Sheet:

| Key | Name | Machine_ID | Activation_Date | Expiry_Days | Browser | OS | Status |
|-----|------|-----------|-----------------|-------------|---------|-----|--------|
| IEAZ-00FC-0BC1-12RQ | Bob Smith | M-4A8F2C01 | 2026-08-05 | 30 | Chrome | Win11 | ACTIVE |

The code for this is already built into `index.html` — just needs the Google Form/Sheet webhook URL to be configured.

---

## Admin Commands (Quick Reference)

```powershell
# Generate keys
.\Generate-License.ps1 -Days 7          # 7-day trial
.\Generate-License.ps1 -Days 30         # 30-day
.\Generate-License.ps1 -Days 365        # 1-year
.\Generate-License.ps1 -Lifetime        # Forever
.\Generate-License.ps1 -Days 30 -Count 10  # Bulk: 10 keys
```

```javascript
// Check license status in browser console (F12)
console.log('Valid:', localStorage.getItem('ls_license_validated'));
console.log('Key:', localStorage.getItem('ls_license_key'));
console.log('Machine:', localStorage.getItem('ls_license_machine'));
console.log('Expires:', localStorage.getItem('ls_license_days'), 'days from', localStorage.getItem('ls_license_date'));

// Force reset (for testing)
localStorage.clear(); location.reload();
```

---

© 2026 Krishna Yada. All Rights Reserved.
