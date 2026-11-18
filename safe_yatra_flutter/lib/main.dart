import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'screens/tourist_dashboard.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const SafeYatraApp());
}

class SafeYatraApp extends StatelessWidget {
  const SafeYatraApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Safe Yatra',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF0F172A),
        textTheme: GoogleFonts.ibmPlexSansTextTheme(ThemeData.dark().textTheme),
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFF32E0C4), // Safe Yatra Mint
          secondary: Color(0xFF00E5CC),
          error: Color(0xFFFF1744),
          surface: Color(0xFF1E293B),
        ),
      ),
      home: const TouristDashboardScreen(
        userUid: 'tourist_demo_9921',
        userName: 'Aarav Sharma',
      ),
    );
  }
}

