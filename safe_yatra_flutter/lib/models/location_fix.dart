class LocationFix {
  final double latitude;
  final double longitude;
  final double accuracy;
  final String source; // 'GPS', 'CELL_TOWER', or 'LAST_KNOWN'

  LocationFix({
    required this.latitude,
    required this.longitude,
    required this.accuracy,
    required this.source,
  });

  factory LocationFix.fromMap(Map<dynamic, dynamic> map) {
    return LocationFix(
      latitude: (map['latitude'] as num?)?.toDouble() ?? 0.0,
      longitude: (map['longitude'] as num?)?.toDouble() ?? 0.0,
      accuracy: (map['accuracy'] as num?)?.toDouble() ?? 0.0,
      source: map['source']?.toString() ?? 'UNKNOWN',
    );
  }

  bool get isGps => source == 'GPS';
  bool get isCellTower => source == 'CELL_TOWER';
}

