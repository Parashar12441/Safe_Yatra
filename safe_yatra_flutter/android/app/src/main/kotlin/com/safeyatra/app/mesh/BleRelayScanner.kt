package com.safeyatra.app.mesh

import android.bluetooth.BluetoothAdapter
import android.bluetooth.le.*
import android.os.Handler
import android.os.Looper
import android.util.Log

class BleRelayScanner(private val onSighting: (eidHex: String, rssi: Int, isSos: Boolean) -> Unit) {
    private val scanner: BluetoothLeScanner? = BluetoothAdapter.getDefaultAdapter()?.bluetoothLeScanner
    private val handler = Handler(Looper.getMainLooper())
    var isRunning = false
        private set
    private var isSosMode = false
    private val seenThisCycle = mutableSetOf<String>()

    private val callback = object : ScanCallback() {
        override fun onScanResult(callbackType: Int, result: ScanResult?) {
            val data = result?.scanRecord?.getServiceData(BleAdvertiserManager.SERVICE_UUID) ?: return
            if (data.size >= 17) {
                val isSos = (data[0].toInt() and 0x01) == 0x01
                val eid = data.copyOfRange(1, 17)
                val eidHex = CryptoUtils.bytesToHex(eid)

                if (seenThisCycle.add(eidHex)) {
                    onSighting(eidHex, result.rssi, isSos)
                }
            }
        }
    }

    fun start() {
        if (isRunning || scanner == null) return
        isRunning = true
        cycle()
    }

    private fun cycle() {
        if (!isRunning) return
        seenThisCycle.clear()
        try {
            val filter = ScanFilter.Builder().setServiceUuid(BleAdvertiserManager.SERVICE_UUID).build()
            val settings = ScanSettings.Builder()
                .setScanMode(if (isSosMode) ScanSettings.SCAN_MODE_LOW_LATENCY else ScanSettings.SCAN_MODE_LOW_POWER)
                .build()
            scanner?.startScan(listOf(filter), settings, callback)
        } catch (e: SecurityException) {
            Log.e("SafeYatraScan", "Missing scan permission", e)
        }

        // Active scan for 12 seconds, then sleep
        handler.postDelayed({
            try { scanner?.stopScan(callback) } catch (ignored: Exception) {}
            if (isRunning) {
                val sleep = if (isSosMode) 48_000L else 168_000L
                handler.postDelayed({ cycle() }, sleep)
            }
        }, 12_000L)
    }

    fun setSosMode(sos: Boolean) {
        isSosMode = sos
    }

    fun stop() {
        isRunning = false
        handler.removeCallbacksAndMessages(null)
        try { scanner?.stopScan(callback) } catch (ignored: Exception) {}
        seenThisCycle.clear()
    }
}

