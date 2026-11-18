package com.safeyatra.app.mesh

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper

class RelayDbHelper(context: Context) : SQLiteOpenHelper(context, "safeyatra_relay.db", null, 1) {
    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL("""
            CREATE TABLE sightings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                eid TEXT, lat REAL, lon REAL, accuracy REAL,
                source TEXT, rssi INTEGER, is_sos INTEGER,
                timestamp INTEGER, synced INTEGER DEFAULT 0
            )
        """)
        db.execSQL("CREATE INDEX idx_sightings_synced ON sightings (synced)")
    }

    override fun onUpgrade(db: SQLiteDatabase, old: Int, new: Int) {}

    fun insert(eid: String, lat: Double, lon: Double, acc: Float, src: String, rssi: Int, isSos: Boolean) {
        val cv = ContentValues().apply {
            put("eid", eid)
            put("lat", lat)
            put("lon", lon)
            put("accuracy", acc)
            put("source", src)
            put("rssi", rssi)
            put("is_sos", if (isSos) 1 else 0)
            put("timestamp", System.currentTimeMillis() / 1000)
        }
        writableDatabase.insert("sightings", null, cv)
    }

    fun getPending(): List<Map<String, Any>> {
        val list = mutableListOf<Map<String, Any>>()
        val c = readableDatabase.rawQuery(
            "SELECT id, eid, lat, lon, accuracy, source, rssi, is_sos, timestamp FROM sightings WHERE synced=0 ORDER BY is_sos DESC, timestamp ASC LIMIT 50",
            null
        )
        while (c.moveToNext()) {
            list.add(mapOf(
                "local_id" to c.getInt(0),
                "eid" to c.getString(1),
                "witness_lat" to c.getDouble(2),
                "witness_lon" to c.getDouble(3),
                "accuracy" to c.getDouble(4),
                "source" to c.getString(5),
                "rssi" to c.getInt(6),
                "is_sos" to (c.getInt(7) == 1),
                "timestamp" to c.getLong(8)
            ))
        }
        c.close()
        return list
    }

    fun markSynced(ids: List<Int>) {
        val db = writableDatabase
        db.beginTransaction()
        try {
            val cv = ContentValues().apply { put("synced", 1) }
            for (id in ids) {
                db.update("sightings", cv, "id=?", arrayOf(id.toString()))
            }
            db.setTransactionSuccessful()
        } finally {
            db.endTransaction()
        }
    }
}

