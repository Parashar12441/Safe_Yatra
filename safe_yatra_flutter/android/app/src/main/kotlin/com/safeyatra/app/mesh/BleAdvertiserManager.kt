package com.safeyatra.app.mesh

import android.bluetooth.BluetoothAdapter
import android.bluetooth.le.*
import android.os.ParcelUuid
import android.util.Log

class BleAdvertiserManager {
    companion object {
        val SERVICE_UUID: ParcelUuid = ParcelUuid.fromString("0000FEAA-0000-1000-8000-00805F9B34FB")
    }

    private val advertiser: BluetoothLeAdvertiser? = BluetoothAdapter.getDefaultAdapter()?.bluetoothLeAdvertiser
    private var callback: AdvertiseCallback? = null
    var isAdvertising = false
        private set
    var currentEid: ByteArray? = null
        private set

    fun startAdvertising(eid: ByteArray, isSos: Boolean) {
        stopAdvertising()
        if (advertiser == null) return

        currentEid = eid

        val settings = AdvertiseSettings.Builder()
            .setAdvertiseMode(if (isSos) AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY else AdvertiseSettings.ADVERTISE_MODE_LOW_POWER)
            .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_HIGH)
            .setConnectable(false)
            .build()

        val serviceData = ByteArray(1 + CryptoUtils.EID_LENGTH).apply {
            this[0] = if (isSos) 0x01 else 0x00
            System.arraycopy(eid, 0, this, 1, CryptoUtils.EID_LENGTH)
        }

        val data = AdvertiseData.Builder()
            .setIncludeDeviceName(false)
            .setIncludeTxPowerLevel(false)
            .addServiceUuid(SERVICE_UUID)
            .addServiceData(SERVICE_UUID, serviceData)
            .build()

        callback = object : AdvertiseCallback() {
            override fun onStartSuccess(settingsInEffect: AdvertiseSettings?) {
                isAdvertising = true
                Log.i("SafeYatraBLE", "BLE Broadcast active. SOS: $isSos")
            }
            override fun onStartFailure(errorCode: Int) {
                isAdvertising = false
                Log.e("SafeYatraBLE", "BLE Broadcast failed: $errorCode")
            }
        }
        advertiser.startAdvertising(settings, data, callback)
    }

    fun stopAdvertising() {
        callback?.let { advertiser?.stopAdvertising(it) }
        isAdvertising = false
        callback = null
        currentEid = null
    }
}

