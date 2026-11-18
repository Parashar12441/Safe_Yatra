import 'package:flutter/services.dart';
import 'package:permission_handler/permission_handler.dart';
import '../models/sighting.dart';
import '../models/location_fix.dart';

class SafeYatraMeshService {
  static const _channel = MethodChannel('com.safeyatra.app/mesh');

  /// Request runtime permissions on Android 12-14+
  static Future<bool> requestPermissions() async {
    final statuses = await [
      Permission.location,
      Permission.locationAlways,
      Permission.bluetoothScan,
      Permission.bluetoothAdvertise,
      Permission.bluetoothConnect,
      Permission.phone,
      Permission.notification,
    ].request();

    return statuses[Permission.location]?.isGranted == true;
  }

  /// Start mesh service with rotating EID advertiser and duty-cycled scanner
  static Future<bool> startMesh({required String masterSecret, bool isSos = false}) async {
    try {
      final res = await _channel.invokeMapMethod<String, dynamic>('startMesh', {
        'masterSecret': masterSecret,
        'isSos': isSos,
      });
      return res?['status'] == 'started';
    } catch (e) {
      return false;
    }
  }

  /// Trigger emergency SOS high-frequency broadcast (~160ms interval)
  static Future<bool> triggerSos({required String masterSecret}) async {
    try {
      final res = await _channel.invokeMapMethod<String, dynamic>('triggerSos', {
        'masterSecret': masterSecret,
      });
      return res?['status'] == 'sos_active';
    } catch (e) {
      return false;
    }
  }

  /// Cancel emergency SOS and revert to standard low-power broadcast
  static Future<bool> cancelSos({required String masterSecret}) async {
    try {
      final res = await _channel.invokeMapMethod<String, dynamic>('cancelSos', {
        'masterSecret': masterSecret,
      });
      return res?['status'] == 'sos_cancelled';
    } catch (e) {
      return false;
    }
  }

  /// Query pending (unsynced) sightings stored in local SQLite outbox
  static Future<List<RelaySighting>> getPendingSightings() async {
    try {
      final list = await _channel.invokeListMethod<Map<dynamic, dynamic>>('getPendingSightings');
      if (list == null) return [];
      return list.map((item) => RelaySighting.fromMap(item)).toList();
    } catch (e) {
      return [];
    }
  }

  /// Mark relay sightings as successfully uploaded to cloud
  static Future<void> markSynced(List<int> ids) async {
    try {
      await _channel.invokeMethod('markSynced', {'ids': ids});
    } catch (_) {}
  }

  /// Get best available offline position fix (Hardware GPS -> Cell Tower SQLite Centroid -> Last Known)
  static Future<LocationFix?> getOfflineLocation() async {
    try {
      final res = await _channel.invokeMapMethod<String, dynamic>('getOfflineLocation');
      if (res != null) {
        return LocationFix.fromMap(res);
      }
      return null;
    } catch (_) {
      return null;
    }
  }
}

