import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter_webrtc/flutter_webrtc.dart';

import 'p2p_logger.dart';

/// Telemetry state snapshot for WebRTC DataChannel monitoring (Phase 5).
class WebRtcTelemetryState {
  final RTCPeerConnectionState connectionState;
  final RTCDataChannelState dataChannelState;
  final RTCSignalingState signalingState;
  final RTCIceConnectionState iceConnectionState;
  final int bytesSent;
  final int bytesReceived;
  final List<String> receivedMessages;

  const WebRtcTelemetryState({
    this.connectionState = RTCPeerConnectionState.RTCPeerConnectionStateNew,
    this.dataChannelState = RTCDataChannelState.RTCDataChannelConnecting,
    this.signalingState = RTCSignalingState.RTCSignalingStateStable,
    this.iceConnectionState = RTCIceConnectionState.RTCIceConnectionStateNew,
    this.bytesSent = 0,
    this.bytesReceived = 0,
    this.receivedMessages = const [],
  });

  WebRtcTelemetryState copyWith({
    RTCPeerConnectionState? connectionState,
    RTCDataChannelState? dataChannelState,
    RTCSignalingState? signalingState,
    RTCIceConnectionState? iceConnectionState,
    int? bytesSent,
    int? bytesReceived,
    List<String>? receivedMessages,
  }) {
    return WebRtcTelemetryState(
      connectionState: connectionState ?? this.connectionState,
      dataChannelState: dataChannelState ?? this.dataChannelState,
      signalingState: signalingState ?? this.signalingState,
      iceConnectionState: iceConnectionState ?? this.iceConnectionState,
      bytesSent: bytesSent ?? this.bytesSent,
      bytesReceived: bytesReceived ?? this.bytesReceived,
      receivedMessages: receivedMessages ?? this.receivedMessages,
    );
  }
}

/// Service managing WebRTC PeerConnection, SCTP DataChannel, ICE Candidate exchange,
/// SDP Negotiation, state transition logging (Rule 14), and data transceiving (Phase 5).
class WebRtcService {
  final P2PLogger _logger = P2PLogger('WebRTC-Core');

  RTCPeerConnection? _peerConnection;
  RTCDataChannel? _dataChannel;

  int _bytesSent = 0;
  int _bytesReceived = 0;

  RTCPeerConnectionState _connectionState = RTCPeerConnectionState.RTCPeerConnectionStateNew;
  RTCDataChannelState _dataChannelState = RTCDataChannelState.RTCDataChannelConnecting;
  RTCSignalingState _signalingState = RTCSignalingState.RTCSignalingStateStable;
  RTCIceConnectionState _iceConnectionState = RTCIceConnectionState.RTCIceConnectionStateNew;

  final List<String> _receivedMessages = [];
  final List<RTCIceCandidate> _localIceCandidates = [];

  final StreamController<RTCIceCandidate> _iceCandidateController =
      StreamController<RTCIceCandidate>.broadcast();
  final StreamController<String> _messageStreamController = StreamController<String>.broadcast();
  final StreamController<Uint8List> _binaryStreamController = StreamController<Uint8List>.broadcast();
  final StreamController<WebRtcTelemetryState> _telemetryController =
      StreamController<WebRtcTelemetryState>.broadcast();

  Stream<RTCIceCandidate> get iceCandidateStream => _iceCandidateController.stream;
  Stream<String> get messageStream => _messageStreamController.stream;
  Stream<Uint8List> get binaryStream => _binaryStreamController.stream;
  Stream<WebRtcTelemetryState> get telemetryStream => _telemetryController.stream;

  List<RTCIceCandidate> get localIceCandidates => List.unmodifiable(_localIceCandidates);
  List<String> get receivedMessages => List.unmodifiable(_receivedMessages);
  int get bytesSent => _bytesSent;
  int get bytesReceived => _bytesReceived;
  RTCPeerConnectionState get connectionState => _connectionState;
  RTCDataChannelState get dataChannelState => _dataChannelState;

