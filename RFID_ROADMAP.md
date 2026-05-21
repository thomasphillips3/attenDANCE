<!-- generated-by: gsd-doc-writer -->
# RFID Check-In Roadmap

RFID check-in is a planned enhancement to the LSODance Studio Platform. The attendance system is designed from day one to accept both manual (iPad) and RFID check-ins — the endpoint contract, database schema, and device authentication model are built in Layer 3 of the build order. This document covers everything needed to assemble, configure, and deploy a physical reader unit.

---

## Hardware Recommendations

### Reader Module

Two modules are viable. The recommendation is the **PN532**.

| Module | Interface | Price | Verdict |
|--------|-----------|-------|---------|
| RC522 | SPI only | ~$3 | Adequate for basic UID reads, but SPI requires more wiring for a Pi Zero, and the RC522 has noticeably shorter read range and less reliable detection on 13.56 MHz cards in real studio conditions (bags, pockets, wallets). |
| **PN532** | I2C / SPI / UART | **~$8** | Recommended. More sensitive at 13.56 MHz, supports I2C which only requires 4 wires to the Pi, and has a mature Python library (`adafruit-circuitpython-pn532`). The $5 premium is worth it for a device that will be touched hundreds of times per semester. |

Use the PN532 over I2C. I2C wiring: VCC → 3.3V, GND → GND, SDA → GPIO 2, SCL → GPIO 3. No level shifter needed — the PN532 runs at 3.3V logic.

### RFID Cards

**MIFARE Classic 1K** cards are the right choice. They cost approximately $0.50 per card in packs of 50-100, operate at 13.56 MHz (compatible with PN532), and are the industry standard for access control and attendance. The platform only needs the factory-assigned UID — no data is written to the card, so the 1K storage capacity is irrelevant. Cards are not cloneable by students with consumer tools.

Order cards before students enroll. One card per student. Order 10-15% overage for replacements.

### Pi Board

**Raspberry Pi Zero 2 W** is the right size for this deployment. It has Wi-Fi built in (2.4 GHz 802.11 b/g/n), is small enough to mount on a reader enclosure, and costs $15. It runs full Raspberry Pi OS Lite with Python 3.11+. No keyboard, monitor, or Ethernet needed after initial setup — the unit runs headless and connects to the studio's Wi-Fi.

A full-size Pi 4 or 5 is overkill. The script does one thing: read a UID and POST to an API.

### Optional: OLED Display

