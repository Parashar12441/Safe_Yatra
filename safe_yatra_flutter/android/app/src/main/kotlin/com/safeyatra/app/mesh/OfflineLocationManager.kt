package com.safeyatra.app.mesh

import android.annotation.SuppressLint
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.location.LocationManager
import android.telephony.*
import java.io.File
import java.io.FileOutputStream

class OfflineLocationManager(private val context: Context) {
    data class Fix(val lat: Double, val lon: Double, val accuracy: Float, val source: String)

    @SuppressLint("MissingPermission")
    fun getBestLocation(): Fix? {
        // 1. Hardware Satellite GPS
        val lm = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager
        lm?.getLastKnownLocation(LocationManager.GPS_PROVIDER)?.let {
            if (System.currentTimeMillis() - it.time < 300_000) {
                return Fix(it.latitude, it.longitude, it.accuracy, "GPS")
            }
        }

        // 2. Cell Tower Local SQLite Database
        val tm = context.getSystemService(Context.TELEPHONY_SERVICE) as? TelephonyManager
        val db = openDatabase()
        if (tm != null && db != null) {
            val cellList = tm.allCellInfo ?: emptyList()
            for (info in cellList) {
                val (cid, lac, mcc, mnc) = when (info) {
                    is CellInfoLte -> listOf(info.cellIdentity.ci, info.cellIdentity.tac, info.cellIdentity.mcc, info.cellIdentity.mnc)
                    is CellInfoGsm -> listOf(info.cellIdentity.cid, info.cellIdentity.lac, info.cellIdentity.mcc, info.cellIdentity.mnc)
                    else -> listOf(-1, -1, -1, -1)
                }
                if (cid != -1 && cid != Int.MAX_VALUE) {
                    val cursor = db.rawQuery(
                        "SELECT lat, lon, range FROM cell_towers WHERE mcc=? AND mnc=? AND lac=? AND cid=? LIMIT 1",
                        arrayOf(mcc.toString(), mnc.toString(), lac.toString(), cid.toString())
                    )
                    if (cursor.moveToFirst()) {
                        val fix = Fix(cursor.getDouble(0), cursor.getDouble(1), cursor.getFloat(2), "CELL_TOWER")
                        cursor.close()
                        return fix
                    }
                    cursor.close()
                }
            }
        }
        return null
    }

    private fun openDatabase(): SQLiteDatabase? {
        val file = File(context.filesDir, "cell_towers_regional.db")
        if (!file.exists()) {
            try {
                context.assets.open("cell_towers_india.db").use { input ->
                    FileOutputStream(file).use { output -> input.copyTo(output) }
                }
            } catch (e: Exception) { return null }
        }
        return SQLiteDatabase.openDatabase(file.absolutePath, null, SQLiteDatabase.OPEN_READONLY)
    }
}

