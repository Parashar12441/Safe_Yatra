class RelaySighting {
  final int localId;
  final String eid;
  final double witnessLat;
  final double witnessLon;
  final double accuracy;
  final String source;
  final int rssi;
  final bool isSos;
  final int timestamp;

  RelaySighting({
    required this.localId,
    required this.eid,
    required this.witnessLat,
    required this.witnessLon,
    required this.accuracy,
    required this.source,
    required this.rssi,
    required this.isSos,
    required this.timestamp,
  });

  factory RelaySighting.fromMap(Map<dynamic, dynamic> map) {
    return RelaySighting(
      localId: (map['local_id'] as num?)?.toInt() ?? 0,
      eid: map['eid']?.toString() ?? '',
      witnessLat: (map['witness_lat'] as num?)?.toDouble() ?? 0.0,
      witnessLon: (map['witness_lon'] as num?)?.toDouble() ?? 0.0,
      accuracy: (map['accuracy'] as num?)?.toDouble() ?? 0.0,
      source: map['source']?.toString() ?? 'GPS',
      rssi: (map['rssi'] as num?)?.toInt() ?? -100,
      isSos: map['is_sos'] == true || map['is_sos'] == 1,
      timestamp: (map['timestamp'] as num?)?.toInt() ?? 0,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'local_id': localId,
      'eid': eid,
      'witness_lat': witnessLat,
      'witness_lon': witnessLon,
      'accuracy': accuracy,
      'source': source,
      'rssi': rssi,
      'is_sos': isSos,
      'timestamp': timestamp,
    };
  }

  DateTime get observedAt => DateTime.fromMillisecondsSinceEpoch(timestamp * 1000);
}

