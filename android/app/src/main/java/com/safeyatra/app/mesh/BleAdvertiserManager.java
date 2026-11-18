package com.safeyatra.app.mesh;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.le.AdvertiseCallback;
import android.bluetooth.le.AdvertiseData;
import android.bluetooth.le.AdvertiseSettings;
import android.bluetooth.le.BluetoothLeAdvertiser;
import android.os.ParcelUuid;
import android.util.Log;

/**
 * Manages BLE Low Energy advertising for the Safe Yatra Offline Finding Network.
 *
 * Tourist A's phone broadcasts a BLE beacon containing:
 *   - 1-byte status flag (0x00 = normal, 0x01 = SOS emergency)
 *   - 16-byte rotating Ephemeral Identifier (EID)
 *
 * Total payload: 17 bytes of service data, well within the 31-byte legacy BLE limit.
 *
 * Power modes:
 *   - Normal:    ADVERTISE_MODE_LOW_POWER  (~1000ms interval, battery-friendly)
 *   - Emergency: ADVERTISE_MODE_LOW_LATENCY (~160ms interval, maximum discoverability)
 */
public class BleAdvertiserManager {

    private static final String TAG = "SafeYatraBLEAdv";

    /**
     * Custom 16-bit BLE Service UUID for the Safe Yatra mesh network.
     * Uses the Bluetooth SIG's vendor-specific range (0xFEAA).
     * In production, register a proper UUID through Bluetooth SIG or use a full 128-bit UUID.
     */
    public static final ParcelUuid SAFE_YATRA_SERVICE_UUID =
            ParcelUuid.fromString("0000FEAA-0000-1000-8000-00805F9B34FB");

    /** Status byte: Normal operation. */
    public static final byte STATUS_NORMAL = 0x00;

    /** Status byte: SOS Emergency active — nearby relays should prioritize this beacon. */
    public static final byte STATUS_SOS = 0x01;

    private final BluetoothLeAdvertiser advertiser;
    private AdvertiseCallback activeCallback;
    private boolean isAdvertising = false;
    private byte[] currentEid = null;

    public BleAdvertiserManager() {
        BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
        if (adapter != null && adapter.isEnabled() && adapter.isMultipleAdvertisementSupported()) {
            this.advertiser = adapter.getBluetoothLeAdvertiser();
        } else {
            this.advertiser = null;
            Log.w(TAG, "BLE advertising not available on this device.");
        }
    }

    /**
     * @return true if this device supports BLE peripheral advertising.
     */
    public boolean isSupported() {
        return advertiser != null;
    }

    /**
     * @return true if currently broadcasting a beacon.
     */
    public boolean isAdvertising() {
        return isAdvertising;
    }

    /**
     * Starts or restarts BLE advertising with a new EID and status flag.
     *
     * @param eid16Bytes 16-byte Ephemeral Identifier from CryptoUtils.
     * @param isSos      true to broadcast emergency SOS status at high frequency.
     */
    public void startAdvertising(byte[] eid16Bytes, boolean isSos) {
        if (advertiser == null) {
            Log.e(TAG, "Cannot advertise: BLE advertiser is null.");
            return;
        }

        // Stop any active advertisement first
        stopAdvertising();

        this.currentEid = eid16Bytes;

        AdvertiseSettings settings = new AdvertiseSettings.Builder()
                .setAdvertiseMode(isSos
                        ? AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY    // ~160ms (SOS)
                        : AdvertiseSettings.ADVERTISE_MODE_LOW_POWER)      // ~1000ms (Normal)
                .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_HIGH) // Maximum range
                .setConnectable(false)  // Beacon-only, no GATT connection needed
                .setTimeout(0)          // Advertise indefinitely until stopped
                .build();

        // Build the 17-byte service data payload
        byte[] serviceData = new byte[1 + CryptoUtils.EID_LENGTH_BYTES]; // 1 status + 16 EID
        serviceData[0] = isSos ? STATUS_SOS : STATUS_NORMAL;
        System.arraycopy(eid16Bytes, 0, serviceData, 1, CryptoUtils.EID_LENGTH_BYTES);

        AdvertiseData data = new AdvertiseData.Builder()
                .setIncludeDeviceName(false)      // Save bytes: no device name in beacon
                .setIncludeTxPowerLevel(false)     // Save bytes: no TX power level
                .addServiceUuid(SAFE_YATRA_SERVICE_UUID)
                .addServiceData(SAFE_YATRA_SERVICE_UUID, serviceData)
                .build();

        activeCallback = new AdvertiseCallback() {
            @Override
            public void onStartSuccess(AdvertiseSettings settingsInEffect) {
                isAdvertising = true;
                Log.i(TAG, "BLE Beacon active [SOS=" + isSos +
                        ", EID=" + CryptoUtils.bytesToHex(eid16Bytes).substring(0, 8) + "…]");
            }

            @Override
            public void onStartFailure(int errorCode) {
                isAdvertising = false;
                String reason;
                switch (errorCode) {
                    case ADVERTISE_FAILED_DATA_TOO_LARGE:
                        reason = "DATA_TOO_LARGE";
                        break;
                    case ADVERTISE_FAILED_TOO_MANY_ADVERTISERS:
                        reason = "TOO_MANY_ADVERTISERS";
                        break;
                    case ADVERTISE_FAILED_ALREADY_STARTED:
                        reason = "ALREADY_STARTED";
                        break;
                    case ADVERTISE_FAILED_FEATURE_UNSUPPORTED:
                        reason = "FEATURE_UNSUPPORTED";
                        break;
                    default:
                        reason = "UNKNOWN(" + errorCode + ")";
                }
                Log.e(TAG, "BLE Beacon start failed: " + reason);
            }
        };

        advertiser.startAdvertising(settings, data, activeCallback);
    }

    /**
     * Stops the current BLE advertisement.
     */
    public void stopAdvertising() {
        if (advertiser != null && activeCallback != null && isAdvertising) {
            try {
                advertiser.stopAdvertising(activeCallback);
            } catch (Exception e) {
                Log.w(TAG, "Error stopping advertiser", e);
            }
            isAdvertising = false;
            activeCallback = null;
        }
    }

    /**
     * @return The currently broadcasting EID, or null if not advertising.
     */
    public byte[] getCurrentEid() {
        return currentEid;
    }
}

