package com.safeyatra.app

import com.safeyatra.app.mesh.OfflineLocationManager
import com.safeyatra.app.mesh.RelayDbHelper
import com.safeyatra.app.mesh.SafeYatraMeshService
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    private val CHANNEL = "com.safeyatra.app/mesh"

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL).setMethodCallHandler { call, result ->
            when (call.method) {
                "startMesh" -> {
                    val secret = call.argument<String>("masterSecret") ?: "GUEST_KEY"
                    val isSos = call.argument<Boolean>("isSos") ?: false
                    SafeYatraMeshService.start(context, secret, isSos)
                    result.success(mapOf("status" to "started"))
                }
                "triggerSos" -> {
                    val secret = call.argument<String>("masterSecret") ?: "GUEST_KEY"
                    SafeYatraMeshService.start(context, secret, true)
                    result.success(mapOf("status" to "sos_active"))
                }
                "cancelSos" -> {
                    val secret = call.argument<String>("masterSecret") ?: "GUEST_KEY"
                    SafeYatraMeshService.start(context, secret, false)
                    result.success(mapOf("status" to "sos_cancelled"))
                }
                "getPendingSightings" -> {
                    val pending = RelayDbHelper(context).getPending()
                    result.success(pending)
                }
                "markSynced" -> {
                    val ids = call.argument<List<Int>>("ids") ?: emptyList()
                    RelayDbHelper(context).markSynced(ids)
                    result.success(true)
                }
                "getOfflineLocation" -> {
                    val loc = OfflineLocationManager(context).getBestLocation()
                    if (loc != null) {
                        result.success(mapOf(
                            "latitude" to loc.lat,
                            "longitude" to loc.lon,
                            "accuracy" to loc.accuracy,
                            "source" to loc.source
                        ))
                    } else {
                        result.error("UNAVAILABLE", "No offline fix available", null)
                    }
                }
                else -> result.notImplemented()
            }
        }
    }
}

