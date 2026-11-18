package com.safeyatra.app.mesh;

import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Log;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Arrays;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/**
 * Cryptographic utilities for the Safe Yatra Offline Finding Network.
 *
 * Generates rotating Ephemeral Identifiers (EIDs) that change every 15 minutes,
 * preventing third-party tracking of tourists via static Bluetooth addresses.
 *
 * Protocol:
 *   1. Each tourist receives a masterSecret on registration (hex string).
 *   2. Every 15 minutes (900-second window), derive:
 *        EID_t = Truncate_16bytes( HMAC-SHA256(masterSecret, floor(epoch / 900)) )
 *   3. Only the Safe Yatra backend can reverse-map EID → tourist identity.
 */
public class CryptoUtils {

    private static final String TAG = "SafeYatraCrypto";

    /** Duration of one EID rotation window in seconds (15 minutes). */
    public static final int EID_ROTATION_SECONDS = 900;

    /** Length of a truncated EID in bytes. */
    public static final int EID_LENGTH_BYTES = 16;

    /**
     * Generates a 16-byte Rotating Ephemeral Identifier (EID).
     *
     * @param masterSecretHex The tourist's master secret (hex-encoded string from backend).
     * @param epochSeconds    Current Unix epoch time in seconds.
     * @return 16-byte EID, or a zeroed array on failure.
     */
    public static byte[] generateRotatingEID(String masterSecretHex, long epochSeconds) {
        try {
            long timeWindow = epochSeconds / EID_ROTATION_SECONDS;

            byte[] keyBytes = hexToBytes(masterSecretHex);
            if (keyBytes.length == 0) {
                // Fallback: treat as raw UTF-8 if not valid hex
                keyBytes = masterSecretHex.getBytes(StandardCharsets.UTF_8);
            }

            Mac hmac = Mac.getInstance("HmacSHA256");
            SecretKeySpec secretKey = new SecretKeySpec(keyBytes, "HmacSHA256");
            hmac.init(secretKey);

            byte[] timeBytes = ByteBuffer.allocate(8).putLong(timeWindow).array();
            byte[] hash = hmac.doFinal(timeBytes);

            // Truncate to first 16 bytes for the BLE advertisement payload
            return Arrays.copyOfRange(hash, 0, EID_LENGTH_BYTES);
        } catch (Exception e) {
            Log.e(TAG, "EID generation failed", e);
            return new byte[EID_LENGTH_BYTES];
        }
    }

    /**
     * Generates a fresh random master secret (32 bytes = 64 hex chars).
     * Used when a tourist registers and no server-issued key is available yet.
     */
    public static String generateMasterSecret() {
        byte[] secret = new byte[32];
        new SecureRandom().nextBytes(secret);
        return bytesToHex(secret);
    }

    /**
     * Returns the current EID time-window index for a given epoch.
     */
    public static long getTimeWindow(long epochSeconds) {
        return epochSeconds / EID_ROTATION_SECONDS;
    }

    /**
     * Checks whether the EID window has changed since the last computed window.
     */
    public static boolean hasWindowChanged(long previousWindow, long currentEpochSeconds) {
        return getTimeWindow(currentEpochSeconds) != previousWindow;
    }

    // ── Hex conversion utilities ──────────────────────────────────────────────

    public static String bytesToHex(byte[] bytes) {
        if (bytes == null) return "";
        StringBuilder sb = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) {
            sb.append(String.format("%02X", b));
        }
        return sb.toString();
    }

    public static byte[] hexToBytes(String hex) {
        if (hex == null || hex.length() % 2 != 0) return new byte[0];
        try {
            int len = hex.length();
            byte[] data = new byte[len / 2];
            for (int i = 0; i < len; i += 2) {
                data[i / 2] = (byte) ((Character.digit(hex.charAt(i), 16) << 4)
                        + Character.digit(hex.charAt(i + 1), 16));
            }
            return data;
        } catch (Exception e) {
            return new byte[0];
        }
    }
}

