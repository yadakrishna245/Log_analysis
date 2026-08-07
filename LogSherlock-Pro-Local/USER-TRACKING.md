# 📊 LogSherlock Pro — User & License Tracking

## How It Works

Every license activation is tracked in **AWS DynamoDB** (cloud database). When a user enters their license key:

```
User enters key → App generates Machine Fingerprint → Calls AWS API
                                                           ↓
                                               DynamoDB: stores key + user + machine + time
                                                           ↓
                                               You can query ALL users anytime!
```

---

## 🔍 Check Who's Using Your Product

### Quick Command — List ALL Users

```powershell
.\Check-Licenses.ps1
```

**Output:**
```
═══════════════════════════════════════════════════════════════
  LogSherlock Pro — License Dashboard
═══════════════════════════════════════════════════════════════

  📊 Total Activated:  5
  ✅ Active:           4
  ❌ Expired:          1

───────────────────────────────────────────────────────────────

  [1] ✅ ACTIVE
      User:       Krishna Yada
      Key:        HTRO-0A25-5B44-00FJ
      Activated:  2026-08-07T08:30:00Z
      Last Seen:  2026-08-07T14:00:00Z
      Expiry:     365 days left
      Device:     Mozilla/5.0 (Windows NT 10.0; Win64; x64)

  [2] ✅ ACTIVE
      User:       Rahul Singh
      Key:        X9QP-00FC-0BC1-2ANR
      Activated:  2026-08-07T09:15:00Z
      Last Seen:  2026-08-07T13:45:00Z
      Expiry:     30 days left
      Device:     Mozilla/5.0 (Windows NT 10.0; Win64; x64)

  [3] ❌ EXPIRED
      User:       Test User
      Key:        ABCD-0033-1234-07XY
      Activated:  2026-07-01T10:00:00Z
      Last Seen:  2026-07-08T16:20:00Z
      Expiry:     0 days left
      Device:     Mozilla/5.0 (X11; Linux x86_64)
```

### Check Single Key

```powershell
.\Check-Licenses.ps1 -Action status -Key "HTRO-0A25-5B44-00FJ"
```

### Reset Key (Transfer to New Machine)

```powershell
.\Check-Licenses.ps1 -Action reset -Key "HTRO-0A25-5B44-00FJ"
```

---

## 📋 What's Tracked Per User

| Field | Description | Example |
|-------|-------------|---------|
| **license_key** | The key they used | `HTRO-0A25-5B44-00FJ` |
| **user_name** | Name they entered | `Krishna Yada` |
| **activated_at** | When they first activated | `2026-08-07T08:30:00Z` |
| **last_seen** | Last time they opened the app | `2026-08-07T14:00:00Z` |
| **expiry_days** | How many days the key is valid | `365` |
| **expiry_date** | Exact expiry date | `2027-08-07T08:30:00Z` |
| **days_remaining** | Days left before expiry | `365` |
| **is_expired** | Whether key has expired | `false` |
| **is_lifetime** | Whether it's a lifetime key | `false` |
| **user_agent** | Their browser + OS | `Chrome/Windows 10` |
| **fingerprint** | Machine hash (privacy-safe) | `a8f2c01b...` |

---

## 🔐 Per-Machine Lock

| Scenario | Result |
|----------|--------|
| User A activates on Laptop 1 | ✅ Works! Registered. |
| User A opens again on Laptop 1 | ✅ Welcome back! |
| User B copies key to Laptop 2 | ❌ BLOCKED — "already activated on another device" |
| Admin resets key | ✅ Key can now be used on new device |

---

## 🛠️ Admin Commands Summary

```powershell
# List ALL users and their license status
.\Check-Licenses.ps1

# Check specific key
.\Check-Licenses.ps1 -Action status -Key "XXXX-XXXX-XXXX-XXXX"

# Reset key (allow transfer to new machine)
.\Check-Licenses.ps1 -Action reset -Key "XXXX-XXXX-XXXX-XXXX"

# Generate new keys
.\Generate-License.ps1 -Days 7          # 7-day trial
.\Generate-License.ps1 -Days 30         # 30-day
.\Generate-License.ps1 -Days 365        # 1-year
.\Generate-License.ps1 -Lifetime        # Forever
.\Generate-License.ps1 -Days 30 -Count 10  # Bulk: 10 keys
```

---

## ⚠️ Important Notes

1. **First activation requires internet** — The app must reach AWS to register the machine
2. **After first activation, works offline** — Same machine can use without internet
3. **You (admin) need internet to check dashboard** — `Check-Licenses.ps1` calls AWS
4. **Data stored in AWS DynamoDB** — Region: us-east-1, Table: LogSherlock-Licenses
5. **Admin secret:** `LSPRO2026KRISHNA` — Keep this private!
6. **TTL auto-cleanup** — Expired records auto-delete from DynamoDB after expiry

---

## 💰 Pricing Model (Suggested)

| Plan | Duration | Key Command | Price |
|------|----------|-------------|-------|
| Trial | 7 days | `.\Generate-License.ps1 -Days 7` | Free |
| Monthly | 30 days | `.\Generate-License.ps1 -Days 30` | ₹500/month |
| Yearly | 365 days | `.\Generate-License.ps1 -Days 365` | ₹5,000/year |
| Lifetime | Forever | `.\Generate-License.ps1 -Lifetime` | ₹15,000 |

---

© 2026 Krishna Yada. All Rights Reserved.