  static const Map<String, dynamic> defaultConfiguration = {
    'iceServers': [
      {'urls': 'stun:stun.l.google.com:19302'},
      {'urls': 'stun:stun1.l.google.com:19302'},
    ],
    'sdpSemantics': 'unified-plan',
  };

  /// Initializes RTCPeerConnection and binds event listeners.
  Future<void> initializePeerConnection([Map<String, dynamic>? config]) async {
    await cleanup();

    final rtcConfig = config ?? defaultConfiguration;
    _logger.p2pNetwork('Creating RTCPeerConnection with STUN configuration: ${rtcConfig['iceServers']}');

    _peerConnection = await createPeerConnection(rtcConfig, {});

    // Connection State Listener (Rule 14 Logged)
    _peerConnection!.onConnectionState = (RTCPeerConnectionState state) {
      _logger.p2pNetwork('[WebRTC Transition] Peer Connection State: ${state.name}');
      _connectionState = state;
      _notifyTelemetry();
    };

    // Signaling State Listener
    _peerConnection!.onSignalingState = (RTCSignalingState state) {
      _logger.p2pNetwork('[WebRTC Transition] Signaling State: ${state.name}');
      _signalingState = state;
      _notifyTelemetry();
    };

    // ICE Connection State Listener
    _peerConnection!.onIceConnectionState = (RTCIceConnectionState state) {
      _logger.p2pNetwork('[WebRTC Transition] ICE Connection State: ${state.name}');
      _iceConnectionState = state;
      _notifyTelemetry();
    };

    // ICE Candidate Generation Listener
    _peerConnection!.onIceCandidate = (RTCIceCandidate candidate) {
      _logger.p2pNetwork('[WebRTC ICE Event] Generated Local ICE Candidate: ${candidate.candidate}');
      _localIceCandidates.add(candidate);
      _iceCandidateController.add(candidate);
    };

    // Remote DataChannel Listener (Receiver Side)
    _peerConnection!.onDataChannel = (RTCDataChannel channel) {
      _logger.p2pNetwork('[WebRTC Event] Received Remote DataChannel "${channel.label}" (id: ${channel.id})');
      _bindDataChannel(channel);
    };
  }

  /// Creates local SCTP DataChannel (Offerer Side).
  Future<RTCDataChannel> createDataChannel({String label = 'p2p_data_channel'}) async {
    if (_peerConnection == null) {
      await initializePeerConnection();
    }

    final init = RTCDataChannelInit()
      ..ordered = true
      ..maxRetransmits = 30;

    _logger.p2pNetwork('Creating local SCTP DataChannel "$label"');
    final channel = await _peerConnection!.createDataChannel(label, init);
    _bindDataChannel(channel);
    return channel;
  }

  /// Binds state & message listeners to an active RTCDataChannel.
  void _bindDataChannel(RTCDataChannel channel) {
    _dataChannel = channel;

    _dataChannel!.onDataChannelState = (RTCDataChannelState state) {
      _logger.p2pNetwork('[WebRTC Transition] DataChannel "${channel.label}" State: ${state.name}');
      _dataChannelState = state;
      _notifyTelemetry();
    };

    _dataChannel!.onMessage = (RTCDataChannelMessage message) {
      if (message.isBinary) {
        _bytesReceived += message.binary.length;
        _binaryStreamController.add(message.binary);
        _logger.p2pNetwork('Received WebRTC DataChannel binary frame (${message.binary.length} bytes)');
      } else {
        final text = message.text;
        _bytesReceived += utf8.encode(text).length;
        _receivedMessages.add(text);
        _messageStreamController.add(text);
        _logger.p2pNetwork('Received WebRTC DataChannel message: "$text"');
      }
      _notifyTelemetry();
    };
  }

  /// Creates SDP Offer description (Offerer Side).
  Future<RTCSessionDescription> createOffer() async {
    if (_peerConnection == null) {
      await initializePeerConnection();
    }
    if (_dataChannel == null) {
      await createDataChannel();
    }

    final offer = await _peerConnection!.createOffer({});
    await _peerConnection!.setLocalDescription(offer);

    _logger.p2pNetwork('[WebRTC SDP] Created & set Local Description (Offer)');
    _notifyTelemetry();
    return offer;
  }

