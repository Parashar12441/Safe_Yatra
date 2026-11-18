import 'dart:async';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'mesh_service.dart';

class RelaySyncService {
  Timer? _timer;
  StreamSubscription<List<ConnectivityResult>>? _sub;
  bool _isSyncing = false;

  void start() {
    // 1. Periodic background sync every 60 seconds
    _timer = Timer.periodic(const Duration(seconds: 60), (_) => syncPendingSightings());

    // 2. Immediate flush when internet connection is restored
    _sub = Connectivity().onConnectivityChanged.listen((results) {
      if (!results.contains(ConnectivityResult.none)) {
        syncPendingSightings();
      }
    });
  }

  Future<int> syncPendingSightings() async {
    if (_isSyncing) return 0;
    _isSyncing = true;

    try {
      final sightings = await SafeYatraMeshService.getPendingSightings();
      if (sightings.isEmpty) return 0;

      final syncedIds = <int>[];
      final firestore = FirebaseFirestore.instance;

      for (final item in sightings) {
        try {
          await firestore.collection('mesh_sightings').add({
            'eid': item.eid,
            'witness_lat': item.witnessLat,
            'witness_lon': item.witnessLon,
            'accuracy': item.accuracy,
            'source': item.source,
            'rssi': item.rssi,
            'is_sos': item.isSos,
            'detected_at': item.timestamp,
            'uploaded_at': FieldValue.serverTimestamp(),
          });

          // If the sighted offline tourist is in SOS, immediately post to active alerts
          if (item.isSos) {
            final alertId = 'mesh_sos_${item.eid.substring(0, 8)}_${item.timestamp}';
            await firestore.collection('alerts').doc(alertId).set({
              'id': alertId,
              'type': 'SOS',
              'name': 'Offline Tourist (Relayed via Mesh)',
              'phone': 'BLE EID: ${item.eid.substring(0, 8)}…',
              'city': 'Offline Mesh Sighting (±${item.accuracy.round()}m via ${item.source})',
              'lat': item.witnessLat,
              'lng': item.witnessLon,
              'bat': 10,
              'time': DateTime.fromMillisecondsSinceEpoch(item.timestamp * 1000).toIso8601String(),
              'status': 'active',
              'isMeshRelay': true,
              'eid': item.eid,
              'accuracy': item.accuracy,
              'createdAt': FieldValue.serverTimestamp(),
            }, SetOptions(merge: true));
          }

          syncedIds.add(item.localId);
        } catch (_) {
          // If Firestore fails, keep in SQLite outbox for next cycle
        }
      }

      if (syncedIds.isNotEmpty) {
        await SafeYatraMeshService.markSynced(syncedIds);
      }

      return syncedIds.length;
    } finally {
      _isSyncing = false;
    }
  }

  void stop() {
    _timer?.cancel();
    _sub?.cancel();
  }
}

