import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:p2p_messenger/ui/screens/splash_screen.dart';
import 'package:p2p_messenger/ui/theme/app_theme.dart';

void main() {
  testWidgets('P2P Messenger Phase 1 UI Navigation Flow Test', (WidgetTester tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.darkTheme,
        home: const SplashScreen(),
      ),
    );

    // Verify Splash Screen UI
    expect(find.text('P2P Messenger'), findsOneWidget);
    expect(find.text('Zero Server • Direct Peer-to-Peer'), findsOneWidget);

    // Advance timer to trigger Splash Screen transition to LoginScreen
    await tester.pumpAndSettle(const Duration(seconds: 3));

    // Verify Login Screen UI
    expect(find.text('Sign In'), findsOneWidget);
    expect(find.text('Create Cryptographic Identity'), findsOneWidget);

    // Tap Sign In to navigate to HomeScreen
    await tester.tap(find.text('Sign In'));
    await tester.pumpAndSettle();

    // Verify Home Screen with Tabs & Chat List (Rahul, Priya, Rohit, Kiran, etc.)
    expect(find.text('Rahul Sharma'), findsOneWidget);
    expect(find.text('Priya Patel'), findsOneWidget);
    expect(find.text('Rohit Verma'), findsOneWidget);
    expect(find.text('Kiran Rao'), findsOneWidget);

    // Tap on Rahul's chat to open ChatScreen
    await tester.tap(find.text('Rahul Sharma'));
    await tester.pumpAndSettle();
    expect(find.text('End-to-End Encrypted Payload • Zero Server Plaintext'), findsOneWidget);
    expect(find.text('Type E2EE message...'), findsOneWidget);

    // Pop back to HomeScreen
    await tester.tap(find.byIcon(Icons.arrow_back));
    await tester.pumpAndSettle();

    // Tap Contacts Tab
    await tester.tap(find.text('Contacts'));
    await tester.pumpAndSettle();
    expect(find.text('Scan QR Identity to Pair Peer'), findsOneWidget);

    // Tap Profile Tab
    await tester.tap(find.text('Profile'));
    await tester.pumpAndSettle();
    expect(find.text('PUBLIC KEY FINGERPRINT (SHA-256):'), findsOneWidget);

    // Tap Settings Tab
    await tester.tap(find.text('Settings'));
    await tester.pumpAndSettle();
    expect(find.text('P2P NETWORK PREFERENCES'), findsOneWidget);
  });
}
