package com.safeyatra.app.mesh;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import com.safeyatra.app.MainActivity;

/**
 * Persistent foreground service for the Safe Yatra Offline Finding Network.
 *
 * Orchestrates three subsystems:
 *   1. BLE Advertiser:   Broadcasts the tourist's rotating EID beacon.
 *   2. BLE Relay Scanner: Discovers nearby offline tourists' beacons.
 *   3. Offline Positioning: Resolves the witness's GPS/cell-tower location.
 *
 * The service runs with a low-priority persistent notification to survive
 * Android Doze mode and background execution limits.
 *
 * EID rotation is handled automatically: a periodic check runs every 60 seconds
 * and rotates the advertisement when the 15-minute window changes.
 */
public class SafeYatraMeshService extends Service {

    private static final String TAG = "SafeYatraMeshSvc";
    private static final String CHANNEL_ID = "safe_yatra_mesh_channel";
    private static final int NOTIFICATION_ID = 7001;
    private static final String PREFS_NAME = "safe_yatra_mesh_prefs";

    // Intent extras
    private static final String EXTRA_MASTER_SECRET = "masterSecret";
    private static final String EXTRA_IS_SOS = "isSos";

    // Subsystems
    private BleAdvertiserManager advertiser;
    private BleRelayScanner scanner;
    private RelayDatabaseHelper relayDb;
    private OfflineLocationManager locationManager;

    // State
    private String masterSecret = null;
    private boolean isSos = false;
    private long currentEidWindow = -1;
    private final Handler rotationHandler = new Handler(Looper.getMainLooper());

    // ── Static convenience methods ──────────────────────────────────────────

