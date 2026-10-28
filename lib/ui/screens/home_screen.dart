import 'package:flutter/material.dart';

import '../../models/network_status.dart';
import '../theme/app_colors.dart';
import '../widgets/p2p_status_chip.dart';
import 'chats_screen.dart';
import 'contacts_screen.dart';
import 'profile_screen.dart';
import 'settings_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _currentIndex = 0;
  P2PState _networkState = P2PState.directP2P;

  static const List<Widget> _screens = [
    ChatsScreen(),
    ContactsScreen(),
    ProfileScreen(),
    SettingsScreen(),
  ];

  static const List<String> _titles = [
    'P2P Messenger',
    'Peer Contacts',
    'My Identity',
    'Network Settings',
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            Text(_titles[_currentIndex]),
            const SizedBox(width: 10),
            P2PStatusChip(state: _networkState),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.search),
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Search triggered (Phase 1 Shell)')),
              );
            },
          ),
          PopupMenuButton<String>(
            icon: const Icon(Icons.more_vert),
            onSelected: (value) {
              if (value == 'toggle_p2p') {
                setState(() {
                  _networkState = _networkState == P2PState.directP2P
                      ? P2PState.disconnected
                      : P2PState.directP2P;
                });
              }
            },
            itemBuilder: (context) => [
              PopupMenuItem(
                value: 'toggle_p2p',
                child: Text(_networkState == P2PState.directP2P
                    ? 'Simulate P2P Disconnect'
                    : 'Simulate Direct P2P'),
              ),
            ],
          ),
        ],
      ),
      body: IndexedStack(
        index: _currentIndex,
        children: _screens,
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (index) {
          setState(() {
            _currentIndex = index;
          });
        },
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.chat_bubble_outline),
            activeIcon: Icon(Icons.chat_bubble),
            label: 'Chats',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.people_outline),
            activeIcon: Icon(Icons.people),
            label: 'Contacts',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.person_outline),
            activeIcon: Icon(Icons.person),
            label: 'Profile',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.settings_outlined),
            activeIcon: Icon(Icons.settings),
            label: 'Settings',
          ),
        ],
      ),
    );
  }
}