  /// Sets Remote Offer description and creates SDP Answer description (Answerer Side).
  Future<RTCSessionDescription> handleRemoteOffer(RTCSessionDescription remoteOffer) async {
    if (_peerConnection == null) {
      await initializePeerConnection();
    }

    await _peerConnection!.setRemoteDescription(remoteOffer);
    _logger.p2pNetwork('[WebRTC SDP] Set Remote Description (Offer)');

    final answer = await _peerConnection!.createAnswer({});
    await _peerConnection!.setLocalDescription(answer);

    _logger.p2pNetwork('[WebRTC SDP] Created & set Local Description (Answer)');
    _notifyTelemetry();
    return answer;
  }

  /// Sets Remote Answer description (Offerer Side).
  Future<void> handleRemoteAnswer(RTCSessionDescription remoteAnswer) async {
    if (_peerConnection == null) return;
    await _peerConnection!.setRemoteDescription(remoteAnswer);
    _logger.p2pNetwork('[WebRTC SDP] Set Remote Description (Answer)');
    _notifyTelemetry();
  }

  /// Adds Remote ICE Candidate to peer connection.
  Future<void> addRemoteIceCandidate(RTCIceCandidate candidate) async {
    if (_peerConnection == null) return;
    await _peerConnection!.addCandidate(candidate);
    _logger.p2pNetwork('[WebRTC ICE] Added Remote ICE Candidate: ${candidate.candidate}');
  }

  /// Sends text message over active WebRTC SCTP DataChannel.
  Future<bool> sendData(String text) async {
    if (_dataChannel == null || _dataChannelState != RTCDataChannelState.RTCDataChannelOpen) {
      _logger.warn('Cannot send data: DataChannel is not OPEN (current state: ${_dataChannelState.name})');
      return false;
    }

    final bytes = utf8.encode(text);
    final msg = RTCDataChannelMessage(text);

    try {
      await _dataChannel!.send(msg);
      _bytesSent += bytes.length;
      _logger.p2pNetwork('Sent text message over WebRTC DataChannel: "$text" (${bytes.length} bytes)');
      _notifyTelemetry();
      return true;
    } catch (e, st) {
      _logger.error('Failed to send text over DataChannel', e, st);
      return false;
    }
  }

  /// Sends binary payload over active WebRTC SCTP DataChannel.
  Future<bool> sendBinaryData(Uint8List data) async {
    if (_dataChannel == null || _dataChannelState != RTCDataChannelState.RTCDataChannelOpen) {
      _logger.warn('Cannot send binary data: DataChannel is not OPEN');
      return false;
    }

    final msg = RTCDataChannelMessage.fromBinary(data);

    try {
      await _dataChannel!.send(msg);
      _bytesSent += data.length;
      _logger.p2pNetwork('Sent binary payload over WebRTC DataChannel (${data.length} bytes)');
      _notifyTelemetry();
      return true;
    } catch (e, st) {
      _logger.error('Failed to send binary payload over DataChannel', e, st);
      return false;
    }
  }

  void _notifyTelemetry() {
    _telemetryController.add(WebRtcTelemetryState(
      connectionState: _connectionState,
      dataChannelState: _dataChannelState,
      signalingState: _signalingState,
      iceConnectionState: _iceConnectionState,
      bytesSent: _bytesSent,
      bytesReceived: _bytesReceived,
      receivedMessages: List.unmodifiable(_receivedMessages),
    ));
  }

  /// Clean up and dispose WebRTC resources.
  Future<void> cleanup() async {
    try {
      await _dataChannel?.close();
      await _peerConnection?.close();
    } catch (_) {}
    _dataChannel = null;
    _peerConnection = null;
    _localIceCandidates.clear();
    _logger.info('Cleaned up WebRTC PeerConnection & DataChannel');
  }

  Future<void> dispose() async {
    await cleanup();
    await _iceCandidateController.close();
    await _messageStreamController.close();
    await _binaryStreamController.close();
    await _telemetryController.close();
  }
}
