import 'package:flutter/material.dart';
import '../../models/network_status.dart';
import '../theme/app_colors.dart';

class P2PStatusChip extends StatelessWidget {
  final P2PState state;

  const P2PStatusChip({super.key, required this.state});

  @override
  Widget build(BuildContext context) {
    Color color;
    String label;

    switch (state) {
      case P2PState.directP2P:
        color = AppColors.p2pConnected;
        label = 'P2P Direct';
        break;
      case P2PState.turnRelay:
        color = AppColors.p2pRelay;
        label = 'TURN Relay';
        break;
      case P2PState.signaling:
        color = AppColors.signalingActive;
        label = 'Signaling';
        break;
      case P2PState.disconnected:
        color = AppColors.p2pDisconnected;
        label = 'Offline';
        break;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withOpacity(0.15),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withOpacity(0.5)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 7,
            height: 7,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 5),
          Text(
            label,
            style: TextStyle(
              color: color,
              fontSize: 10,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }
}
