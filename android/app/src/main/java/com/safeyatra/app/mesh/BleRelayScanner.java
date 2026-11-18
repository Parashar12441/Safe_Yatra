package com.safeyatra.app.mesh;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.le.BluetoothLeScanner;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanFilter;
import android.bluetooth.le.ScanResult;
import android.bluetooth.le.ScanSettings;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import java.util.Collections;
import java.util.HashSet;
import java.util.Set;

/**
 * Duty-cycled BLE scanner for the Safe Yatra relay network.
 *
 * Runs on Tourist B's device. Discovers nearby offline tourists (Tourist A)
 * who are broadcasting Safe Yatra BLE beacons.
 *
 * Battery-conscious duty cycling:
 *   - Standard mode:  Scan for 12 seconds, sleep for 168 seconds (3-minute cycle).
 *   - Emergency mode:  Scan for 12 seconds, sleep for 48 seconds  (1-minute cycle).
 *
 * Continuous scanning would drain ~10-15% battery/hour; duty cycling reduces this
 * to approximately 0.5-1% per hour in standard mode.
 */
public class BleRelayScanner {

    private static final String TAG = "SafeYatraRelayScan";

    /** Scan window duration in milliseconds. */
    private static final long SCAN_WINDOW_MS = 12_000;   // 12 seconds

    /** Sleep between scans in standard mode. */
    private static final long STANDARD_SLEEP_MS = 168_000; // 2 min 48 sec (total cycle = 3 min)

    /** Sleep between scans in emergency mode (faster discovery). */
    private static final long EMERGENCY_SLEEP_MS = 48_000;  // 48 sec (total cycle = 1 min)

    private final BluetoothLeScanner scanner;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private boolean isScanning = false;
    private boolean isRunning = false;
    private boolean isEmergencyMode = false;

    /**
     * Tracks EIDs seen in the current scan window to avoid duplicate sightings.
     * Cleared at the start of each scan cycle.
     */
    private final Set<String> seenThisCycle = new HashSet<>();

    /**
     * Callback interface for processing discovered beacons.
     */
    public interface OnSightingListener {
        /**
         * Called when a Safe Yatra BLE beacon is detected nearby.
         *
         * @param eidHex 32-character hex string of the 16-byte EID.
         * @param rssi   Received Signal Strength Indicator (dBm). Closer = less negative.
         * @param isSos  true if the discovered tourist has activated emergency SOS.
         */
        void onSighting(String eidHex, int rssi, boolean isSos);
    }

    private final OnSightingListener listener;

    public BleRelayScanner(OnSightingListener listener) {
        this.listener = listener;
        BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
        this.scanner = (adapter != null && adapter.isEnabled())
                ? adapter.getBluetoothLeScanner()
                : null;
    }

    /**
     * BLE scan callback: parses Safe Yatra service data from discovered advertisements.
     */
    private final ScanCallback scanCallback = new ScanCallback() {
        @Override
        public void onScanResult(int callbackType, ScanResult result) {
            if (result.getScanRecord() == null) return;

            byte[] data = result.getScanRecord().getServiceData(
                    BleAdvertiserManager.SAFE_YATRA_SERVICE_UUID);

            if (data != null && data.length >= 1 + CryptoUtils.EID_LENGTH_BYTES) {
                boolean isSos = (data[0] & 0x01) == 0x01;

                byte[] eid = new byte[CryptoUtils.EID_LENGTH_BYTES];
                System.arraycopy(data, 1, eid, 0, CryptoUtils.EID_LENGTH_BYTES);
                String eidHex = CryptoUtils.bytesToHex(eid);

                // Deduplicate within the same scan window
                if (seenThisCycle.add(eidHex)) {
                    int rssi = result.getRssi();
                    Log.d(TAG, "Beacon found: EID=" + eidHex.substring(0, 8) +
                            "… RSSI=" + rssi + " SOS=" + isSos);

                    if (listener != null) {
                        listener.onSighting(eidHex, rssi, isSos);
                    }
                }
            }
        }

        @Override
        public void onScanFailed(int errorCode) {
            isScanning = false;
            Log.e(TAG, "BLE scan failed with error: " + errorCode);
        }
    };

    /**
     * Starts the duty-cycled BLE scanning loop.
     */
    public void startDutyCycledScanning() {
        if (scanner == null) {
            Log.w(TAG, "BLE scanner not available. Cannot start relay scanning.");
            return;
        }
        if (isRunning) return;

        isRunning = true;
        Log.i(TAG, "Starting duty-cycled scanning [mode=" +
                (isEmergencyMode ? "EMERGENCY" : "STANDARD") + "]");
        runScanCycle();
    }

    /**
     * Executes one scan cycle: scan for SCAN_WINDOW_MS, then sleep.
     */
    private void runScanCycle() {
        if (!isRunning) return;

        seenThisCycle.clear();
        startSingleScan();

        // After the scan window, stop scanning and schedule the next cycle
        handler.postDelayed(() -> {
            stopSingleScan();

            if (isRunning) {
                long sleepMs = isEmergencyMode ? EMERGENCY_SLEEP_MS : STANDARD_SLEEP_MS;
                handler.postDelayed(this::runScanCycle, sleepMs);
            }
        }, SCAN_WINDOW_MS);
    }

    private void startSingleScan() {
        if (isScanning || scanner == null) return;

        ScanFilter filter = new ScanFilter.Builder()
                .setServiceUuid(BleAdvertiserManager.SAFE_YATRA_SERVICE_UUID)
                .build();

        ScanSettings settings = new ScanSettings.Builder()
                .setScanMode(isEmergencyMode
                        ? ScanSettings.SCAN_MODE_LOW_LATENCY
                        : ScanSettings.SCAN_MODE_LOW_POWER)
                .build();

        try {
            scanner.startScan(Collections.singletonList(filter), settings, scanCallback);
            isScanning = true;
        } catch (SecurityException e) {
            Log.e(TAG, "Missing BLE scan permission", e);
        }
    }

    private void stopSingleScan() {
        if (!isScanning || scanner == null) return;
        try {
            scanner.stopScan(scanCallback);
        } catch (Exception e) {
            Log.w(TAG, "Error stopping scan", e);
        }
        isScanning = false;
    }

    /**
     * Switches the scanner between emergency (1-min cycle) and standard (3-min cycle) modes.
     */
    public void setEmergencyMode(boolean emergency) {
        this.isEmergencyMode = emergency;
        Log.i(TAG, "Scanner mode switched to " + (emergency ? "EMERGENCY" : "STANDARD"));
    }

    /**
     * Completely stops the duty-cycling loop and any active scan.
     */
    public void stopAll() {
        isRunning = false;
        handler.removeCallbacksAndMessages(null);
        stopSingleScan();
        seenThisCycle.clear();
        Log.i(TAG, "Relay scanner stopped.");
    }

    public boolean isRunning() {
        return isRunning;
    }
}

