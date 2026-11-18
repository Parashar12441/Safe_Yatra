import 'package:flutter/material.dart';

class MeshStatusBadge extends StatelessWidget {
  final bool isSos;
  final bool isMeshActive;
  final String locationSource;
  final int pendingCount;
  final VoidCallback? onTap;

  const MeshStatusBadge({
    super.key,
    required this.isSos,
    required this.isMeshActive,
    required this.locationSource,
    this.pendingCount = 0,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final Color primaryColor = isSos
        ? Colors.redAccent
        : isMeshActive
            ? const Color(0xFF32E0C4) // Safe Yatra Mint
            : Colors.grey;

    final String text = isSos
        ? '🚨 SOS MESH'
        : isMeshActive
            ? '📡 MESH ($locationSource)'
            : '⚠ MESH OFF';

    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: primaryColor.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(16),
          border:
              Border.all(color: primaryColor.withValues(alpha: 0.6), width: 1),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 8,
              height: 8,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: primaryColor,
              ),
            ),
            const SizedBox(width: 6),
            Text(
              text,
              style: TextStyle(
                color: primaryColor,
                fontSize: 11,
                fontWeight: FontWeight.bold,
                letterSpacing: 0.3,
              ),
            ),
            if (pendingCount > 0) ...[
              const SizedBox(width: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                decoration: BoxDecoration(
                  color: Colors.orange.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  '$pendingCount',
                  style: const TextStyle(
                    color: Colors.orange,
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
