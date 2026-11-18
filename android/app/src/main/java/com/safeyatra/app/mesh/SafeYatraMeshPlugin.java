package com.safeyatra.app.mesh;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;

import androidx.core.app.ActivityCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONArray;

/**
 * Capacitor Native Plugin bridge for the Safe Yatra Offline Finding Network.
 *
 * Exposes the following methods to JavaScript:
 *   - startMesh({ masterSecret, isSos })       → Starts BLE advertising + relay scanning
 *   - stopMesh()                                → Stops the mesh service
 *   - triggerEmergencySos({ masterSecret })      → Switches to SOS high-frequency mode
 *   - cancelEmergencySos({ masterSecret })       → Reverts to normal tracking mode
 *   - getPendingSightings()                      → Returns queued relay reports
 *   - markSightingSynced({ localId })            → Marks a report as uploaded
 *   - markSightingsSyncedBatch({ localIds })     → Batch mark as uploaded
 *   - getOfflineLocation()                       → Returns best offline position fix
 *   - getMeshStatus()                            → Returns current mesh state info
 */
@CapacitorPlugin(
        name = "SafeYatraMesh",
        permissions = {
                @Permission(
                        alias = "bluetooth",
                        strings = {
                                Manifest.permission.BLUETOOTH_SCAN,
                                Manifest.permission.BLUETOOTH_ADVERTISE,
                                Manifest.permission.BLUETOOTH_CONNECT
                        }
                ),
                @Permission(
                        alias = "location",
                        strings = {
                                Manifest.permission.ACCESS_FINE_LOCATION,
                                Manifest.permission.ACCESS_COARSE_LOCATION
                        }
                ),
                @Permission(
                        alias = "phone",
                        strings = {
                                Manifest.permission.READ_PHONE_STATE
                        }
                )
        }
)
public class SafeYatraMeshPlugin extends Plugin {

    private static final String TAG = "SafeYatraMeshPlugin";

    // ── startMesh ───────────────────────────────────────────────────────────

    @PluginMethod
    public void startMesh(PluginCall call) {
        if (!hasRequiredPermissions()) {
            requestAllPermissions(call, "onPermissionsGrantedForStart");
            return;
        }

        String masterSecret = call.getString("masterSecret", "");
        boolean isSos = Boolean.TRUE.equals(call.getBoolean("isSos", false));

        SafeYatraMeshService.start(getContext(), masterSecret, isSos);

        JSObject ret = new JSObject();
        ret.put("status", "started");
        ret.put("isSos", isSos);
        call.resolve(ret);
    }

    @PermissionCallback
    private void onPermissionsGrantedForStart(PluginCall call) {
        if (hasRequiredPermissions()) {
            startMesh(call);
        } else {
            call.reject("Required permissions (Bluetooth + Location) were denied.");
        }
    }

    // ── stopMesh ────────────────────────────────────────────────────────────

    @PluginMethod
    public void stopMesh(PluginCall call) {
        SafeYatraMeshService.stop(getContext());

        JSObject ret = new JSObject();
        ret.put("status", "stopped");
        call.resolve(ret);
    }

    // ── triggerEmergencySos ──────────────────────────────────────────────────

    @PluginMethod
    public void triggerEmergencySos(PluginCall call) {
        String masterSecret = call.getString("masterSecret", "");
        SafeYatraMeshService.start(getContext(), masterSecret, true);

        JSObject ret = new JSObject();
        ret.put("status", "sos_activated");
        call.resolve(ret);
    }

    // ── cancelEmergencySos ──────────────────────────────────────────────────

    @PluginMethod
    public void cancelEmergencySos(PluginCall call) {
        String masterSecret = call.getString("masterSecret", "");
        SafeYatraMeshService.start(getContext(), masterSecret, false);

        JSObject ret = new JSObject();
        ret.put("status", "sos_cancelled");
        call.resolve(ret);
    }

    // ── getPendingSightings ─────────────────────────────────────────────────

    @PluginMethod
    public void getPendingSightings(PluginCall call) {
        RelayDatabaseHelper db = new RelayDatabaseHelper(getContext());
        int limit = call.getInt("limit", 50);
        JSONArray arr = db.getPendingSightings(limit);

        JSObject ret = new JSObject();
        ret.put("sightings", arr);
        ret.put("count", arr.length());
        call.resolve(ret);
    }

    // ── markSightingSynced ──────────────────────────────────────────────────

    @PluginMethod
    public void markSightingSynced(PluginCall call) {
        int localId = call.getInt("localId", -1);
        if (localId == -1) {
            call.reject("Missing required parameter: localId");
            return;
        }

        new RelayDatabaseHelper(getContext()).markSynced(localId);

        JSObject ret = new JSObject();
        ret.put("localId", localId);
        ret.put("synced", true);
        call.resolve(ret);
    }

    // ── markSightingsSyncedBatch ────────────────────────────────────────────

    @PluginMethod
    public void markSightingsSyncedBatch(PluginCall call) {
        org.json.JSONArray idsArr = call.getArray("localIds");
        if (idsArr == null || idsArr.length() == 0) {
            call.reject("Missing required parameter: localIds (array)");
            return;
        }

        int[] ids = new int[idsArr.length()];
        for (int i = 0; i < idsArr.length(); i++) {
            ids[i] = idsArr.optInt(i, -1);
        }

        new RelayDatabaseHelper(getContext()).markSyncedBatch(ids);

        JSObject ret = new JSObject();
        ret.put("syncedCount", ids.length);
        call.resolve(ret);
    }

    // ── getOfflineLocation ──────────────────────────────────────────────────

    @PluginMethod
    public void getOfflineLocation(PluginCall call) {
        OfflineLocationManager locMgr = new OfflineLocationManager(getContext());
        OfflineLocationManager.ResolvedPosition pos = locMgr.getBestAvailableLocation();

        if (pos != null) {
            JSObject ret = new JSObject();
            ret.put("latitude", pos.latitude);
            ret.put("longitude", pos.longitude);
            ret.put("accuracy", pos.accuracy);
            ret.put("source", pos.source);
            ret.put("timestamp", pos.timestamp);
            call.resolve(ret);
        } else {
            call.reject("Unable to resolve offline position from any source.");
        }
    }

    // ── getMeshStatus ───────────────────────────────────────────────────────

    @PluginMethod
    public void getMeshStatus(PluginCall call) {
        RelayDatabaseHelper db = new RelayDatabaseHelper(getContext());

        JSObject ret = new JSObject();
        ret.put("pendingSightings", db.getPendingCount());
        ret.put("pendingSosSightings", db.getPendingSosCount());
        ret.put("bleSupported", new BleAdvertiserManager().isSupported());
        call.resolve(ret);
    }

    // ── Permission helpers ──────────────────────────────────────────────────

    private boolean hasRequiredPermissions() {
        boolean location = ActivityCompat.checkSelfPermission(getContext(),
                Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            boolean bleScan = ActivityCompat.checkSelfPermission(getContext(),
                    Manifest.permission.BLUETOOTH_SCAN) == PackageManager.PERMISSION_GRANTED;
            boolean bleAdv = ActivityCompat.checkSelfPermission(getContext(),
                    Manifest.permission.BLUETOOTH_ADVERTISE) == PackageManager.PERMISSION_GRANTED;
            return location && bleScan && bleAdv;
        }
        return location;
    }
}

