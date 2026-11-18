import 'package:flutter/material.dart';

class SosHoldButton extends StatefulWidget {
  final bool isSosActive;
  final VoidCallback onTrigger;
  final VoidCallback onCancel;

  const SosHoldButton({
    super.key,
    required this.isSosActive,
    required this.onTrigger,
    required this.onCancel,
  });

  @override
  State<SosHoldButton> createState() => _SosHoldButtonState();
}

class _SosHoldButtonState extends State<SosHoldButton>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 3),
    )..addStatusListener((status) {
        if (status == AnimationStatus.completed) {
          widget.onTrigger();
        }
      });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: (_) {
        if (!widget.isSosActive) {
          _controller.forward();
        }
      },
      onTapUp: (_) {
        if (!widget.isSosActive) {
          _controller.reverse();
        }
      },
      onTapCancel: () {
        if (!widget.isSosActive) {
          _controller.reverse();
        }
      },
      child: AnimatedBuilder(
        animation: _controller,
        builder: (context, child) {
          return Stack(
            alignment: Alignment.center,
            children: [
              SizedBox(
                width: 90,
                height: 90,
                child: CircularProgressIndicator(
                  value: _controller.value,
                  strokeWidth: 6,
                  color: Colors.redAccent,
                  backgroundColor: Colors.red.withValues(alpha: 0.2),
                ),
              ),
              Container(
                width: 76,
                height: 76,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: LinearGradient(
                    colors: widget.isSosActive
                        ? [const Color(0xFF7F1D1D), const Color(0xFF991B1B)]
                        : [const Color(0xFFE11D48), const Color(0xFFBE123C)],
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: (widget.isSosActive
                              ? Colors.red
                              : const Color(0xFFE11D48))
                          .withValues(alpha: 0.4),
                      blurRadius: 16,
                      spreadRadius: 2,
                    ),
                  ],
                ),
                child: Material(
                  color: Colors.transparent,
                  child: InkWell(
                    customBorder: const CircleBorder(),
                    onTap: widget.isSosActive ? widget.onCancel : null,
                    child: Center(
                      child: Text(
                        widget.isSosActive ? 'CANCEL\nSOS' : 'HOLD\nSOS',
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                          fontSize: 12,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}
