import 'dart:async';
import 'package:flutter/material.dart';
import '../models/sighting.dart';
import '../services/mesh_service.dart';
import '../services/relay_sync_service.dart';

class MeshStatusScreen extends StatefulWidget {
  final String masterSecret;
  final bool isSos;
  final String locationSource;

  const MeshStatusScreen({
    super.key,
    required this.masterSecret,
    required this.isSos,
    required this.locationSource,
  });

  @override
  State<MeshStatusScreen> createState() => _MeshStatusScreenState();
}

class _MeshStatusScreenState extends State<MeshStatusScreen> {
  List<RelaySighting> _sightings = [];
  bool _isLoading = true;
  bool _isSyncing = false;
  Timer? _refreshTimer;

  @override
  void initState() {
    super.initState();
    _loadSightings();
    _refreshTimer =
        Timer.periodic(const Duration(seconds: 5), (_) => _loadSightings());
  }

  Future<void> _loadSightings() async {
    final list = await SafeYatraMeshService.getPendingSightings();
    if (mounted) {
      setState(() {
        _sightings = list;
        _isLoading = false;
      });
    }
  }

  Future<void> _manualSync() async {
    setState(() => _isSyncing = true);
    final count = await RelaySyncService().syncPendingSightings();
    await _loadSightings();
    if (mounted) {
      setState(() => _isSyncing = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(count > 0
              ? '✓ Synced $count relay sighting(s) to cloud'
              : 'No new sightings to sync'),
          backgroundColor: Colors.teal,
        ),
      );
    }
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final nowSeconds = DateTime.now().millisecondsSinceEpoch ~/ 1000;
    final secondsRemaining = 900 - (nowSeconds % 900);
    final minutesRemaining = secondsRemaining ~/ 60;
    final secs = secondsRemaining % 60;

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        title: const Text('Offline Finding Diagnostics'),
        backgroundColor: const Color(0xFF1E293B),
        actions: [
          IconButton(
            icon: _isSyncing
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Colors.teal))
                : const Icon(Icons.sync),
            tooltip: 'Sync Outbox Now',
            onPressed: _isSyncing ? null : _manualSync,
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // EID Card
          Card(
            color: const Color(0xFF1E293B),
            shape:
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.security, color: Color(0xFF32E0C4)),
                      const SizedBox(width: 10),
                      const Text('Rotating BLE Ephemeral ID',
                          style: TextStyle(
                              fontWeight: FontWeight.bold, color: Colors.white)),
                      const Spacer(),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: Colors.teal.withValues(alpha: 0.2),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Text(
                          'Rotates in ${minutesRemaining}m ${secs}s',
                          style: const TextStyle(
                              fontSize: 10,
                              color: Color(0xFF32E0C4),
                              fontWeight: FontWeight.bold),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'Your phone broadcasts an anonymous 16-byte rotating ID via Bluetooth Low Energy so nearby tourists can detect your presence without exposing your identity.',
                    style: TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                  ),
                  const Divider(color: Color(0xFF334155), height: 24),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      _diagItem('Broadcast Mode',
                          widget.isSos ? '🚨 SOS (~160ms)' : 'Normal (~1000ms)'),
                      _diagItem('Positioning', widget.locationSource),
                      _diagItem('Relay Scanner', 'Duty-cycled (12s/3m)'),
                    ],
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 20),

          // Outbox Header
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Store-and-Forward Outbox (${_sightings.length})',
                style: const TextStyle(
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                    fontSize: 16),
              ),
              TextButton.icon(
                onPressed: _isSyncing ? null : _manualSync,
                icon: const Icon(Icons.cloud_upload,
                    size: 16, color: Color(0xFF32E0C4)),
                label: const Text('Flush Outbox',
                    style: TextStyle(color: Color(0xFF32E0C4), fontSize: 12)),
              ),
            ],
          ),

          const SizedBox(height: 8),

          if (_isLoading)
            const Center(
                child: Padding(
                    padding: EdgeInsets.all(24),
                    child: CircularProgressIndicator(color: Colors.teal)))
          else if (_sightings.isEmpty)
            const Card(
              color: Color(0xFF1E293B),
              child: Padding(
                padding: EdgeInsets.all(24),
                child: Center(
                  child: Text(
                    'No pending sightings in local outbox.\nYour phone will automatically log nearby offline tourists when they pass within Bluetooth range.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Color(0xFF64748B), fontSize: 12),
                  ),
                ),
              ),
            )
          else
            ..._sightings.map(
              (s) => Card(
                color: const Color(0xFF1E293B),
                margin: const EdgeInsets.only(bottom: 8),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                  side: BorderSide(
                    color: s.isSos ? Colors.redAccent : Colors.transparent,
                    width: s.isSos ? 1.5 : 0,
                  ),
                ),
                child: ListTile(
                  leading: CircleAvatar(
                    backgroundColor: s.isSos
                        ? Colors.red.withValues(alpha: 0.2)
                        : Colors.teal.withValues(alpha: 0.2),
                    child: Icon(s.isSos ? Icons.warning : Icons.bluetooth,
                        color: s.isSos ? Colors.red : Colors.teal, size: 20),
                  ),
                  title: Text(
                    'EID: ${s.eid.substring(0, 8)}…',
                    style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 13,
                        color: Colors.white),
                  ),
                  subtitle: Text(
                    'Spotted at ${s.witnessLat.toStringAsFixed(4)}, ${s.witnessLon.toStringAsFixed(4)} (±${s.accuracy.round()}m via ${s.source})\nRSSI: ${s.rssi} dBm · ${s.observedAt.hour.toString().padLeft(2, '0')}:${s.observedAt.minute.toString().padLeft(2, '0')}',
                    style:
                        const TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
                  ),
                  trailing: s.isSos
                      ? const Chip(
                          label: Text('SOS',
                              style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.white)),
                          backgroundColor: Colors.red,
                        )
                      : const Chip(
                          label: Text('Queued',
                              style: TextStyle(
                                  fontSize: 10, color: Color(0xFF94A3B8))),
                          backgroundColor: Color(0xFF334155),
                        ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _diagItem(String title, String val) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title,
            style: const TextStyle(fontSize: 10, color: Color(0xFF64748B))),
        const SizedBox(height: 2),
        Text(val,
            style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.bold,
                color: Colors.white)),
      ],
    );
  }
}
