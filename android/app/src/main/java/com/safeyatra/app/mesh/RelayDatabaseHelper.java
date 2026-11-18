package com.safeyatra.app.mesh;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Store-and-forward relay database for the Safe Yatra Offline Finding Network.
 *
 * When Tourist B detects Tourist A's BLE beacon, the sighting is logged here
 * along with Tourist B's own GPS coordinates. Records are queued locally until
 * Tourist B regains internet connectivity, at which point the outbox is flushed
 * to the Safe Yatra backend.
 *
 * Schema:
 *   sightings(
 *     id          INTEGER PRIMARY KEY,
 *     eid         TEXT,       -- 32-char hex EID of the detected beacon
 *     lat         REAL,       -- Witness (Tourist B) latitude
 *     lon         REAL,       -- Witness (Tourist B) longitude
 *     accuracy    REAL,       -- Location accuracy in metres
 *     loc_source  TEXT,       -- "GPS", "CELL_TOWER", or "LAST_KNOWN"
 *     rssi        INTEGER,    -- BLE RSSI at detection (dBm)
 *     is_sos      INTEGER,    -- 1 if detected tourist has SOS active
 *     timestamp   INTEGER,    -- Unix epoch seconds of detection
 *     synced      INTEGER     -- 0 = pending, 1 = uploaded to backend
 *   )
 */
public class RelayDatabaseHelper extends SQLiteOpenHelper {

    private static final String TAG = "SafeYatraRelayDB";
    private static final String DB_NAME = "safeyatra_relay.db";
    private static final int DB_VERSION = 2;

    private static final String TABLE_SIGHTINGS = "sightings";

    public RelayDatabaseHelper(Context context) {
        super(context, DB_NAME, null, DB_VERSION);
    }

    @Override
    public void onCreate(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE " + TABLE_SIGHTINGS + " (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
                "eid TEXT NOT NULL, " +
                "lat REAL NOT NULL, " +
                "lon REAL NOT NULL, " +
                "accuracy REAL DEFAULT 0, " +
                "loc_source TEXT DEFAULT 'GPS', " +
                "rssi INTEGER DEFAULT -100, " +
                "is_sos INTEGER DEFAULT 0, " +
                "timestamp INTEGER NOT NULL, " +
                "synced INTEGER DEFAULT 0)");

        // Index for fast pending-sighting queries
        db.execSQL("CREATE INDEX idx_sightings_synced ON " + TABLE_SIGHTINGS + " (synced)");

        Log.i(TAG, "Relay database created.");
    }