    /**
     * Starts or updates the mesh service.
     */
    public static void start(Context ctx, String masterSecret, boolean isSos) {
        Intent intent = new Intent(ctx, SafeYatraMeshService.class);
        intent.putExtra(EXTRA_MASTER_SECRET, masterSecret);
        intent.putExtra(EXTRA_IS_SOS, isSos);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            ctx.startForegroundService(intent);
        } else {
            ctx.startService(intent);
        }
    }

    /**
     * Stops the mesh service.
     */
    public static void stop(Context ctx) {
        ctx.stopService(new Intent(ctx, SafeYatraMeshService.class));
    }

    // ── Service lifecycle ───────────────────────────────────────────────────

    @Override
    public void onCreate() {
        super.onCreate();
        Log.i(TAG, "Safe Yatra Mesh Service creating...");

        createNotificationChannel();
        startForeground(NOTIFICATION_ID, buildNotification(
                "Safe Yatra Mesh Active",
                "Offline protection is running in the background"));

        // Initialize subsystems
        relayDb = new RelayDatabaseHelper(this);
        locationManager = new OfflineLocationManager(this);
        advertiser = new BleAdvertiserManager();

        // Initialize scanner with sighting handler
        scanner = new BleRelayScanner(this::onBeaconSighted);

        Log.i(TAG, "Safe Yatra Mesh Service created. BLE supported: " + advertiser.isSupported());
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            String newSecret = intent.getStringExtra(EXTRA_MASTER_SECRET);
            if (newSecret != null && !newSecret.isEmpty()) {
                this.masterSecret = newSecret;
                // Persist for service restart
                getSharedPreferences(PREFS_NAME, MODE_PRIVATE).edit()
                        .putString(EXTRA_MASTER_SECRET, masterSecret).apply();
            }
            this.isSos = intent.getBooleanExtra(EXTRA_IS_SOS, false);
        }

        // Recover persisted secret if not provided
        if (masterSecret == null || masterSecret.isEmpty()) {
            masterSecret = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
                    .getString(EXTRA_MASTER_SECRET, null);
        }

        if (masterSecret == null || masterSecret.isEmpty()) {
            Log.w(TAG, "No master secret available. Generating a local key.");
            masterSecret = CryptoUtils.generateMasterSecret();
            getSharedPreferences(PREFS_NAME, MODE_PRIVATE).edit()
                    .putString(EXTRA_MASTER_SECRET, masterSecret).apply();
        }

        // Start/restart BLE advertising with current EID
        startOrRotateAdvertisement();

        // Start/update scanner mode
        scanner.setEmergencyMode(isSos);
        if (!scanner.isRunning()) {
            scanner.startDutyCycledScanning();
        }

        // Schedule periodic EID rotation check (every 60 seconds)
        rotationHandler.removeCallbacksAndMessages(null);
        rotationHandler.postDelayed(this::checkEidRotation, 60_000);

        // Update notification
        updateNotification();

        Log.i(TAG, "Mesh service started [SOS=" + isSos + "]");

        return START_STICKY; // Restart if killed by the system
    }

    @Override
    public void onDestroy() {
        Log.i(TAG, "Safe Yatra Mesh Service stopping...");

        rotationHandler.removeCallbacksAndMessages(null);

        if (advertiser != null) advertiser.stopAdvertising();
        if (scanner != null) scanner.stopAll();
        if (locationManager != null) locationManager.close();

        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null; // Not a bound service
    }

    // ── BLE Advertising & EID Rotation ──────────────────────────────────────

    /**
     * Generates the current EID and starts/restarts the BLE advertisement.
     */
    private void startOrRotateAdvertisement() {
        long now = System.currentTimeMillis() / 1000;
        long newWindow = CryptoUtils.getTimeWindow(now);

        byte[] eid = CryptoUtils.generateRotatingEID(masterSecret, now);

        advertiser.stopAdvertising();
        advertiser.startAdvertising(eid, isSos);
        currentEidWindow = newWindow;

        Log.d(TAG, "EID rotated to window " + newWindow +
                " → " + CryptoUtils.bytesToHex(eid).substring(0, 8) + "…");
    }

    /**
     * Periodic check (every 60s): rotates the EID if the 15-minute window has changed.
     */
    private void checkEidRotation() {
        long now = System.currentTimeMillis() / 1000;
        if (CryptoUtils.hasWindowChanged(currentEidWindow, now)) {
            Log.i(TAG, "EID rotation window changed. Rotating advertisement...");
            startOrRotateAdvertisement();
        }

        // Periodically purge old synced records (keep 24h of history)
        relayDb.purgeSynced(86400);

        // Reschedule
        rotationHandler.postDelayed(this::checkEidRotation, 60_000);
    }

    // ── Sighting Handler ────────────────────────────────────────────────────

    /**
     * Called by the BLE scanner when a Safe Yatra beacon is discovered nearby.
     * Resolves the witness's (this device's) location and stores the sighting.
     */
    private void onBeaconSighted(String eidHex, int rssi, boolean beaconIsSos) {
        // Skip our own beacon (compare against current EID)
        byte[] ownEid = advertiser.getCurrentEid();
        if (ownEid != null && eidHex.equals(CryptoUtils.bytesToHex(ownEid))) {
            return; // Don't record self-sighting
        }

        // Resolve this device's (witness's) current location
        OfflineLocationManager.ResolvedPosition witnessPos =
                locationManager.getBestAvailableLocation();

        if (witnessPos != null) {
            relayDb.insertSighting(
                    eidHex,
                    witnessPos.latitude,
                    witnessPos.longitude,
                    witnessPos.accuracy,
                    witnessPos.source,
                    rssi,
                    beaconIsSos
            );

            // If the detected tourist is in SOS, update the notification urgently
            if (beaconIsSos) {
                NotificationManager nm = getSystemService(NotificationManager.class);
                if (nm != null) {
                    nm.notify(NOTIFICATION_ID, buildNotification(
                            "⚠ SOS Beacon Detected Nearby!",
                            "An offline tourist nearby needs help. Report will be relayed."));
                }
            }
        } else {
            Log.w(TAG, "Beacon sighted but could not resolve witness location. Skipping.");
        }
    }

    // ── Notification ────────────────────────────────────────────────────────

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Safe Yatra Offline Mesh",
                    NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("Background BLE beacon and relay network for tourist safety.");
            channel.setShowBadge(false);

            NotificationManager mgr = getSystemService(NotificationManager.class);
            if (mgr != null) mgr.createNotificationChannel(channel);
        }
    }

    private Notification buildNotification(String title, String text) {
        Intent openApp = new Intent(this, MainActivity.class);
        openApp.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(this, 0, openApp,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle(title)
                .setContentText(text)
                .setSmallIcon(android.R.drawable.ic_menu_compass)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setOngoing(true)
                .setContentIntent(pi)
                .build();
    }

    private void updateNotification() {
        int pending = relayDb.getPendingCount();
        String status = isSos ? "🚨 SOS Broadcast Active" : "✓ Mesh Protection Active";
        String detail = pending > 0
                ? pending + " sighting(s) queued for upload"
                : "Listening for nearby tourists";

        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm != null) {
            nm.notify(NOTIFICATION_ID, buildNotification(status, detail));
        }
    }
}

