# Safe Yatra — Flutter + Native Android Offline Finding Network

Production-grade Flutter application implementing an **Apple AirTag-like Crowdsourced Offline Finding Network**, **Cell Tower Triangulation Fallback**, and **Delay-Tolerant Store-and-Forward Relaying** for tourist safety in remote, zero-connectivity regions.

---

## 🏛️ Architecture Overview

```
Flutter (Dart UI Layer)
  ├── lib/screens/tourist_dashboard.dart     -> Tactical OpenStreetMap, Dynamic Mesh Pill, Center FAB
  ├── lib/screens/mesh_status_screen.dart    -> Diagnostics, 15-min EID countdown, Outbox inspector
  ├── lib/widgets/sos_hold_button.dart       -> 3-second animated press-and-hold emergency trigger
  ├── lib/services/mesh_service.dart         -> Type-safe MethodChannel bridge to Android
  └── lib/services/relay_sync_service.dart   -> Auto-syncs SQLite outbox to Firestore when online
          │
          │ MethodChannel ("com.safeyatra.app/mesh")
          ▼
Native Android (Kotlin Background Layer)
  ├── MainActivity.kt                        -> Platform Channel Dispatcher
  ├── mesh/SafeYatraMeshService.kt           -> Persistent ForegroundService (location|connectedDevice)
  ├── mesh/BleAdvertiserManager.kt           -> 15-min rotating EID beacon (Service UUID 0xFEAA)
  ├── mesh/BleRelayScanner.kt                -> Duty-cycled scanner (12s scan / 3m sleep, <1% bat/hr)
  ├── mesh/OfflineLocationManager.kt         -> Autonomous GPS -> OpenCellID SQLite centroid fallback
  ├── mesh/RelayDbHelper.kt                  -> Local SQLite Outbox (safeyatra_relay.db)
  └── mesh/CryptoUtils.kt                    -> HMAC-SHA256 15-minute rolling Ephemeral ID generator
```

---

## 🚀 Getting Started

### Prerequisites
1. **Flutter SDK**: 3.0.0 or higher.
2. **Android SDK**: API level 24 minimum, target SDK 34 (Android 14+).
3. **Android Device**: Two physical Android devices with Bluetooth 4.2+ (LE Advertiser support).

### Setup & Run
```bash
cd safe_yatra_flutter

# 1. Fetch Flutter packages
flutter pub get

# 2. Run on connected Android device
flutter run -d <device-id>
```

---

## 🧪 Field Testing Guide (Simulating Offline AirTag Tracking)

### Test 1: Screen-Off BLE Beacon Advertising
1. Launch app on **Device A**.
2. Grant all Bluetooth and Location permissions when prompted.
3. Lock the phone screen.
4. Using an external Bluetooth scanner (e.g. **nRF Connect** on Google Play), scan and verify:
   * **Service UUID**: `0000FEAA-0000-1000-8000-00805F9B34FB`.
   * **Payload**: 17 bytes (`[0x00 status] + [16-byte rotating EID]`).

### Test 2: Two-Device AirTag-Style Offline Relay
1. **Device A (Lost Tourist)**:
   * Enable **Airplane Mode** (simulate zero cellular & internet coverage).
   * Press and hold the **SOS Emergency Button** for 3 seconds.
   * Device A switches BLE beacon to **High Frequency SOS mode** (`~160ms` broadcast).
2. **Device B (Passing Hiker)**:
   * Has Safe Yatra installed and walks within 30-50 meters of Device A.
   * Device B's background duty-cycled scanner detects Device A's beacon.
   * Device B captures its own GPS coordinates and stores `{ eid, witness_lat, witness_lon, is_sos: true }` in its local SQLite outbox.
3. **Cloud Flush**:
   * Device B returns to cell reception or Wi-Fi.
   * Safe Yatra's `RelaySyncService` automatically flushes queued sightings to Firestore `mesh_sightings` and escalates to `alerts`.
   * Authorities instantly see Device A's distress location on the tactical dashboard!

