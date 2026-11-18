package com.safeyatra.app.mesh;

import android.annotation.SuppressLint;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.location.Location;
import android.location.LocationManager;
import android.telephony.CellIdentityGsm;
import android.telephony.CellIdentityLte;
import android.telephony.CellIdentityNr;
import android.telephony.CellIdentityWcdma;
import android.telephony.CellInfo;
import android.telephony.CellInfoGsm;
import android.telephony.CellInfoLte;
import android.telephony.CellInfoNr;
import android.telephony.CellInfoWcdma;
import android.telephony.TelephonyManager;
import android.os.Build;
import android.util.Log;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;

/**
 * Multi-source offline positioning engine for Safe Yatra.
 *
 * Priority chain:
 *   1. Hardware GNSS (autonomous satellite fix — works without internet/SIM)
 *   2. Cell tower triangulation using a local OpenCellID database slice
 *   3. Last-known location from Android LocationManager
 *
 * Cell tower positioning accuracy: 300m (urban) to 2-5km (rural/remote).
 * GPS accuracy: typically 3-10m outdoors.
 */
public class OfflineLocationManager {

    private static final String TAG = "SafeYatraOfflineLoc";

    /** Maximum age (ms) for a GPS fix to be considered "fresh". */
    private static final long GPS_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

    /** Name of the pre-packaged regional cell tower database in assets. */
    private static final String TOWER_DB_ASSET_NAME = "cell_towers_india.db";

    /** Name of the copied database file in app internal storage. */
    private static final String TOWER_DB_LOCAL_NAME = "cell_towers_regional.db";

    private final Context context;
    private SQLiteDatabase towerDb;

    public OfflineLocationManager(Context context) {
        this.context = context;
    }

    // ── Result container ────────────────────────────────────────────────────

    /**
     * Encapsulates a resolved position with its source and accuracy.
     */
    public static class ResolvedPosition {
        public final double latitude;
        public final double longitude;
        public final float accuracy;       // Estimated accuracy in metres
        public final String source;        // "GPS", "CELL_TOWER", or "LAST_KNOWN"
        public final long timestamp;       // Unix epoch ms when the fix was obtained

        public ResolvedPosition(double lat, double lon, float acc, String src, long ts) {
            this.latitude = lat;
            this.longitude = lon;
            this.accuracy = acc;
            this.source = src;
            this.timestamp = ts;
        }

        @Override
        public String toString() {
            return String.format("[%s] %.5f, %.5f ±%.0fm", source, latitude, longitude, accuracy);
        }
    }

    // ── Public API ──────────────────────────────────────────────────────────

    /**
     * Returns the best available offline position using the priority chain.
     *
     * @return A ResolvedPosition, or null if no position source is available.
     */
    @SuppressLint("MissingPermission")
    public ResolvedPosition getBestAvailableLocation() {
        // 1. Try fresh hardware GNSS
        ResolvedPosition gpsFix = getGpsLocation();
        if (gpsFix != null && gpsFix.accuracy <= 100) {
            return gpsFix;
        }

        // 2. Fallback to cell tower database
        ResolvedPosition cellFix = getCellTowerLocation();
        if (cellFix != null) {
            // If we also have a stale GPS fix, return whichever is more accurate
            if (gpsFix != null && gpsFix.accuracy < cellFix.accuracy) {
                return gpsFix;
            }
            return cellFix;
        }

        // 3. Return stale GPS if that's all we have
        if (gpsFix != null) {
            return gpsFix;
        }

        // 4. Last resort: Android's last known from any provider
        return getLastKnownLocation();
    }

    // ── GPS (Priority 1) ────────────────────────────────────────────────────

    @SuppressLint("MissingPermission")
    private ResolvedPosition getGpsLocation() {
        try {
            LocationManager lm = (LocationManager) context.getSystemService(Context.LOCATION_SERVICE);
            if (lm == null) return null;

            Location gps = lm.getLastKnownLocation(LocationManager.GPS_PROVIDER);
            if (gps != null && (System.currentTimeMillis() - gps.getTime()) < GPS_MAX_AGE_MS) {
                return new ResolvedPosition(
                        gps.getLatitude(), gps.getLongitude(),
                        gps.getAccuracy(), "GPS", gps.getTime());
            }
        } catch (Exception e) {
            Log.w(TAG, "GPS provider error", e);
        }
        return null;
    }

    // ── Cell Tower Database (Priority 2) ────────────────────────────────────

