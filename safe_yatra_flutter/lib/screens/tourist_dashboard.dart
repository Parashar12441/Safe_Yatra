import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import '../services/mesh_service.dart';
import '../services/relay_sync_service.dart';
import '../widgets/sos_hold_button.dart';
import '../widgets/mesh_status_badge.dart';
import 'mesh_status_screen.dart';

class TouristDashboardScreen extends StatefulWidget {
  final String userUid;
  final String userName;

  const TouristDashboardScreen({
    super.key,
    required this.userUid,
    required this.userName,
  });

  @override
  State<TouristDashboardScreen> createState() => _TouristDashboardScreenState();
}

class _TouristDashboardScreenState extends State<TouristDashboardScreen> {
  final MapController _mapController = MapController();
  final RelaySyncService _syncService = RelaySyncService();

  LatLng _currentLocation =
      const LatLng(30.7346, 79.0669); // Default Kedarnath Temple
  String _locationSource = 'SEARCHING';
  double _accuracy = 15.0;
  bool _isMeshActive = false;
  bool _isSosActive = false;
  int _pendingRelayCount = 0;
  Timer? _locationTimer;

  @override
  void initState() {
    super.initState();
    _initMeshNetwork();
    _syncService.start();

    // Poll offline location every 5 seconds
    _locationTimer = Timer.periodic(
        const Duration(seconds: 5), (_) => _pollOfflineLocation());
  }

  Future<void> _initMeshNetwork() async {
    final granted = await SafeYatraMeshService.requestPermissions();
    if (granted) {
      final started =
          await SafeYatraMeshService.startMesh(masterSecret: widget.userUid);
      if (mounted) {
        setState(() => _isMeshActive = started);
      }
      _pollOfflineLocation();
    }
  }

  Future<void> _pollOfflineLocation() async {
    final fix = await SafeYatraMeshService.getOfflineLocation();
    final pending = await SafeYatraMeshService.getPendingSightings();

    if (mounted) {
      setState(() {
        _pendingRelayCount = pending.length;
        if (fix != null) {
          _currentLocation = LatLng(fix.latitude, fix.longitude);
          _locationSource = fix.source;
          _accuracy = fix.accuracy;
        }
      });
    }
  }

  void _triggerSos() async {
    setState(() => _isSosActive = true);
    await SafeYatraMeshService.triggerSos(masterSecret: widget.userUid);
    if (!mounted) return;

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text(
            '🚨 EMERGENCY SOS ACTIVE! High-frequency BLE beacon broadcasted to nearby tourists.'),
        backgroundColor: Colors.redAccent,
        duration: Duration(seconds: 4),
      ),
    );
  }

  void _cancelSos() async {
    setState(() => _isSosActive = false);
    await SafeYatraMeshService.cancelSos(masterSecret: widget.userUid);
    if (!mounted) return;

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content:
            Text('SOS cancelled. Reverted to standard offline protection.'),
        backgroundColor: Colors.teal,
        duration: Duration(seconds: 2),
      ),
    );
  }

  @override
  void dispose() {
    _locationTimer?.cancel();
    _syncService.stop();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1E293B),
        elevation: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              widget.userName,
              style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: Colors.white),
            ),
            Text(
              '${_currentLocation.latitude.toStringAsFixed(4)}, ${_currentLocation.longitude.toStringAsFixed(4)} (±${_accuracy.round()}m)',
              style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
            ),
          ],
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            child: MeshStatusBadge(
              isSos: _isSosActive,
              isMeshActive: _isMeshActive,
              locationSource: _locationSource,
              pendingCount: _pendingRelayCount,
              onTap: () {
                Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => MeshStatusScreen(
                      masterSecret: widget.userUid,
                      isSos: _isSosActive,
                      locationSource: _locationSource,
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
      body: Stack(
        children: [
          // Tactical Map View
          FlutterMap(
            mapController: _mapController,
            options: MapOptions(
              initialCenter: _currentLocation,
              initialZoom: 14.5,
            ),
            children: [
              TileLayer(
                urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                userAgentPackageName: 'com.safeyatra.app',
              ),
              CircleLayer(
                circles: [
                  CircleMarker(
                    point: _currentLocation,
                    radius: _accuracy.clamp(15.0, 150.0),
                    useRadiusInMeter: false,
                    color: (_isSosActive ? Colors.red : const Color(0xFF32E0C4))
                        .withValues(alpha: 0.2),
                    borderColor:
                        _isSosActive ? Colors.red : const Color(0xFF32E0C4),
                    borderStrokeWidth: 2,
                  ),
                ],
              ),
              MarkerLayer(
                markers: [
                  Marker(
                    point: _currentLocation,
                    width: 50,
                    height: 50,
                    child: Icon(
                      _isSosActive ? Icons.warning : Icons.navigation,
                      color: _isSosActive
                          ? Colors.redAccent
                          : const Color(0xFF32E0C4),
                      size: 34,
                    ),
                  ),
                ],
              ),
            ],
          ),

          // Floating Center Location Button
          Positioned(
            right: 16,
            bottom: 120,
            child: FloatingActionButton.small(
              backgroundColor: const Color(0xFF1E293B),
              foregroundColor: Colors.white,
              onPressed: () {
                _mapController.move(_currentLocation, 15);
              },
              child: const Icon(Icons.my_location),
            ),
          ),

          // Bottom Bar with SOS Hold Button
          Positioned(
            bottom: 24,
            left: 0,
            right: 0,
            child: Center(
              child: SosHoldButton(
                isSosActive: _isSosActive,
                onTrigger: _triggerSos,
                onCancel: _cancelSos,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