A **128x64 SSD1306 OLED** (~$5) mounted on the reader unit gives immediate visual feedback to students ("Welcome, Aaliyah") without requiring the front desk to watch a terminal. Connect via I2C (same bus as the PN532 — address `0x3C` vs PN532's `0x24`, no conflict). Use the `adafruit-circuitpython-ssd1306` library.

If the OLED is omitted, the script falls back to terminal output (logged to a file) and LED-only feedback.

### LEDs

Two standard 5mm LEDs: one green (GPIO 17), one red (GPIO 27). Add 330Ω resistors in series. Green flashes on successful check-in, red on unknown card. Total cost: under $1.

---

## Full Cost Estimate

| Item | Cost |
|------|------|
| Raspberry Pi Zero 2 W | $15.00 |
| PN532 reader module | $8.00 |
| SSD1306 OLED display (optional) | $5.00 |
| LEDs + resistors + jumper wires | $1.00 |
| MicroSD card (16GB) | $5.00 |
| **Base unit (with OLED)** | **~$34.00** |
| MIFARE Classic 1K cards | $0.50/student |

A studio with 100 students: $34 + $50 = **$84 total for the first reader unit.** A second unit for a second entrance: another $34.

---

## Raspberry Pi Setup

### OS

Flash **Raspberry Pi OS Lite (64-bit)** to the microSD using Raspberry Pi Imager. In Imager, pre-configure:
- Hostname: `lsodance-rfid-1`
- Wi-Fi SSID and password (studio network)
- SSH enabled with your public key

Boot headless. SSH in at `lsodance-rfid-1.local`.

### Enable I2C

```bash
sudo raspi-config
# Interface Options → I2C → Enable
sudo reboot
```

Verify the PN532 and OLED are on the bus after reboot:

```bash
sudo i2cdetect -y 1
# PN532 appears at 0x24
# SSD1306 appears at 0x3C
```

### Python Environment

```bash
sudo apt update && sudo apt install -y python3-pip python3-venv
python3 -m venv /opt/lsodance-rfid/venv
source /opt/lsodance-rfid/venv/bin/activate
pip install \
  adafruit-circuitpython-pn532 \
  adafruit-circuitpython-ssd1306 \
  Pillow \
  requests \
  RPi.GPIO
```

---

## Python Script Design

The script runs as a systemd service. It is intentionally simple — one responsibility, retry-safe, offline-tolerant.

### Environment

The Pi reads configuration from `/opt/lsodance-rfid/.env`:

```bash
LSODANCE_API_BASE=https://api.lsodance.com
LSODANCE_DEVICE_ID=pi-studio-1
LSODANCE_API_KEY=<plaintext key — never commit this>
```

### Core Loop

```python
import os
import board
import busio
import time
import sqlite3
import requests
from datetime import datetime, timezone
from adafruit_pn532.i2c import PN532_I2C

SCAN_COOLDOWN_SECONDS = 30
API_BASE = os.environ["LSODANCE_API_BASE"]
DEVICE_ID = os.environ["LSODANCE_DEVICE_ID"]
API_KEY = os.environ["LSODANCE_API_KEY"]

i2c = busio.I2C(board.SCL, board.SDA)
pn532 = PN532_I2C(i2c, debug=False)
pn532.SAM_configuration()

last_seen: dict[str, float] = {}  # card_uid -> monotonic timestamp

while True:
    uid_bytes = pn532.read_passive_target(timeout=0.5)
    if uid_bytes is None:
        continue

    card_uid = uid_bytes.hex().upper()
    now = time.monotonic()

    # Suppress repeat scans within the cooldown window
    if card_uid in last_seen and (now - last_seen[card_uid]) < SCAN_COOLDOWN_SECONDS:
        continue
    last_seen[card_uid] = now

    checkin(card_uid)
```

### Check-In Function

```python
def checkin(card_uid: str) -> None:
    payload = {
        "card_uid": card_uid,
        "device_id": DEVICE_ID,
        "scanned_at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        resp = requests.post(
            f"{API_BASE}/api/rfid/checkin",
            json=payload,
            headers={"Authorization": f"Bearer {API_KEY}"},
            timeout=5,
        )
        if resp.status_code == 200:
            data = resp.json()
            show_success(data["student_name"], data["class_name"])
        elif resp.status_code == 404:
            show_error("Unknown card")
        elif resp.status_code == 409:
            data = resp.json()
            show_info(f"{data['student_name']} already checked in")
        else:
            queue_locally(payload)
    except requests.exceptions.RequestException:
        queue_locally(payload)
```

### Local Queue (Offline Tolerance)

When the API is unreachable — studio Wi-Fi drops, Railway is down, brief network blip — the Pi stores check-ins in a local SQLite database and retries on reconnect.

```python
DB_PATH = "/opt/lsodance-rfid/queue.db"

def init_db() -> None:
    con = sqlite3.connect(DB_PATH)
    con.execute("""
        CREATE TABLE IF NOT EXISTS checkin_queue (
            id        INTEGER PRIMARY KEY,
            card_uid  TEXT NOT NULL,
            device_id TEXT NOT NULL,
            scanned_at TEXT NOT NULL,           -- ISO 8601 UTC, e.g. 2026-05-21T18:45:00+00:00
            attempts  INTEGER DEFAULT 0,
            queued_at TEXT DEFAULT (datetime('now'))
        )
    """)
    con.commit()
    con.close()

def queue_locally(payload: dict) -> None:
    con = sqlite3.connect(DB_PATH)
    con.execute(
        "INSERT INTO checkin_queue (card_uid, device_id, scanned_at) VALUES (?, ?, ?)",
        (payload["card_uid"], payload["device_id"], payload["scanned_at"]),
    )
    con.commit()
    con.close()
    flash_led(RED_PIN)

def drain_queue() -> None:
    """Called every 60 seconds from a background thread."""
    con = sqlite3.connect(DB_PATH)
    rows = con.execute(
        "SELECT id, card_uid, device_id, scanned_at FROM checkin_queue ORDER BY id ASC"
    ).fetchall()
    for row_id, card_uid, device_id, scanned_at in rows:
        payload = {"card_uid": card_uid, "device_id": device_id, "scanned_at": scanned_at}
        try:
            resp = requests.post(
                f"{API_BASE}/api/rfid/checkin",
                json=payload,
                headers={"Authorization": f"Bearer {API_KEY}"},
                timeout=5,
            )
            if resp.status_code in (200, 404, 409):
                # Definitive response — remove from queue regardless of outcome
                con.execute("DELETE FROM checkin_queue WHERE id = ?", (row_id,))
                con.commit()
            # 5xx: leave in queue, retry next drain cycle
        except requests.exceptions.RequestException:
            con.execute(
                "UPDATE checkin_queue SET attempts = attempts + 1 WHERE id = ?", (row_id,)
            )
            con.commit()
            break  # Stop draining on network failure; wait for next cycle
    con.close()
```

Queued records older than 24 hours are purged on each drain cycle — a check-in from yesterday's class is no longer meaningful attendance data.

### LED and OLED Feedback

```python
import RPi.GPIO as GPIO

GREEN_PIN = 17
RED_PIN = 27

GPIO.setmode(GPIO.BCM)
GPIO.setup(GREEN_PIN, GPIO.OUT)
GPIO.setup(RED_PIN, GPIO.OUT)

def flash_led(pin: int, duration: float = 0.5) -> None:
    GPIO.output(pin, GPIO.HIGH)
    time.sleep(duration)
    GPIO.output(pin, GPIO.LOW)

def show_success(student_name: str, class_name: str) -> None:
    flash_led(GREEN_PIN)
    oled_display(f"Welcome!\n{student_name}\n{class_name}")
    print(f"[{datetime.now().isoformat()}] CHECK-IN: {student_name} -> {class_name}")

def show_error(message: str) -> None:
    flash_led(RED_PIN)
    oled_display(message)
    print(f"[{datetime.now().isoformat()}] ERROR: {message}")
```

### Systemd Service

```ini
# /etc/systemd/system/lsodance-rfid.service
[Unit]
Description=LSODance RFID Check-In
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=pi
WorkingDirectory=/opt/lsodance-rfid
EnvironmentFile=/opt/lsodance-rfid/.env
ExecStart=/opt/lsodance-rfid/venv/bin/python /opt/lsodance-rfid/checkin.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable lsodance-rfid
sudo systemctl start lsodance-rfid
sudo journalctl -u lsodance-rfid -f  # tail logs
```

---

## API Endpoint Contract

The RFID endpoint lives on the Fastify backend alongside all other API routes. The Pi is just another client — no special network access, no direct database connection.

### `POST /api/rfid/checkin`

**Authentication:** `Authorization: Bearer <api_key>` — the plaintext key stored on the Pi. Fastify hashes the incoming key with bcrypt and compares it against `api_key_hash` in the `rfid_devices` table.

**Request body:**

```json
{
  "card_uid": "A3F2B1C4",
  "device_id": "pi-studio-1",
  "scanned_at": "2026-05-21T18:45:00.000Z"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `card_uid` | string | Yes | Hex UID read from the card (uppercase) |
| `device_id` | string | Yes | Matches the `device_name` in `rfid_devices` |
| `scanned_at` | ISO 8601 string | Yes | Timestamp from the Pi's clock (UTC) |

**Responses:**

`200 OK` — Student found and checked in:
```json
{
  "student_name": "Aaliyah Johnson",
  "class_name": "Junior Hip Hop",
  "status": "checked_in"
}
```

`404 Not Found` — UID not registered to any student:
```json
{
  "error": "unknown_card"
}
```

`409 Conflict` — Student already checked in within this session:
```json
{
  "error": "already_checked_in",
  "student_name": "Aaliyah Johnson"
}
```

`401 Unauthorized` — Missing or invalid API key.

`429 Too Many Requests` — Rate limit exceeded (see Security section).

**Server-side logic:**

1. Verify API key against `rfid_devices` table (bcrypt compare). Extract `organization_id` from the device record — the Pi never sends it.
2. Look up student by `rfid_uid = card_uid` within the org.
3. Find the active `class_session` for the current time (within a 15-minute grace window at session start/end).
4. Check for an existing attendance record for this student + session. If found, return 409.
5. Insert attendance record: `check_in_method = 'rfid'`, `status = 'present'`.
6. Supabase Realtime broadcasts the insert to connected frontends automatically.
7. Return 200 with student name and class name.

**If no active session:** Return `404 { "error": "no_active_session" }`. The Pi displays "No active class." This is the expected behavior during class transitions.

---

## Security

### API Key Storage

The Pi stores its API key in plaintext in `/opt/lsodance-rfid/.env`. The server stores only a bcrypt hash (`api_key_hash`) in the `rfid_devices` table, as specified in the architecture document.

To provision a new device, generate a random key, hash it server-side, and store the hash:

```sql
-- Insert new device with pre-computed bcrypt hash
INSERT INTO rfid_devices (organization_id, device_name, api_key_hash, last_seen_at)
VALUES ('<org_uuid>', 'pi-studio-1', '<bcrypt_hash_of_plaintext_key>', NOW());
```

Store the plaintext key in the Pi's `.env`. Never put the plaintext in version control or logs.

### Rate Limiting

Fastify applies rate limiting at the endpoint level using `@fastify/rate-limit`:

- **Per-card cooldown:** 1 accepted check-in per `card_uid` per 30 seconds. The Pi also enforces this locally (the `last_seen` dict), but the server is the authoritative gate. This prevents a tapped card from generating duplicate attendance records if the Pi retries a failed request.
- **Per-device rate limit:** Maximum 120 requests per minute per `device_id`. This is well above any realistic scanning rate (a class of 30 students takes under 2 minutes to check in) and guards against a malfunctioning Pi flooding the API.

```typescript
// Fastify plugin registration
fastify.register(require('@fastify/rate-limit'), {
  max: 120,
  timeWindow: '1 minute',
  keyGenerator: (request) => request.body?.device_id ?? request.ip,
});
```

### Physical Security

The Pi will be mounted at the studio entrance. The SD card is the primary attack surface — if someone physically removes it, they get the plaintext API key. Mitigations:

- Mount the Pi in a locked enclosure.
- The API key can be revoked instantly by deleting the row in `rfid_devices`. Generate a new key if a device is lost or compromised.
- The key only authorizes `POST /api/rfid/checkin` — no other routes accept it.

---

## Connecting Cards to Students

Before a student can use RFID check-in, their card UID must be recorded in the `students` table.

The `rfid_uid` column already exists in the data model (nullable). The registration flow:

1. Admin taps the card on the Pi (or a USB HID card reader connected to a laptop — these emulate keyboard input and cost ~$10).
2. The UID appears as typed text in the admin UI's student edit form.
3. Admin selects the student and saves.
4. Fastify writes `rfid_uid` to the student record.

---

## Integration with the Attendance Data Model

RFID check-ins write to the same `attendance` table as manual check-ins. The `check_in_method` column distinguishes them:

```sql
-- Attendance record created by RFID check-in
INSERT INTO attendance (
  organization_id,
  class_session_id,
  student_id,
  status,
  check_in_method,
  recorded_at
) VALUES (
  '<org_uuid>',
  '<session_uuid>',
  '<student_uuid>',
  'present',
  'rfid',
  NOW()
);
```

The admin dashboard and reporting queries do not need to treat RFID records differently. A student checked in via RFID looks identical to one marked present by Mrs. Goodman on the iPad, except for `check_in_method` (useful for audit and analytics).

Supabase Realtime fires on the `attendance` INSERT. The iPad roster updates live — Mrs. Goodman sees the student's name turn green as they tap their card at the door.

---

## Build Sequence

RFID check-in sits in Layer 3 of the platform build order, after manual attendance is working. The endpoint and data model are stubbed earlier so that `rfid_uid` on students and the `rfid_devices` table are never a retrofit.

| Step | What | When |
|------|------|------|
| 1 | Add `rfid_uid` (nullable) to students schema | Layer 3 start — even if no Pi exists yet |
| 2 | Create `rfid_devices` table | Layer 3 start |
| 3 | Implement `POST /api/rfid/checkin` endpoint | Layer 3 |
| 4 | Assemble Pi hardware | After Layer 3 endpoint is live |
| 5 | Flash Pi OS, configure Wi-Fi, deploy script | After hardware is assembled |
| 6 | Register first device in `rfid_devices` | Before Pi goes live in studio |
| 7 | Issue cards to students, record UIDs | Before or during first RFID-enabled class |

The endpoint can return `501 Not Implemented` before Step 4 if needed — but the database schema and route exist from Layer 3, so there is nothing to retrofit later.