    @SuppressLint("MissingPermission")
    private ResolvedPosition getCellTowerLocation() {
        try {
            TelephonyManager tm = (TelephonyManager) context.getSystemService(Context.TELEPHONY_SERVICE);
            if (tm == null) return null;

            List<CellInfo> cellList = tm.getAllCellInfo();
            if (cellList == null || cellList.isEmpty()) return null;

            SQLiteDatabase db = getOrOpenTowerDatabase();
            if (db == null) return null;

            // Collect all visible towers with their identifiers
            List<CellTowerReading> readings = new ArrayList<>();
            for (CellInfo info : cellList) {
                CellTowerReading reading = extractCellReading(info);
                if (reading != null) {
                    readings.add(reading);
                }
            }

            if (readings.isEmpty()) return null;

            // Single tower: return its centroid directly
            if (readings.size() == 1) {
                return queryTowerPosition(db, readings.get(0));
            }

            // Multiple towers: signal-weighted centroid multilateration
            return calculateWeightedCentroid(db, readings);

        } catch (Exception e) {
            Log.w(TAG, "Cell tower positioning error", e);
            return null;
        }
    }

    /**
     * Extracts cell identity fields from a CellInfo object.
     */
    private CellTowerReading extractCellReading(CellInfo info) {
        int cid = -1, lac = -1, mcc = -1, mnc = -1;
        int signalStrength = -120; // Default weak

        if (info instanceof CellInfoLte) {
            CellIdentityLte id = ((CellInfoLte) info).getCellIdentity();
            cid = id.getCi();
            lac = id.getTac();
            mcc = id.getMcc();
            mnc = id.getMnc();
            signalStrength = ((CellInfoLte) info).getCellSignalStrength().getDbm();
        } else if (info instanceof CellInfoGsm) {
            CellIdentityGsm id = ((CellInfoGsm) info).getCellIdentity();
            cid = id.getCid();
            lac = id.getLac();
            mcc = id.getMcc();
            mnc = id.getMnc();
            signalStrength = ((CellInfoGsm) info).getCellSignalStrength().getDbm();
        } else if (info instanceof CellInfoWcdma) {
            CellIdentityWcdma id = ((CellInfoWcdma) info).getCellIdentity();
            cid = id.getCid();
            lac = id.getLac();
            mcc = id.getMcc();
            mnc = id.getMnc();
            signalStrength = ((CellInfoWcdma) info).getCellSignalStrength().getDbm();
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && info instanceof CellInfoNr) {
            CellIdentityNr id = (CellIdentityNr) ((CellInfoNr) info).getCellIdentity();
            cid = id.getNci() != Long.MAX_VALUE ? (int) id.getNci() : -1;
            lac = id.getTac();
            mcc = id.getMccString() != null ? Integer.parseInt(id.getMccString()) : -1;
            mnc = id.getMncString() != null ? Integer.parseInt(id.getMncString()) : -1;
            signalStrength = ((CellInfoNr) info).getCellSignalStrength().getDbm();
        }

        // Filter out invalid readings
        if (cid == -1 || cid == Integer.MAX_VALUE || mcc == -1 || mcc == Integer.MAX_VALUE) {
            return null;
        }

        return new CellTowerReading(mcc, mnc, lac, cid, signalStrength);
    }

    /**
     * Queries the offline tower DB for a single tower's coordinates.
     */
    private ResolvedPosition queryTowerPosition(SQLiteDatabase db, CellTowerReading r) {
        String sql = "SELECT lat, lon, range FROM cell_towers " +
                "WHERE mcc=? AND mnc=? AND lac=? AND cid=? LIMIT 1";
        try (Cursor cursor = db.rawQuery(sql, new String[]{
                String.valueOf(r.mcc), String.valueOf(r.mnc),
                String.valueOf(r.lac), String.valueOf(r.cid)})) {
            if (cursor.moveToFirst()) {
                double lat = cursor.getDouble(0);
                double lon = cursor.getDouble(1);
                float range = cursor.getFloat(2);
                return new ResolvedPosition(lat, lon,
                        range > 0 ? range : 1000f, "CELL_TOWER",
                        System.currentTimeMillis());
            }
        }
        return null;
    }

