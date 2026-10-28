/// Model representing a saved peer contact in the local repository.
class ContactModel {
  final String peerId;
  final String name;
  final String fingerprint;
  final String avatarUrl;
  final bool isOnline;
  final String lastSeen;

  const ContactModel({
    required this.peerId,
    required this.name,
    required this.fingerprint,
    required this.avatarUrl,
    required this.isOnline,
    required this.lastSeen,
  });
}