    @Override
    public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
        if (oldVersion < 2) {
            // Migration: add loc_source column
            try {
                db.execSQL("ALTER TABLE " + TABLE_SIGHTINGS + " ADD COLUMN loc_source TEXT DEFAULT 'GPS'");
            } catch (Exception e) {
                // Column may already exist; recreate table
                db.execSQL("DROP TABLE IF EXISTS " + TABLE_SIGHTINGS);
                onCreate(db);
            }
        }
    }

    // ── Insert ──────────────────────────────────────────────────────────────

    /**
     * Records a new beacon sighting into the outbox.
     *
     * @param eid       32-char hex EID of the detected tourist.
     * @param lat       Witness latitude (Tourist B's GPS).
     * @param lon       Witness longitude (Tourist B's GPS).
     * @param accuracy  Location accuracy in metres.
     * @param locSource Source of the witness location ("GPS", "CELL_TOWER", "LAST_KNOWN").
     * @param rssi      Bluetooth RSSI at detection time.
     * @param isSos     true if the detected beacon has SOS flag set.
     * @return Row ID of the inserted record, or -1 on failure.
     */
    public long insertSighting(String eid, double lat, double lon,
                               float accuracy, String locSource,
                               int rssi, boolean isSos) {
        SQLiteDatabase db = getWritableDatabase();
        ContentValues cv = new ContentValues();
        cv.put("eid", eid);
        cv.put("lat", lat);
        cv.put("lon", lon);
        cv.put("accuracy", accuracy);
        cv.put("loc_source", locSource != null ? locSource : "GPS");
        cv.put("rssi", rssi);
        cv.put("is_sos", isSos ? 1 : 0);
        cv.put("timestamp", System.currentTimeMillis() / 1000);

        long rowId = db.insert(TABLE_SIGHTINGS, null, cv);
        if (rowId != -1) {
            Log.d(TAG, "Sighting stored: EID=" + eid.substring(0, 8) +
                    "… loc=" + String.format("%.4f,%.4f", lat, lon) +
                    " SOS=" + isSos);
        }
        return rowId;
    }

    // ── Query pending records ───────────────────────────────────────────────

    /**
     * Returns up to {@code limit} pending (unsynced) sightings as a JSON array.
     * Each object includes: local_id, eid, witness_lat, witness_lon, accuracy,
     * loc_source, rssi, is_sos, timestamp.
     */
    public JSONArray getPendingSightings(int limit) {
        JSONArray arr = new JSONArray();
        SQLiteDatabase db = getReadableDatabase();

        String sql = "SELECT id, eid, lat, lon, accuracy, loc_source, rssi, is_sos, timestamp " +
                "FROM " + TABLE_SIGHTINGS +
                " WHERE synced = 0 ORDER BY is_sos DESC, timestamp ASC LIMIT ?";

        try (Cursor c = db.rawQuery(sql, new String[]{String.valueOf(limit)})) {
            while (c.moveToNext()) {
                JSONObject obj = new JSONObject();
                obj.put("local_id", c.getInt(0));
                obj.put("eid", c.getString(1));
                obj.put("witness_lat", c.getDouble(2));
                obj.put("witness_lon", c.getDouble(3));
                obj.put("accuracy", c.getDouble(4));
                obj.put("loc_source", c.getString(5));
                obj.put("rssi", c.getInt(6));
                obj.put("is_sos", c.getInt(7) == 1);
                obj.put("timestamp", c.getLong(8));
                arr.put(obj);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error reading pending sightings", e);
        }
        return arr;
    }

    /**
     * Convenience overload: returns up to 50 pending sightings.
     */
    public JSONArray getPendingSightings() {
        return getPendingSightings(50);
    }

    // ── Mark synced ─────────────────────────────────────────────────────────

    /**
     * Marks a single sighting as uploaded to the backend.
     */
    public void markSynced(int localId) {
        SQLiteDatabase db = getWritableDatabase();
        ContentValues cv = new ContentValues();
        cv.put("synced", 1);
        db.update(TABLE_SIGHTINGS, cv, "id = ?", new String[]{String.valueOf(localId)});
    }

    /**
     * Marks multiple sightings as synced in a single transaction.
     */
    public void markSyncedBatch(int[] localIds) {
        SQLiteDatabase db = getWritableDatabase();
        db.beginTransaction();
        try {
            ContentValues cv = new ContentValues();
            cv.put("synced", 1);
            for (int id : localIds) {
                db.update(TABLE_SIGHTINGS, cv, "id = ?", new String[]{String.valueOf(id)});
            }
            db.setTransactionSuccessful();
        } finally {
            db.endTransaction();
        }
    }

    // ── Stats ───────────────────────────────────────────────────────────────

    /**
     * Returns the count of pending (unsynced) sightings.
     */
    public int getPendingCount() {
        SQLiteDatabase db = getReadableDatabase();
        try (Cursor c = db.rawQuery(
                "SELECT COUNT(*) FROM " + TABLE_SIGHTINGS + " WHERE synced = 0", null)) {
            if (c.moveToFirst()) return c.getInt(0);
        }
        return 0;
    }

    /**
     * Returns the count of SOS sightings still pending upload.
     */
    public int getPendingSosCount() {
        SQLiteDatabase db = getReadableDatabase();
        try (Cursor c = db.rawQuery(
                "SELECT COUNT(*) FROM " + TABLE_SIGHTINGS +
                        " WHERE synced = 0 AND is_sos = 1", null)) {
            if (c.moveToFirst()) return c.getInt(0);
        }
        return 0;
    }

    /**
     * Purges successfully synced records older than the given age.
     *
     * @param maxAgeSeconds Maximum age in seconds for synced records to keep.
     */
    public void purgeSynced(long maxAgeSeconds) {
        long cutoff = (System.currentTimeMillis() / 1000) - maxAgeSeconds;
        SQLiteDatabase db = getWritableDatabase();
        int deleted = db.delete(TABLE_SIGHTINGS,
                "synced = 1 AND timestamp < ?",
                new String[]{String.valueOf(cutoff)});
        if (deleted > 0) {
            Log.d(TAG, "Purged " + deleted + " synced sightings older than " + maxAgeSeconds + "s");
        }
    }
}

