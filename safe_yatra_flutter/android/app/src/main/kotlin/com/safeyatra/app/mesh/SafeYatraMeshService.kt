package com.safeyatra.app.mesh

import android.app.*
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import com.safeyatra.app.MainActivity

class SafeYatraMeshService : Service() {
    companion object {
        const val CHANNEL_ID = "safe_yatra_mesh_channel"
        const val NOTIFICATION_ID = 7001

        fun start(ctx: Context, secret: String, isSos: Boolean) {
            val intent = Intent(ctx, SafeYatraMeshService::class.java).apply {
                putExtra("secret", secret)
                putExtra("isSos", isSos)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ctx.startForegroundService(intent)
            } else {
                ctx.startService(intent)
            }
        }

        fun stop(ctx: Context) {
            ctx.stopService(Intent(ctx, SafeYatraMeshService::class.java))
        }
    }

    private val advertiser = BleAdvertiserManager()
    private lateinit var scanner: BleRelayScanner
    private lateinit var locMgr: OfflineLocationManager
    private lateinit var dbHelper: RelayDbHelper
    private var masterSecret = "DEFAULT_KEY"
    private var isSos = false
    private val rotationHandler = Handler(Looper.getMainLooper())
    private var currentWindow: Long = -1

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, buildNotification("Safe Yatra Mesh Active", "Protecting your journey offline"))

        locMgr = OfflineLocationManager(this)
        dbHelper = RelayDbHelper(this)

        scanner = BleRelayScanner { eid, rssi, beaconIsSos ->
            // Prevent self-sighting
            val ownEid = advertiser.currentEid
            if (ownEid != null && eid == CryptoUtils.bytesToHex(ownEid)) return@BleRelayScanner

            locMgr.getBestLocation()?.let { pos ->
                dbHelper.insert(eid, pos.lat, pos.lon, pos.accuracy, pos.source, rssi, beaconIsSos)
            }
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        intent?.getStringExtra("secret")?.let { masterSecret = it }
        isSos = intent?.getBooleanExtra("isSos", false) ?: false

        rotateAdvertisement()
        scanner.setSosMode(isSos)
        if (!scanner.isRunning) scanner.start()

        rotationHandler.removeCallbacksAndMessages(null)
        scheduleRotationCheck()

        return START_STICKY
    }

    private fun rotateAdvertisement() {
        val now = System.currentTimeMillis() / 1000
        val window = now / CryptoUtils.EID_ROTATION_SECONDS
        val eid = CryptoUtils.generateRotatingEID(masterSecret, now)
        advertiser.startAdvertising(eid, isSos)
        currentWindow = window
    }

    private fun scheduleRotationCheck() {
        rotationHandler.postDelayed({
            val now = System.currentTimeMillis() / 1000
            val window = now / CryptoUtils.EID_ROTATION_SECONDS
            if (window != currentWindow) {
                rotateAdvertisement()
            }
            scheduleRotationCheck()
        }, 60_000L)
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(CHANNEL_ID, "Safe Yatra Mesh", NotificationManager.IMPORTANCE_LOW).apply {
                description = "Background BLE mesh and location relay service"
                setShowBadge(false)
            }
            getSystemService(NotificationManager::class.java)?.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(title: String, text: String): Notification {
        val intent = Intent(this, MainActivity::class.java)
        val pi = PendingIntent.getActivity(this, 0, intent, PendingIntent.FLAG_IMMUTABLE)

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_menu_compass)
            .setContentIntent(pi)
            .setOngoing(true)
            .build()
    }

    override fun onDestroy() {
        rotationHandler.removeCallbacksAndMessages(null)
        advertiser.stopAdvertising()
        scanner.stop()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}