    /**
     * Calculates a signal-weighted centroid from multiple cell tower positions.
     * Weight formula: w_i = 10 ^ (RSRP_i / 20)
     * Stronger signals contribute more to the estimated position.
     */
    private ResolvedPosition calculateWeightedCentroid(SQLiteDatabase db, List<CellTowerReading> readings) {
        double sumLat = 0, sumLon = 0, sumWeight = 0;
        float maxRange = 0;
        int matched = 0;

        for (CellTowerReading r : readings) {
            ResolvedPosition pos = queryTowerPosition(db, r);
            if (pos != null) {
                // Weight: stronger signal = higher weight
                double weight = Math.pow(10, r.signalDbm / 20.0);
                sumLat += pos.latitude * weight;
                sumLon += pos.longitude * weight;
                sumWeight += weight;
                maxRange = Math.max(maxRange, pos.accuracy);
                matched++;
            }
        }

        if (matched == 0 || sumWeight == 0) return null;

        // With multiple towers, accuracy improves compared to single tower
        float estimatedAccuracy = matched >= 3
                ? maxRange * 0.4f   // Triangulation improves accuracy significantly
                : maxRange * 0.7f;  // Two-tower bilateration is moderately better

        return new ResolvedPosition(
                sumLat / sumWeight, sumLon / sumWeight,
                estimatedAccuracy, "CELL_TOWER",
                System.currentTimeMillis());
    }

    // ── Last Known Location (Priority 3) ─────────────────────────────────────

    @SuppressLint("MissingPermission")
    private ResolvedPosition getLastKnownLocation() {
        try {
            LocationManager lm = (LocationManager) context.getSystemService(Context.LOCATION_SERVICE);
            if (lm == null) return null;

            // Try all providers
            String[] providers = {
                    LocationManager.GPS_PROVIDER,
                    LocationManager.NETWORK_PROVIDER,
                    LocationManager.PASSIVE_PROVIDER
            };

            Location best = null;
            for (String provider : providers) {
                try {
                    Location loc = lm.getLastKnownLocation(provider);
                    if (loc != null && (best == null || loc.getTime() > best.getTime())) {
                        best = loc;
                    }
                } catch (Exception ignored) {}
            }

            if (best != null) {
                return new ResolvedPosition(
                        best.getLatitude(), best.getLongitude(),
                        best.getAccuracy(), "LAST_KNOWN", best.getTime());
            }
        } catch (Exception e) {
            Log.w(TAG, "Last known location error", e);
        }
        return null;
    }

    // ── Tower Database Management ────────────────────────────────────────────

    /**
     * Opens the regional cell tower SQLite database.
     * First looks for it in internal storage; if missing, copies from assets.
     */
    private SQLiteDatabase getOrOpenTowerDatabase() {
        if (towerDb != null && towerDb.isOpen()) return towerDb;

        File dbFile = new File(context.getFilesDir(), TOWER_DB_LOCAL_NAME);
        if (!dbFile.exists()) {
            if (!copyTowerDatabaseFromAssets(dbFile)) {
                Log.w(TAG, "No regional cell tower database available.");
                return null;
            }
        }

        try {
            towerDb = SQLiteDatabase.openDatabase(
                    dbFile.getAbsolutePath(), null, SQLiteDatabase.OPEN_READONLY);
            return towerDb;
        } catch (Exception e) {
            Log.e(TAG, "Failed to open tower database", e);
            return null;
        }
    }

    /**
     * Copies the pre-packaged regional tower database from APK assets to internal storage.
     */
    private boolean copyTowerDatabaseFromAssets(File destFile) {
        try (InputStream is = context.getAssets().open(TOWER_DB_ASSET_NAME);
             FileOutputStream os = new FileOutputStream(destFile)) {
            byte[] buffer = new byte[8192];
            int read;
            while ((read = is.read(buffer)) > 0) {
                os.write(buffer, 0, read);
            }
            os.flush();
            Log.i(TAG, "Regional tower database copied to " + destFile.getAbsolutePath());
            return true;
        } catch (IOException e) {
            Log.w(TAG, "No tower database in assets (asset: " + TOWER_DB_ASSET_NAME + ")", e);
            return false;
        }
    }

    /**
     * Closes the tower database when no longer needed.
     */
    public void close() {
        if (towerDb != null && towerDb.isOpen()) {
            towerDb.close();
            towerDb = null;
        }
    }

    // ── Internal data class ─────────────────────────────────────────────────

    private static class CellTowerReading {
        final int mcc, mnc, lac, cid;
        final int signalDbm;

        CellTowerReading(int mcc, int mnc, int lac, int cid, int signalDbm) {
            this.mcc = mcc;
            this.mnc = mnc;
            this.lac = lac;
            this.cid = cid;
            this.signalDbm = signalDbm;
        }
    }
}

