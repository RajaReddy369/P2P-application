import React, { useState, useEffect, useRef } from 'react';
import { ApiClient, ApiError } from './services/apiClient';
import { WebCryptoEngine } from './crypto/webCryptoEngine';
import { COUNTRY_CODES } from './data/countries';
import { QrGenerator } from './utils/qrGenerator';
import { PublicPages } from './components/PublicPages';
import { EmojiPicker } from './components/EmojiPicker';
import { ImagePreviewModal } from './components/ImagePreviewModal';
import { ContactAliasModal } from './components/ContactAliasModal';

interface User {
  id: string;
  username: string;
  display_name?: string;
  country_code?: string;
  phone_number: string;
  email?: string | null;
  avatar_url?: string | null;
  phone_verified?: boolean;
  email_verified?: boolean;
  two_factor_enabled?: boolean;
  created_at?: string;
}

interface Peer {
  id: string;
  username: string;
  display_name: string;
  avatar_url?: string | null;
  presence: 'ONLINE' | 'AWAY' | 'OFFLINE';
  last_seen_at?: string | null;
}

interface ConversationItem {
  id: string;
  type: string;
  created_at: string;
  updated_at: string;
  encrypted_conversation_key?: string;
  peer?: Peer | null;
  other_user_id?: string;
  other_username?: string;
  other_display_name?: string;
  other_presence_status?: 'online' | 'away' | 'offline';
  other_last_seen?: string;
}

interface RenderedMessage {
  id: string;
  sender_id: string;
  plaintext: string;
  isDecrypted: boolean;
  decryptionError?: string;
  created_at: string;
  message_type?: 'text' | 'image';
  imageDataUrl?: string;
  imageMeta?: { name?: string; size?: number; mimeType?: string };
}

interface DeviceItem {
  id: string;
  device_name: string;
  device_type: string;
  last_seen: string;
  created_at: string;
}

const PASTEL_ACCENTS = ['#F3C978', '#F3C7A8', '#D8CBE8', '#C98262', '#E9DED1', '#B5C99A'];

function getAvatarBg(name: string): string {
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % PASTEL_ACCENTS.length;
  return PASTEL_ACCENTS[index];
}

function getInitials(name: string): string {
  if (!name) return 'C';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.substring(0, Math.min(2, name.length)).toUpperCase();
}

function formatLastSeen(lastSeenIso?: string | null): string {
  if (!lastSeenIso) return 'Last seen recently';
  const diffMs = Date.now() - new Date(lastSeenIso).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Last seen just now';
  if (diffMins < 60) return `Last seen ${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `Last seen ${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
  return `Last seen ${new Date(lastSeenIso).toLocaleDateString()}`;
}

const ChartpieEmblem = ({ size = 38 }: { size?: number }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="32" cy="32" r="28" fill="#FFF9EF" stroke="#E7A23B" strokeWidth="4" />
      <path d="M32 10C44.1503 10 54 19.8497 54 32C54 44.1503 44.1503 54 32 54C22.5855 54 14.5936 48.0934 11.4552 39.8164L32 32V10Z" fill="#E7A23B" />
      <path d="M32 32L11.4552 39.8164C10.5186 37.3468 10 34.7303 10 32C10 19.8497 19.8497 10 32 10V32Z" fill="#F3C978" />
      <circle cx="32" cy="32" r="6" fill="#FFFDF8" />
    </svg>
    <div>
      <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800, letterSpacing: '1.2px', color: '#3B3530' }}>
        Chartpie
      </h1>
      <p style={{ margin: 0, fontSize: '10px', color: '#81766C', fontWeight: 600, letterSpacing: '0.6px' }}>
        Private. Direct. Connected.
      </p>
    </div>
  </div>
);

export const App: React.FC = () => {
  // Client-Side Route State
  const [currentPath, setCurrentPath] = useState<string>(() => window.location.pathname || '/');
  const [returnUrl, setReturnUrl] = useState<string | null>(null);

  // Authenticated User & Session State
  type AuthStatus = 'AUTH_INITIALIZING' | 'AUTHENTICATED' | 'AUTH_UNAUTHENTICATED' | 'AUTH_NETWORK_ERROR';
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>('AUTH_INITIALIZING');
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'otp_verify' | '2fa' | 'qr_login'>('login');
  const [networkBannerWarning, setNetworkBannerWarning] = useState<boolean>(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<'profile' | 'security' | 'devices' | null>(null);

  // Auth Inputs
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  // OTP State
  const [otpCode, setOtpCode] = useState('');
  const [otpTarget, setOtpTarget] = useState('');
  const [pending2FAChallenge, setPending2FAChallenge] = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState(45);
  const [resendActive, setResendActive] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [otpSuccessMessage, setOtpSuccessMessage] = useState<string | null>(null);

  // QR Login State
  const [qrPairingId, setQrPairingId] = useState<string | null>(null);
  const [qrStatus, setQrStatus] = useState<string>('pending');

  // Main App State
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeConv, setActiveConv] = useState<ConversationItem | null>(null);
  const [messages, setMessages] = useState<RenderedMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [messagesLoadError, setMessagesLoadError] = useState<string | null>(null);

  // New Conversation Modal State
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);

  // Profile & Settings Drawer State
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState<string | null>(null);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [profileSuccessMessage, setProfileSuccessMessage] = useState<string | null>(null);
  const [profileErrorMessage, setProfileErrorMessage] = useState<string | null>(null);
  const [devicesList, setDevicesList] = useState<DeviceItem[]>([]);
  const [scanQrInput, setScanQrInput] = useState('');

  useEffect(() => {
    if (activeSettingsTab === 'profile' && currentUser) {
      setEditDisplayName(currentUser.display_name || currentUser.username || '');
      setEditEmail(currentUser.email || '');
      setEditAvatarUrl(currentUser.avatar_url || null);
      setProfileSuccessMessage(null);
      setProfileErrorMessage(null);
    }
  }, [activeSettingsTab, currentUser]);

  // 2FA Setup State
  const [totpSetupData, setTotpSetupData] = useState<{ secret: string; otpauth_url: string; recovery_codes: string[] } | null>(null);
  const [totpVerificationCode, setTotpVerificationCode] = useState('');
  const [isSettingUp2FA, setIsSettingUp2FA] = useState(false);
  const [totpErrorMessage, setTotpErrorMessage] = useState<string | null>(null);

  // Contact Aliases State (local mapping peerUserId -> alias)
  const [contactAliases, setContactAliases] = useState<Record<string, string>>({});
  const [aliasEditingPeer, setAliasEditingPeer] = useState<{ peerId: string; username: string; displayName: string } | null>(null);

  // Emoji & Image Attachments State
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [pendingImageDataUrl, setPendingImageDataUrl] = useState<string | null>(null);
  const [isSendingImage, setIsSendingImage] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [previewEnlargedImage, setPreviewEnlargedImage] = useState<string | null>(null);

  // PWA Prompt Event
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // Responsive UI Navigation
  const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState(false);
  const [countrySearchTerm, setCountrySearchTerm] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // --- Router Helper ---
  const navigate = (path: string) => {
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }
    setCurrentPath(path);
    if (path === '/login') {
      setAuthMode('login');
    } else if (path === '/register') {
      setAuthMode('register');
    }
  };

  // Sync History Navigation (Browser Back / Forward / Refresh)
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname || '/');
    };
    window.addEventListener('popstate', handlePopState);

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  // Sync Settings Tab with Route
  useEffect(() => {
    if (currentPath === '/app/profile') {
      setActiveSettingsTab('profile');
    } else if (currentPath === '/app/security') {
      setActiveSettingsTab('security');
    } else if (currentPath === '/app/devices') {
      setActiveSettingsTab('devices');
      loadUserDevices();
    }
  }, [currentPath]);

  // Load Contact Aliases for Logged-In Account
  useEffect(() => {
    if (currentUser?.id) {
      try {
        const stored = localStorage.getItem(`chartpie_contact_aliases_${currentUser.id}`);
        if (stored) {
          setContactAliases(JSON.parse(stored));
        } else {
          setContactAliases({});
        }
      } catch (_) {
        setContactAliases({});
      }
    }
  }, [currentUser?.id]);

  // Clear Login & Register Input Fields On Refreshing / Navigation
  useEffect(() => {
    if (currentPath === '/login') {
      setUsername('');
      setPassword('');
      setAuthError(null);
    } else if (currentPath === '/register' && authMode !== 'otp_verify') {
      setUsername('');
      setDisplayName('');
      setPhoneNumber('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setAuthError(null);
    }
  }, [currentPath]);

  // Resend Countdown Timer
  useEffect(() => {
    let timer: any;
    if (resendTimer > 0 && !resendActive) {
      timer = setTimeout(() => setResendTimer((prev) => prev - 1), 1000);
    } else if (resendTimer === 0) {
      setResendActive(true);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [resendTimer, resendActive]);

  // Auto-Start QR Code Generation & Polling on Login Page
  useEffect(() => {
    let interval: any = null;
    if (currentPath === '/login' && authStatus !== 'AUTHENTICATED' && !currentUser) {
      if (!qrPairingId) {
        handleStartQrLogin();
      }

      interval = setInterval(async () => {
        if (!qrPairingId) return;
        try {
          const res = await ApiClient.getQrPairingStatus(qrPairingId);
          setQrStatus(res.status || 'pending');
          if (res.status === 'approved' && res.token) {
            clearInterval(interval);
            const user = await ApiClient.getCurrentUser();
            setCurrentUser(user);
            setAuthStatus('AUTHENTICATED');
            await WebCryptoEngine.initializeIdentityKeyPair(user.id);
            await loadConversations();
            navigate(returnUrl || '/app/chats');
            setReturnUrl(null);
          }
        } catch (_) {}
      }, 2000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [currentPath, qrPairingId, authStatus, currentUser]);

  // Session Restoration Logic
  const restoreSession = async (retryCount = 0) => {
    const token = ApiClient.getToken();
    if (!token) {
      setAuthStatus('AUTH_UNAUTHENTICATED');
      if (window.location.pathname.startsWith('/app')) {
        setReturnUrl(window.location.pathname);
        navigate('/login');
      }
      return;
    }

    setAuthStatus('AUTH_INITIALIZING');
    setNetworkBannerWarning(false);

    try {
      const user = await ApiClient.getCurrentUser();
      setCurrentUser(user);
      await WebCryptoEngine.initializeIdentityKeyPair(user.id);
      setAuthStatus('AUTHENTICATED');

      const path = window.location.pathname || '/';

      let targetConvId: string | null = null;
      if (path.startsWith('/app/chats/')) {
        targetConvId = path.replace('/app/chats/', '').trim();
      }

      if (path === '/app/profile') {
        setActiveSettingsTab('profile');
      } else if (path === '/app/security') {
        setActiveSettingsTab('security');
      } else if (path === '/app/devices') {
        setActiveSettingsTab('devices');
        loadUserDevices();
      }

      const convs = await ApiClient.getConversations().catch(() => []);
      setConversations(convs);

      if (targetConvId) {
        const targetConv = convs.find((c: ConversationItem) => c.id === targetConvId);
        if (targetConv) {
          await selectConversation(targetConv);
        } else if (convs.length > 0) {
          await selectConversation(convs[0]);
        }
      } else if (path === '/app/chats' || path === '/app') {
        if (convs.length > 0 && !activeConv) {
          await selectConversation(convs[0]);
        }
      }

      if (path === '/login' || path === '/register' || path === '/') {
        if (returnUrl) {
          navigate(returnUrl);
          setReturnUrl(null);
        } else {
          navigate('/app/chats');
        }
      }
    } catch (err: any) {
      if (err && (err.status === 401 || (err instanceof ApiError && err.status === 401))) {
        ApiClient.setToken(null);
        setCurrentUser(null);
        setAuthStatus('AUTH_UNAUTHENTICATED');
        if (window.location.pathname.startsWith('/app')) {
          setReturnUrl(window.location.pathname);
        }
        navigate('/login');
      } else {
        if (retryCount < 2) {
          setTimeout(() => restoreSession(retryCount + 1), 800);
        } else {
          setAuthStatus('AUTHENTICATED');
          setNetworkBannerWarning(true);
        }
      }
    }
  };

  useEffect(() => {
    restoreSession(0);
  }, []);

  // Presence Telemetry Heartbeat
  useEffect(() => {
    let interval: any;
    if (authStatus === 'AUTHENTICATED' && currentUser) {
      ApiClient.sendPresenceHeartbeat('online').catch(() => {});
      interval = setInterval(() => {
        ApiClient.sendPresenceHeartbeat('online').catch(() => {});
      }, 30000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [authStatus, currentUser]);

  // Scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadConversationsSilent = async () => {
    try {
      const convs = await ApiClient.getConversations();
      setConversations(convs);
    } catch (_) {}
  };

  const loadConversations = async () => {
    setLoadError(null);
    try {
      const convs = await ApiClient.getConversations();
      setConversations(convs);
      if (convs.length > 0 && !activeConv) {
        selectConversation(convs[0]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to load conversations.';
      setLoadError(msg);
      setConversations([]);
    }
  };

  const loadUserDevices = async () => {
    try {
      const devs = await ApiClient.getDevices();
      setDevicesList(devs);
    } catch (_) {}
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setOtpSuccessMessage(null);

    const isRegister = currentPath === '/register' || authMode === 'register';

    if (isRegister && password !== confirmPassword) {
      setAuthError('Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      if (isRegister) {
        const { publicKeyBase64 } = await WebCryptoEngine.initializeIdentityKeyPair(username.trim());
        const res = await ApiClient.register(
          username.trim(),
          displayName.trim() || username.trim(),
          countryCode,
          phoneNumber.trim(),
          email.trim(),
          password,
          publicKeyBase64
        );

        if (res.user) {
          setCurrentUser(res.user);
          await ApiClient.registerDevice('Authorized Chartpie Client', 'web', publicKeyBase64);
        }

        const formattedTarget = res.target_masked || `${countryCode} ${phoneNumber.trim()}`;
        setOtpTarget(formattedTarget);
        setOtpCode('');
        setResendTimer(res.resend_cooldown_seconds || 45);
        setResendActive(false);
        setAuthMode('otp_verify');
      } else {
        const res = await ApiClient.login(username.trim(), password);

        if (res.two_factor_required) {
          setPending2FAChallenge(res.challenge_token);
          setOtpTarget(res.target_masked || username);
          setAuthMode('2fa');
        } else if (res.user) {
          setCurrentUser(res.user);
          setAuthStatus('AUTHENTICATED');
          await WebCryptoEngine.initializeIdentityKeyPair(res.user.id);
          await loadConversations();
          navigate(returnUrl || '/app/chats');
          setReturnUrl(null);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed';
      setAuthError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode.trim()) return;

    setIsLoading(true);
    setAuthError(null);
    setOtpSuccessMessage(null);

    try {
      if (authMode === '2fa' && pending2FAChallenge) {
        const res = await ApiClient.login2FA(pending2FAChallenge, otpCode.trim());
        setCurrentUser(res.user);
        setAuthStatus('AUTHENTICATED');
        await WebCryptoEngine.initializeIdentityKeyPair(res.user.id);
        await loadConversations();
        navigate(returnUrl || '/app/chats');
        setReturnUrl(null);
      } else {
        await ApiClient.verifyPhoneOtp(countryCode, phoneNumber.trim(), otpCode.trim(), 'registration');
        ApiClient.setToken(null);
        setCurrentUser(null);
        setAuthStatus('AUTH_UNAUTHENTICATED');
        setOtpSuccessMessage('Registration completed successfully! Please sign in with your credentials.');
        setAuthMode('login');
        navigate('/login');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Incorrect verification code. Please try again.';
      setAuthError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!resendActive || resendLoading) return;
    setResendLoading(true);
    setAuthError(null);
    setOtpSuccessMessage(null);

    try {
      const res = await ApiClient.resendPhoneOtp(countryCode, phoneNumber.trim(), 'registration');
      setResendTimer(res.resend_cooldown_seconds || 45);
      setResendActive(false);
      setOtpSuccessMessage('A new verification code has been sent to your phone.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to resend verification code';
      setAuthError(msg);
    } finally {
      setIsLoading(false);
      setResendLoading(false);
    }
  };

  const handleStartQrLogin = async () => {
    try {
      const pairing = await ApiClient.createQrPairing();
      setQrPairingId(pairing.pairing_id);
      setQrStatus('pending');
    } catch (err) {
      // Fail silently for auto QR generate
    }
  };

  const handleApproveQrCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanQrInput.trim()) return;

    try {
      await ApiClient.approveQrPairing(scanQrInput.trim(), 'Web Browser');
      setQrStatus('approved');
      setScanQrInput('');
      loadUserDevices();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to approve QR code';
      setQrStatus(`Error: ${msg}`);
    }
  };

  const handleLogout = async () => {
    if (currentUser) {
      try {
        await ApiClient.sendPresenceHeartbeat('offline');
      } catch (_) {}
    }
    ApiClient.setToken(null);
    setCurrentUser(null);
    setConversations([]);
    setActiveConv(null);
    setMessages([]);
    setLoadError(null);
    setAuthStatus('AUTH_UNAUTHENTICATED');
    navigate('/login');
  };

  const handleSearchUsers = async () => {
    if (!userSearchTerm.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearchingUsers(true);
    try {
      const users = await ApiClient.searchUsers(userSearchTerm.trim());
      setSearchResults(users);
    } catch (_) {
      setSearchResults([]);
    } finally {
      setIsSearchingUsers(false);
    }
  };

  const startConversationWithUser = async (targetUser: User) => {
    try {
      if (!targetUser.id) return;
      const targetUserDetail = await ApiClient.getUserByUsername(targetUser.username);
      if (!targetUserDetail || !targetUserDetail.public_identity_key) {
        console.error('Selected user is missing a public identity key.');
        return;
      }

      const { publicKeyBase64: myPubKeyBase64 } = await WebCryptoEngine.initializeIdentityKeyPair(currentUser?.id);
      const convKey = await WebCryptoEngine.generateConversationKey();

      const envelopeCreator = await WebCryptoEngine.createEncryptedKeyEnvelope(convKey, myPubKeyBase64);
      const envelopeRecipient = await WebCryptoEngine.createEncryptedKeyEnvelope(convKey, targetUserDetail.public_identity_key);

      const newConv = await ApiClient.createConversation(targetUserDetail.id, envelopeCreator, envelopeRecipient);

      // Account-scoped Key Vault
      await WebCryptoEngine.storeKeyInVault(`user_${currentUser?.id}_conv_${newConv.id}`, convKey);

      const peerInfo: Peer = {
        id: targetUserDetail.id,
        username: targetUserDetail.username,
        display_name: targetUserDetail.display_name || targetUserDetail.username,
        avatar_url: targetUserDetail.avatar_url || null,
        presence: 'ONLINE',
      };

      const formattedConv: ConversationItem = {
        ...newConv,
        peer: peerInfo,
        other_user_id: targetUserDetail.id,
        other_username: targetUserDetail.username,
        other_display_name: targetUserDetail.display_name || targetUserDetail.username,
        other_presence_status: 'online',
      };

      setConversations((prev) => [formattedConv, ...prev.filter((c) => c.id !== formattedConv.id)]);
      setShowNewChatModal(false);
      selectConversation(formattedConv);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create conversation';
      console.error('Failed to create conversation:', msg);
    }
  };

  const selectConversation = async (conv: ConversationItem) => {
    setActiveConv(conv);
    if (window.location.pathname !== `/app/chats/${conv.id}`) {
      navigate(`/app/chats/${conv.id}`);
    }
    await fetchMessagesForConv(conv, true);
  };

  const fetchMessagesForConv = async (conv: ConversationItem, showLoadingSpinner = false) => {
    setMessagesLoadError(null);
    if (showLoadingSpinner) setIsLoading(true);

    try {
      const convKey = await WebCryptoEngine.getConversationKey(
        conv.id,
        () => ApiClient.getKeyEnvelope(conv.id),
        currentUser?.id
      );

      const rawMsgs = await ApiClient.getEncryptedMessages(conv.id, 50);

      const decryptedList: RenderedMessage[] = await Promise.all(
        rawMsgs.map(async (m: any) => {
          try {
            const plaintext = await WebCryptoEngine.decryptMessage(convKey, m.encrypted_payload, m.iv);

            let isImage = false;
            let imageDataUrl: string | undefined = undefined;
            let imageMeta: any = undefined;

            if (plaintext.startsWith('{"type":"image"')) {
              try {
                const parsed = JSON.parse(plaintext);
                if (parsed && parsed.type === 'image' && parsed.dataUrl) {
                  isImage = true;
                  imageDataUrl = parsed.dataUrl;
                  imageMeta = { name: parsed.name, size: parsed.size, mimeType: parsed.mimeType };
                }
              } catch (_) {}
            }

            return {
              id: m.id,
              sender_id: m.sender_id,
              plaintext: isImage ? '[Encrypted Image Payload]' : plaintext,
              isDecrypted: true,
              created_at: m.created_at,
              message_type: isImage ? 'image' : 'text',
              imageDataUrl,
              imageMeta,
            };
          } catch (decErr: unknown) {
            return {
              id: m.id,
              sender_id: m.sender_id,
              plaintext: '[Unable to decrypt ciphertext payload]',
              isDecrypted: false,
              decryptionError: decErr instanceof Error ? decErr.message : 'Decryption error',
              created_at: m.created_at,
            };
          }
        })
      );

      setMessages(decryptedList);
    } catch (err: unknown) {
      setMessagesLoadError('Unable to load messages.');
      setMessages([]);
    } finally {
      if (showLoadingSpinner) setIsLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !activeConv) return;

    const textToSend = inputMessage.trim();
    setInputMessage('');
    setShowEmojiPicker(false);

    try {
      const convKey = await WebCryptoEngine.getConversationKey(
        activeConv.id,
        () => ApiClient.getKeyEnvelope(activeConv.id),
        currentUser?.id
      );

      const { ciphertext, iv } = await WebCryptoEngine.encryptMessage(convKey, textToSend);
      const record = await ApiClient.syncEncryptedMessage(activeConv.id, ciphertext, iv);

      const newMsg: RenderedMessage = {
        id: record.id || Date.now().toString(),
        sender_id: currentUser?.id || 'me',
        plaintext: textToSend,
        isDecrypted: true,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, newMsg]);
      await loadConversationsSilent();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Encryption / Sync error';
      console.error('Error sending encrypted message:', msg);
    }
  };

  // Handler for sending encrypted image payloads
  const handleSendEncryptedImage = async () => {
    if (!activeConv || !pendingImageDataUrl || !pendingImageFile) return;
    setIsSendingImage(true);

    try {
      const convKey = await WebCryptoEngine.getConversationKey(
        activeConv.id,
        () => ApiClient.getKeyEnvelope(activeConv.id),
        currentUser?.id
      );

      const jsonPayload = JSON.stringify({
        type: 'image',
        dataUrl: pendingImageDataUrl,
        name: pendingImageFile.name,
        size: pendingImageFile.size,
        mimeType: pendingImageFile.type,
      });

      const { ciphertext, iv } = await WebCryptoEngine.encryptMessage(convKey, jsonPayload);
      const record = await ApiClient.syncEncryptedMessage(activeConv.id, ciphertext, iv);

      const newMsg: RenderedMessage = {
        id: record.id || Date.now().toString(),
        sender_id: currentUser?.id || 'me',
        plaintext: '[Encrypted Image Payload]',
        isDecrypted: true,
        created_at: new Date().toISOString(),
        message_type: 'image',
        imageDataUrl: pendingImageDataUrl,
        imageMeta: { name: pendingImageFile.name, size: pendingImageFile.size, mimeType: pendingImageFile.type },
      };

      setMessages((prev) => [...prev, newMsg]);
      setPendingImageFile(null);
      setPendingImageDataUrl(null);
      await loadConversationsSilent();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Encryption / Sync error';
      console.error('Error sending encrypted image:', msg);
    } finally {
      setIsSendingImage(false);
    }
  };

  // Image Selection Handler (via file picker)
  const handlePickImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      console.warn('Please select an image file (JPG, PNG, WebP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      console.warn('Image file size must be less than 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) {
        setPendingImageFile(file);
        setPendingImageDataUrl(ev.target.result as string);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Drag and drop event handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      console.warn('Please drop an image file (JPG, PNG, WebP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      console.warn('Image file size must be less than 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) {
        setPendingImageFile(file);
        setPendingImageDataUrl(ev.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  // Native Image Upload Handler for Profile Photo
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProfileErrorMessage(null);
    setProfileSuccessMessage(null);

    if (file.size > 5 * 1024 * 1024) {
      setProfileErrorMessage('Profile image size must be less than 5MB.');
      return;
    }

    if (!['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(file.type)) {
      setProfileErrorMessage('Unsupported file type. Please upload a PNG, JPEG, or WebP image.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setEditAvatarUrl(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleUpdateProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsUpdatingProfile(true);
    setProfileSuccessMessage(null);
    setProfileErrorMessage(null);

    try {
      const updatedUser = await ApiClient.updateProfile(
        editDisplayName.trim() || undefined,
        editAvatarUrl || undefined,
        editEmail.trim() || undefined
      );
      setCurrentUser(updatedUser);
      setProfileSuccessMessage('Profile updated successfully.');
      await loadConversations();
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.message : (err instanceof Error ? err.message : 'Unable to save your profile. Please try again.');
      setProfileErrorMessage(msg);
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  // Save Contact Alias
  const handleSaveContactAlias = (newAlias: string) => {
    if (!currentUser?.id || !aliasEditingPeer) return;
    const peerId = aliasEditingPeer.peerId;
    const updated = { ...contactAliases };

    if (newAlias.trim()) {
      updated[peerId] = newAlias.trim();
    } else {
      delete updated[peerId];
    }

    setContactAliases(updated);
    try {
      localStorage.setItem(`chartpie_contact_aliases_${currentUser.id}`, JSON.stringify(updated));
    } catch (_) {}
    setAliasEditingPeer(null);
  };

  // TOTP 2FA Setup Flow Handlers
  const handleStart2FASetup = async () => {
    setIsSettingUp2FA(true);
    setTotpErrorMessage(null);
    try {
      const data = await ApiClient.setup2FA();
      setTotpSetupData(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to initialize 2FA setup.';
      setTotpErrorMessage(msg);
    } finally {
      setIsSettingUp2FA(false);
    }
  };

  const handleConfirm2FAEnable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!totpSetupData || !totpVerificationCode.trim()) return;

    setTotpErrorMessage(null);
    setIsSettingUp2FA(true);

    try {
      const res = await ApiClient.enable2FA(totpSetupData.secret, totpVerificationCode.trim(), totpSetupData.recovery_codes);
      if (res.user) setCurrentUser(res.user);
      setTotpSetupData(null);
      setTotpVerificationCode('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to enable 2FA';
      setTotpErrorMessage(msg);
    } finally {
      setIsSettingUp2FA(false);
    }
  };

  const handleDisable2FA = async () => {
    try {
      const res = await ApiClient.disable2FA();
      if (res.user) setCurrentUser(res.user);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to disable 2FA';
      setTotpErrorMessage(msg);
    }
  };

  const handleRevokeDevice = async (deviceId: string) => {
    try {
      await ApiClient.deleteDevice(deviceId);
      await loadUserDevices();
    } catch (err) {
      // Graceful device update error
    }
  };

  const handleLogoutOtherDevices = async () => {
    try {
      await ApiClient.logoutOtherDevices();
      await loadUserDevices();
    } catch (err) {
      // Graceful device update error
    }
  };

  const getVisiblePeerName = (conv: ConversationItem): string => {
    const peerId = conv.peer?.id || conv.other_user_id;
    if (peerId && contactAliases[peerId]) {
      return contactAliases[peerId];
    }
    if (conv.peer && conv.peer.display_name) return conv.peer.display_name;
    if (conv.other_display_name) return conv.other_display_name;
    if (conv.peer && conv.peer.username) return `@${conv.peer.username}`;
    if (conv.other_username) return `@${conv.other_username}`;
    return 'Chartpie User';
  };

  const getVisiblePeerUsername = (conv: ConversationItem): string => {
    return conv.peer?.username || conv.other_username || 'user';
  };

  const getVisiblePeerPresence = (conv: ConversationItem): { status: 'ONLINE' | 'AWAY' | 'OFFLINE'; lastSeen?: string | null } => {
    if (conv.peer) {
      return { status: conv.peer.presence || 'ONLINE', lastSeen: conv.peer.last_seen_at };
    }
    const status = (conv.other_presence_status || 'online').toUpperCase() as 'ONLINE' | 'AWAY' | 'OFFLINE';
    return { status, lastSeen: conv.other_last_seen };
  };

  const filteredConversations = conversations.filter((c) => {
    const peerName = getVisiblePeerName(c).toLowerCase();
    const peerUsername = getVisiblePeerUsername(c).toLowerCase();
    const query = searchQuery.toLowerCase().trim();
    return peerName.includes(query) || peerUsername.includes(query);
  });

  const selectedCountryObj = COUNTRY_CODES.find((c) => c.code === countryCode) || COUNTRY_CODES[0];
  const filteredCountries = COUNTRY_CODES.filter((c) =>
    c.name.toLowerCase().includes(countrySearchTerm.toLowerCase()) || c.code.includes(countrySearchTerm)
  );

  const isPublicPage = ['/', '/features', '/security', '/help', '/download'].includes(currentPath);

  // --- RENDER UNAUTHENTICATED / PUBLIC PAGES & ROUTING ---
  if (authStatus === 'AUTH_INITIALIZING') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF9EF', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <ChartpieEmblem size={56} />
          <p style={{ marginTop: '20px', color: '#81766C', fontSize: '14px', fontWeight: 600, letterSpacing: '0.3px' }}>
            Restoring your secure session...
          </p>
        </div>
      </div>
    );
  }

  if (authStatus === 'AUTH_NETWORK_ERROR') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF9EF', fontFamily: 'system-ui, -apple-system, sans-serif', padding: '20px' }}>
        <div className="warm-card" style={{ maxWidth: '440px', width: '100%', padding: '38px 30px', textAlign: 'center' }}>
          <ChartpieEmblem size={48} />
          <h3 style={{ marginTop: '20px', marginBottom: '8px', fontSize: '18px', fontWeight: 800, color: '#3B3530' }}>
            Connection Error
          </h3>
          <p style={{ color: '#81766C', fontSize: '14px', lineHeight: '1.5', marginBottom: '24px' }}>
            Unable to restore your session. Check your connection and retry.
          </p>
          <button onClick={() => restoreSession(0)} className="auren-btn-primary" style={{ padding: '12px 28px', fontSize: '14px' }}>
            Retry Session
          </button>
        </div>
      </div>
    );
  }

  if (!currentUser || authStatus !== 'AUTHENTICATED' || isPublicPage) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: 'var(--cream-bg)', color: '#3B3530', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        {/* Public Header Bar */}
        <header style={{ padding: '18px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-warm)', backgroundColor: '#FFFDF8', position: 'sticky', top: 0, zIndex: 50 }}>
          <div onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
            <ChartpieEmblem />
          </div>

          <nav style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
            <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', fontWeight: currentPath === '/' ? 800 : 600, color: currentPath === '/' ? '#E7A23B' : '#81766C', cursor: 'pointer', fontSize: '14px' }}>Home</button>
            <button onClick={() => navigate('/features')} style={{ background: 'none', border: 'none', fontWeight: currentPath === '/features' ? 800 : 600, color: currentPath === '/features' ? '#E7A23B' : '#81766C', cursor: 'pointer', fontSize: '14px' }}>Features</button>
            <button onClick={() => navigate('/security')} style={{ background: 'none', border: 'none', fontWeight: currentPath === '/security' ? 800 : 600, color: currentPath === '/security' ? '#E7A23B' : '#81766C', cursor: 'pointer', fontSize: '14px' }}>Security</button>
            <button onClick={() => navigate('/help')} style={{ background: 'none', border: 'none', fontWeight: currentPath === '/help' ? 800 : 600, color: currentPath === '/help' ? '#E7A23B' : '#81766C', cursor: 'pointer', fontSize: '14px' }}>Help</button>
            <button onClick={() => navigate('/download')} style={{ background: 'none', border: 'none', fontWeight: currentPath === '/download' ? 800 : 600, color: currentPath === '/download' ? '#E7A23B' : '#81766C', cursor: 'pointer', fontSize: '14px' }}>App Download</button>
          </nav>

          <div style={{ display: 'flex', gap: '12px' }}>
            {currentUser ? (
              <button onClick={() => navigate('/app/chats')} className="auren-btn-primary" style={{ padding: '8px 18px' }}>Open Messenger →</button>
            ) : (
              <>
                <button onClick={() => navigate('/login')} style={{ padding: '8px 18px', border: '1px solid var(--border-warm)', borderRadius: '10px', background: '#FFFDF8', fontWeight: 700, cursor: 'pointer', color: '#3B3530' }}>Sign In</button>
                <button onClick={() => navigate('/register')} className="auren-btn-primary" style={{ padding: '8px 18px' }}>Register</button>
              </>
            )}
          </div>
        </header>

        {/* View Switcher: Public Product Pages vs Auth Forms */}
        {isPublicPage ? (
          <PublicPages currentPath={currentPath} navigate={navigate} deferredPrompt={deferredPrompt} />
        ) : (
          <div style={{ padding: '40px 20px', display: 'flex', justifyContent: 'center' }}>
            {currentPath === '/login' && authMode === 'login' ? (
              /* DUAL-PANEL LOGIN PAGE: Normal Login (Left) + Automatic Mobile QR Code (Right) */
              <div
                className="animate-fade-in"
                style={{
                  width: '100%',
                  maxWidth: '860px',
                  display: 'flex',
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: '32px',
                  alignItems: 'stretch',
                }}
              >
                {/* Left Panel: Standard Sign In Form */}
                <div className="warm-card" style={{ flex: 1, minWidth: '320px', padding: '38px 32px' }}>
                  <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                    <ChartpieEmblem size={40} />
                  </div>

                  <div style={{ display: 'flex', backgroundColor: '#FFF9EF', borderRadius: '12px', border: '1px solid #E9DED1', padding: '4px', marginBottom: '24px' }}>
                    <button
                      onClick={() => { navigate('/login'); setAuthError(null); }}
                      style={{ flex: 1, padding: '10px', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', backgroundColor: '#E7A23B', color: '#3B3530' }}
                    >
                      Sign In
                    </button>
                    <button
                      onClick={() => { navigate('/register'); setAuthError(null); }}
                      style={{ flex: 1, padding: '10px', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', backgroundColor: 'transparent', color: '#81766C' }}
                    >
                      Create Account
                    </button>
                  </div>

                  {authError && (
                    <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#C93B3B', padding: '12px', borderRadius: '10px', fontSize: '13px', marginBottom: '20px', textAlign: 'center' }}>
                      {authError}
                    </div>
                  )}

                  {otpSuccessMessage && (
                    <div style={{ backgroundColor: 'rgba(120, 168, 120, 0.15)', border: '1px solid rgba(120, 168, 120, 0.4)', color: '#2E632E', padding: '12px', borderRadius: '10px', fontSize: '13px', marginBottom: '20px', textAlign: 'center' }}>
                      {otpSuccessMessage}
                    </div>
                  )}

                  <form onSubmit={handleAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: '#81766C', marginBottom: '6px', fontWeight: 600 }}>Username / User ID</label>
                      <input
                        className="auren-input"
                        type="text"
                        required
                        placeholder="Enter username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: '#81766C', marginBottom: '6px', fontWeight: 600 }}>Password</label>
                      <input
                        className="auren-input"
                        type="password"
                        required
                        placeholder="Enter password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </div>

                    <button type="submit" disabled={isLoading} className="auren-btn-primary" style={{ padding: '12px', fontSize: '14px', marginTop: '8px' }}>
                      {isLoading ? 'Processing...' : 'Sign In'}
                    </button>
                  </form>
                </div>

                {/* Right Panel: Instant Mobile QR Code Login */}
                <div className="warm-card" style={{ flex: 1, minWidth: '320px', padding: '38px 32px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', backgroundColor: '#FFFDF8', border: '1px solid var(--border-warm)' }}>
                  <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 800, color: '#3B3530' }}>
                    Sign in with your phone
                  </h3>
                  <p style={{ fontSize: '12px', color: '#81766C', marginBottom: '20px', lineHeight: '1.5' }}>
                    Open Chartpie on your mobile phone → Settings → Linked Devices → Scan QR Code
                  </p>

                  <div style={{ width: '190px', height: '190px', margin: '0 auto 16px auto', border: '3px solid #E7A23B', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#FFF9EF', padding: '10px' }}>
                    {qrPairingId ? (
                      <div dangerouslySetInnerHTML={{ __html: QrGenerator.generateSvg(qrPairingId, 165) }} />
                    ) : (
                      <div style={{ fontSize: '12px', color: '#81766C' }}>Generating challenge...</div>
                    )}
                  </div>

                  <div style={{ fontSize: '12px', color: '#78A878', fontWeight: 800, marginBottom: '16px' }}>
                    Status: {qrStatus.toUpperCase()} (Waiting for approval...)
                  </div>

                  <button
                    onClick={handleStartQrLogin}
                    style={{ background: 'none', border: 'none', color: '#E7A23B', fontWeight: 700, cursor: 'pointer', fontSize: '13px' }}
                  >
                    🔄 Refresh QR Code
                  </button>
                </div>
              </div>
            ) : (
              /* Single Panel Form for Register / OTP / 2FA */
              <div className="warm-card animate-fade-in" style={{ width: '100%', maxWidth: '440px', padding: '38px 32px' }}>
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                  <ChartpieEmblem size={44} />
                </div>

                {authMode === 'otp_verify' ? (
                  <div>
                    <h3 style={{ textAlign: 'center', margin: '0 0 8px 0', fontSize: '20px', fontWeight: 800, color: '#3B3530' }}>Verify Your Phone</h3>
                    <p style={{ textAlign: 'center', fontSize: '13px', color: '#81766C', marginBottom: '22px', lineHeight: '1.5' }}>
                      We sent a verification code to:<br />
                      <strong style={{ color: '#3B3530', fontSize: '15px' }}>{otpTarget}</strong>
                    </p>

                    {authError && (
                      <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#C93B3B', padding: '12px', borderRadius: '10px', fontSize: '13px', marginBottom: '16px', textAlign: 'center' }}>
                        {authError}
                      </div>
                    )}

                    {otpSuccessMessage && (
                      <div style={{ backgroundColor: 'rgba(120, 168, 120, 0.15)', border: '1px solid rgba(120, 168, 120, 0.4)', color: '#2E632E', padding: '12px', borderRadius: '10px', fontSize: '13px', marginBottom: '16px', textAlign: 'center' }}>
                        {otpSuccessMessage}
                      </div>
                    )}

                    <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', color: '#81766C', marginBottom: '8px', fontWeight: 600, textAlign: 'center' }}>
                          Enter 6-Digit Code
                        </label>
                        <input
                          className="auren-input"
                          type="text"
                          maxLength={6}
                          required
                          autoFocus
                          placeholder="______"
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                          style={{ textAlign: 'center', letterSpacing: '10px', fontSize: '24px', fontWeight: 800, padding: '14px', borderRadius: '12px' }}
                        />
                      </div>

                      <button type="submit" disabled={isLoading || otpCode.length !== 6} className="auren-btn-primary" style={{ padding: '14px', fontSize: '15px' }}>
                        {isLoading ? 'Verifying...' : 'Verify OTP'}
                      </button>

                      <div style={{ textAlign: 'center', marginTop: '4px' }}>
                        <button
                          type="button"
                          disabled={!resendActive || resendLoading}
                          onClick={handleResendOtp}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: resendActive ? '#E7A23B' : '#A4998E',
                            fontWeight: 700,
                            cursor: resendActive ? 'pointer' : 'not-allowed',
                            fontSize: '13px',
                            textDecoration: resendActive ? 'underline' : 'none',
                          }}
                        >
                          {resendLoading ? 'Resending code...' : 'Resend OTP'}
                        </button>

                        {!resendActive && (
                          <div style={{ fontSize: '12px', color: '#81766C', marginTop: '6px' }}>
                            Resend available in <strong>{resendTimer}</strong> seconds
                          </div>
                        )}
                      </div>
                    </form>
                  </div>
                ) : authMode === '2fa' ? (
                  <div>
                    <h3 style={{ textAlign: 'center', margin: '0 0 8px 0', fontSize: '20px', fontWeight: 800 }}>Two-Step Verification</h3>
                    <p style={{ textAlign: 'center', fontSize: '13px', color: '#81766C', marginBottom: '22px' }}>
                      Enter the 6-digit authenticator code or recovery code for <strong>{otpTarget}</strong>
                    </p>

                    {authError && (
                      <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.12)', color: '#C93B3B', padding: '12px', borderRadius: '10px', fontSize: '13px', marginBottom: '16px', textAlign: 'center' }}>
                        {authError}
                      </div>
                    )}

                    <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                      <input
                        className="auren-input"
                        type="text"
                        required
                        placeholder="6-digit code or recovery code"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value)}
                        style={{ textAlign: 'center', fontSize: '18px', fontWeight: 800, padding: '12px' }}
                      />
                      <button type="submit" disabled={isLoading} className="auren-btn-primary" style={{ padding: '12px' }}>
                        {isLoading ? 'Verifying...' : 'Complete Sign In'}
                      </button>
                    </form>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', backgroundColor: '#FFF9EF', borderRadius: '12px', border: '1px solid #E9DED1', padding: '4px', marginBottom: '24px' }}>
                      <button
                        onClick={() => { navigate('/login'); setAuthError(null); }}
                        style={{ flex: 1, padding: '10px', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', backgroundColor: currentPath === '/login' ? '#E7A23B' : 'transparent', color: currentPath === '/login' ? '#3B3530' : '#81766C' }}
                      >
                        Sign In
                      </button>
                      <button
                        onClick={() => { navigate('/register'); setAuthError(null); }}
                        style={{ flex: 1, padding: '10px', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', backgroundColor: currentPath === '/register' ? '#E7A23B' : 'transparent', color: currentPath === '/register' ? '#3B3530' : '#81766C' }}
                      >
                        Create Account
                      </button>
                    </div>

                    {authError && (
                      <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#C93B3B', padding: '12px', borderRadius: '10px', fontSize: '13px', marginBottom: '20px', textAlign: 'center' }}>
                        {authError}
                      </div>
                    )}

                    <form onSubmit={handleAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', color: '#81766C', marginBottom: '6px', fontWeight: 600 }}>Username / User ID</label>
                        <input
                          className="auren-input"
                          type="text"
                          required
                          placeholder="Enter username"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                        />
                      </div>

                      {currentPath === '/register' && (
                        <>
                          <div>
                            <label style={{ display: 'block', fontSize: '12px', color: '#81766C', marginBottom: '6px', fontWeight: 600 }}>Display Name</label>
                            <input
                              className="auren-input"
                              type="text"
                              required
                              placeholder="Enter display name"
                              value={displayName}
                              onChange={(e) => setDisplayName(e.target.value)}
                            />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '12px', color: '#81766C', marginBottom: '6px', fontWeight: 600 }}>Country Code</label>
                            <div style={{ position: 'relative' }}>
                              <button
                                type="button"
                                onClick={() => setIsCountryDropdownOpen(!isCountryDropdownOpen)}
                                className="auren-input"
                                style={{ textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                              >
                                <span>{selectedCountryObj.flag} {selectedCountryObj.name} ({selectedCountryObj.code})</span>
                                <span style={{ fontSize: '10px' }}>▼</span>
                              </button>

                              {isCountryDropdownOpen && (
                                <div className="warm-card" style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '6px', zIndex: 50, maxHeight: '200px', overflowY: 'auto', padding: '8px' }}>
                                  <input
                                    type="text"
                                    placeholder="Search country..."
                                    value={countrySearchTerm}
                                    onChange={(e) => setCountrySearchTerm(e.target.value)}
                                    className="auren-input"
                                    style={{ marginBottom: '8px', padding: '8px' }}
                                  />
                                  {filteredCountries.map((c) => (
                                    <div
                                      key={c.code + c.name}
                                      onClick={() => { setCountryCode(c.code); setIsCountryDropdownOpen(false); }}
                                      style={{ padding: '8px', cursor: 'pointer', fontSize: '13px', display: 'flex', justifyContent: 'space-between' }}
                                    >
                                      <span>{c.flag} {c.name}</span>
                                      <span style={{ color: '#E7A23B', fontWeight: 700 }}>{c.code}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '12px', color: '#81766C', marginBottom: '6px', fontWeight: 600 }}>Phone Number</label>
                            <input
                              className="auren-input"
                              type="text"
                              required
                              placeholder="Enter 10-digit mobile number"
                              value={phoneNumber}
                              onChange={(e) => setPhoneNumber(e.target.value)}
                            />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '12px', color: '#81766C', marginBottom: '6px', fontWeight: 600 }}>Email Address</label>
                            <input
                              className="auren-input"
                              type="email"
                              required
                              placeholder="Enter email address"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                            />
                          </div>
                        </>
                      )}

                      <div>
                        <label style={{ display: 'block', fontSize: '12px', color: '#81766C', marginBottom: '6px', fontWeight: 600 }}>Password</label>
                        <input
                          className="auren-input"
                          type="password"
                          required
                          placeholder="Enter password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                        />
                      </div>

                      {currentPath === '/register' && (
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', color: '#81766C', marginBottom: '6px', fontWeight: 600 }}>Confirm Password</label>
                          <input
                            className="auren-input"
                            type="password"
                            required
                            placeholder="Re-enter password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                          />
                        </div>
                      )}

                      <button type="submit" disabled={isLoading} className="auren-btn-primary" style={{ padding: '12px', fontSize: '14px', marginTop: '8px' }}>
                        {isLoading ? 'Processing...' : currentPath === '/register' ? 'Register & Send OTP' : 'Sign In'}
                      </button>
                    </form>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // --- RENDER MAIN AUTHENTICATED APPLICATION (/app/*) ---
  return (
    <div style={{ height: '100vh', display: 'flex', backgroundColor: 'var(--cream-bg)', color: '#3B3530', overflow: 'hidden', position: 'relative' }}>
      {/* Non-destructive Network Connection Warning Banner */}
      {networkBannerWarning && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: 'rgba(231, 162, 59, 0.95)', color: '#FFFDF8', padding: '8px 16px', fontSize: '12px', fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 100, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <span>⚠️ Connecting to Chartpie backend... Check network connection.</span>
          <button onClick={() => restoreSession(0)} style={{ background: '#FFFDF8', border: 'none', color: '#3B3530', borderRadius: '6px', padding: '4px 10px', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}>
            Retry
          </button>
        </div>
      )}

      {/* Left Sidebar Navigation */}
      <div style={{ width: '320px', borderRight: '1px solid var(--border-warm)', backgroundColor: '#FFFDF8', display: 'flex', flexDirection: 'column' }}>
        {/* Sidebar Header */}
        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-warm)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <ChartpieEmblem size={32} />
        </div>

        {/* Search Bar & Floating Circular '+' Button */}
        <div style={{ padding: '12px 16px', display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input
            className="auren-input"
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ flex: 1, fontSize: '13px', padding: '10px 14px' }}
          />
          <button
            onClick={() => { setShowNewChatModal(true); setSearchResults([]); setUserSearchTerm(''); }}
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              backgroundColor: '#E7A23B',
              color: '#FFFDF8',
              border: 'none',
              fontSize: '20px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 6px rgba(231, 162, 59, 0.35)',
              flexShrink: 0,
            }}
            title="New Conversation"
          >
            ＋
          </button>
        </div>

        {/* Scrollable Conversation List Area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
          {loadError ? (
            <div style={{ textAlign: 'center', color: '#C93B3B', padding: '24px', fontSize: '13px' }}>
              <p style={{ margin: '0 0 12px 0' }}>{loadError}</p>
              <button onClick={loadConversations} className="auren-btn-primary" style={{ padding: '6px 14px', fontSize: '12px' }}>
                Retry
              </button>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#81766C', padding: '32px 16px', fontSize: '13px' }}>
              No active conversations yet.<br />Click <strong>＋</strong> to start a new chat.
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const peerName = getVisiblePeerName(conv);
              const peerUsername = getVisiblePeerUsername(conv);
              const initials = getInitials(peerName);
              const avatarBg = getAvatarBg(peerName);
              const isSelected = activeConv?.id === conv.id;
              const peerId = conv.peer?.id || conv.other_user_id;
              const hasAlias = peerId && !!contactAliases[peerId];

              return (
                <div
                  key={conv.id}
                  onClick={() => selectConversation(conv)}
                  className="warm-card-interactive"
                  style={{
                    padding: '12px',
                    borderRadius: '12px',
                    marginBottom: '6px',
                    cursor: 'pointer',
                    backgroundColor: isSelected ? '#F3C978' : '#FFFDF8',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                  }}
                >
                  <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: avatarBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '15px', color: '#3B3530', overflow: 'hidden' }}>
                    {conv.peer?.avatar_url ? <img src={conv.peer.avatar_url} alt={peerName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '14px', color: '#3B3530', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>{peerName}</span>
                      {hasAlias && <span style={{ fontSize: '10px', backgroundColor: 'rgba(231, 162, 59, 0.25)', color: '#3B3530', padding: '2px 6px', borderRadius: '4px' }}>ALIAS</span>}
                    </div>
                    <div style={{ fontSize: '12px', color: '#81766C', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>@{peerUsername}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* User Profile Card (Fixed at Bottom of Sidebar) */}
        <div
          onClick={() => { setActiveSettingsTab('profile'); navigate('/app/profile'); }}
          className="warm-card-interactive"
          style={{
            padding: '14px 16px',
            borderTop: '1px solid var(--border-warm)',
            backgroundColor: '#FFFDF8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: getAvatarBg(currentUser.display_name || currentUser.username), display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '14px', color: '#3B3530', overflow: 'hidden', flexShrink: 0 }}>
              {currentUser.avatar_url ? <img src={currentUser.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : getInitials(currentUser.display_name || currentUser.username)}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: '14px', color: '#3B3530', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {currentUser.display_name || currentUser.username}
              </div>
              <div style={{ fontSize: '11px', color: '#81766C', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>@{currentUser.username}</span>
                <span style={{ color: '#48BB78', fontWeight: 800 }}>● Online</span>
              </div>
            </div>
          </div>
          <div style={{ color: '#81766C', fontSize: '18px' }}>⚙</div>
        </div>
      </div>

      {/* Main Content Area (Chat Panel with Drag and Drop Support) */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}
      >
        {/* Drag and drop visual overlay */}
        {isDraggingOver && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(231, 162, 59, 0.9)', zIndex: 150, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#FFFDF8', backdropFilter: 'blur(4px)' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🖼️</div>
            <h2 style={{ fontSize: '24px', fontWeight: 800, margin: 0 }}>Drop Image to Encrypt & Send</h2>
            <p style={{ fontSize: '14px', opacity: 0.9, marginTop: '8px' }}>JPG, PNG, WebP up to 5MB</p>
          </div>
        )}

        {activeConv ? (
          <>
            {/* Chat Header */}
            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-warm)', backgroundColor: '#FFFDF8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#3B3530' }}>{getVisiblePeerName(activeConv)}</h3>
                  <button
                    onClick={() => {
                      const peerId = activeConv.peer?.id || activeConv.other_user_id;
                      const origName = activeConv.peer?.display_name || activeConv.other_display_name || activeConv.peer?.username || activeConv.other_username || '';
                      if (peerId) {
                        setAliasEditingPeer({
                          peerId,
                          username: getVisiblePeerUsername(activeConv),
                          displayName: origName,
                        });
                      }
                    }}
                    style={{ background: 'none', border: '1px solid var(--border-warm)', borderRadius: '6px', padding: '2px 8px', fontSize: '11px', fontWeight: 700, color: '#C98262', cursor: 'pointer' }}
                    title="Edit Contact Name Alias"
                  >
                    ✏️ Alias
                  </button>
                </div>
                <span style={{ fontSize: '12px', color: '#81766C' }}>@{getVisiblePeerUsername(activeConv)} • {formatLastSeen(getVisiblePeerPresence(activeConv).lastSeen)}</span>
              </div>
            </div>

            {/* Message History Area */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
              {messagesLoadError ? (
                <div style={{ textAlign: 'center', color: '#C93B3B', padding: '24px' }}>
                  <p>{messagesLoadError}</p>
                  <button onClick={() => fetchMessagesForConv(activeConv, true)} className="auren-btn-primary" style={{ padding: '6px 14px', fontSize: '12px' }}>
                    Retry
                  </button>
                </div>
              ) : messages.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#81766C', padding: '32px' }}>
                  No messages yet. Send an end-to-end encrypted message or image below.
                </div>
              ) : (
                messages.map((m) => {
                  const isMe = m.sender_id === currentUser.id;
                  const isImage = m.message_type === 'image' || !!m.imageDataUrl;

                  return (
                    <div key={m.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', marginBottom: '12px' }}>
                      <div
                        style={{
                          maxWidth: '65%',
                          padding: '12px 16px',
                          borderRadius: '16px',
                          backgroundColor: isMe ? '#E7A23B' : '#FFFDF8',
                          color: isMe ? '#FFFDF8' : '#3B3530',
                          boxShadow: 'var(--shadow-sm)',
                        }}
                      >
                        {isImage && m.imageDataUrl ? (
                          <div>
                            <img
                              src={m.imageDataUrl}
                              alt="Encrypted attachment"
                              onClick={() => setPreviewEnlargedImage(m.imageDataUrl!)}
                              style={{ maxWidth: '100%', maxHeight: '220px', borderRadius: '10px', objectFit: 'cover', cursor: 'pointer', marginBottom: '6px', display: 'block' }}
                            />
                            <div style={{ fontSize: '11px', opacity: 0.85, fontStyle: 'italic' }}>
                              🔒 Encrypted Image {m.imageMeta?.size ? `(${(m.imageMeta.size / 1024).toFixed(0)} KB)` : ''}
                            </div>
                          </div>
                        ) : (
                          <div style={{ fontSize: '14px', wordBreak: 'break-word', lineHeight: '1.4' }}>{m.plaintext}</div>
                        )}
                        <div style={{ fontSize: '10px', opacity: 0.7, marginTop: '4px', textAlign: 'right' }}>
                          {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Composer Footer */}
            <form onSubmit={handleSendMessage} style={{ padding: '16px 24px', backgroundColor: '#FFFDF8', borderTop: '1px solid var(--border-warm)', display: 'flex', gap: '10px', alignItems: 'center', position: 'relative' }}>
              {/* Emoji Picker Button */}
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', padding: '4px 6px', borderRadius: '8px' }}
                title="Insert Emoji"
              >
                😊
              </button>

              {showEmojiPicker && (
                <EmojiPicker
                  onSelectEmoji={(emoji) => setInputMessage((prev) => prev + emoji)}
                  onClose={() => setShowEmojiPicker(false)}
                />
              )}

              {/* Image Attachment Button */}
              <label
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', padding: '4px 6px', borderRadius: '8px', display: 'flex', alignItems: 'center' }}
                title="Attach Encrypted Image"
              >
                📎
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  onChange={handlePickImageFile}
                  style={{ display: 'none' }}
                />
              </label>

              <input
                className="auren-input"
                type="text"
                placeholder="Type an end-to-end encrypted message or drop image..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                style={{ flex: 1, padding: '12px 16px' }}
              />

              <button type="submit" disabled={!inputMessage.trim()} className="auren-btn-primary" style={{ padding: '12px 24px' }}>
                Send
              </button>
            </form>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px', textAlign: 'center' }}>
            <ChartpieEmblem size={64} />
            <h3 style={{ marginTop: '20px', fontSize: '20px', fontWeight: 800 }}>Welcome to Chartpie</h3>
            <p style={{ color: '#81766C', fontSize: '14px', maxWidth: '360px', marginBottom: '24px' }}>
              Select a conversation from the sidebar or start a new encrypted chat.
            </p>
            <button onClick={() => { setShowNewChatModal(true); setSearchResults([]); setUserSearchTerm(''); }} className="auren-btn-primary" style={{ padding: '12px 24px' }}>
              ＋ Start a Conversation
            </button>
          </div>
        )}
      </div>

      {/* Image Preview Modal before sending */}
      {pendingImageFile && pendingImageDataUrl && (
        <ImagePreviewModal
          imageFile={pendingImageFile}
          dataUrl={pendingImageDataUrl}
          onConfirmSend={handleSendEncryptedImage}
          onCancel={() => {
            setPendingImageFile(null);
            setPendingImageDataUrl(null);
          }}
          isSending={isSendingImage}
        />
      )}

      {/* Image Zoom View Modal */}
      {previewEnlargedImage && (
        <div
          onClick={() => setPreviewEnlargedImage(null)}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', cursor: 'zoom-out' }}
        >
          <img src={previewEnlargedImage} alt="Enlarged" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: '12px', objectFit: 'contain' }} />
        </div>
      )}

      {/* Edit Contact Alias Modal */}
      {aliasEditingPeer && (
        <ContactAliasModal
          peerUsername={aliasEditingPeer.username}
          originalDisplayName={aliasEditingPeer.displayName}
          currentAlias={contactAliases[aliasEditingPeer.peerId] || ''}
          onSaveAlias={handleSaveContactAlias}
          onClearAlias={() => handleSaveContactAlias('')}
          onClose={() => setAliasEditingPeer(null)}
        />
      )}

      {/* Profile & Settings Drawer Modal */}
      {activeSettingsTab && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(59, 53, 48, 0.4)', backdropFilter: 'blur(6px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="warm-card animate-fade-in" style={{ width: '100%', maxWidth: '640px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: '0', overflow: 'hidden' }}>
            {/* Modal Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-warm)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFFDF8' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <ChartpieEmblem size={28} />
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#3B3530' }}>Settings & Security</h3>
              </div>
              <button
                onClick={() => { setActiveSettingsTab(null); navigate(activeConv ? `/app/chats/${activeConv.id}` : '/app/chats'); }}
                style={{ background: 'none', border: 'none', color: '#81766C', fontSize: '20px', fontWeight: 700, cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Modal Navigation Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-warm)', backgroundColor: '#FFF9EF' }}>
              <button
                onClick={() => { setActiveSettingsTab('profile'); navigate('/app/profile'); }}
                style={{ flex: 1, padding: '12px', border: 'none', fontWeight: 700, fontSize: '13px', cursor: 'pointer', background: activeSettingsTab === 'profile' ? '#E7A23B' : 'transparent', color: activeSettingsTab === 'profile' ? '#3B3530' : '#81766C' }}
              >
                👤 Profile
              </button>
              <button
                onClick={() => { setActiveSettingsTab('security'); navigate('/app/security'); }}
                style={{ flex: 1, padding: '12px', border: 'none', fontWeight: 700, fontSize: '13px', cursor: 'pointer', background: activeSettingsTab === 'security' ? '#E7A23B' : 'transparent', color: activeSettingsTab === 'security' ? '#3B3530' : '#81766C' }}
              >
                🔒 2FA Security
              </button>
              <button
                onClick={() => { setActiveSettingsTab('devices'); loadUserDevices(); navigate('/app/devices'); }}
                style={{ flex: 1, padding: '12px', border: 'none', fontWeight: 700, fontSize: '13px', cursor: 'pointer', background: activeSettingsTab === 'devices' ? '#E7A23B' : 'transparent', color: activeSettingsTab === 'devices' ? '#3B3530' : '#81766C' }}
              >
                📱 Linked Devices
              </button>
            </div>

            {/* Modal Body Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
              {activeSettingsTab === 'profile' && (
                <div>
                  <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                    <div style={{ width: '90px', height: '90px', borderRadius: '50%', background: getAvatarBg(currentUser.display_name || currentUser.username), display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '32px', color: '#3B3530', overflow: 'hidden', marginBottom: '12px' }}>
                      {editAvatarUrl || currentUser.avatar_url ? <img src={editAvatarUrl || currentUser.avatar_url!} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : getInitials(currentUser.display_name || currentUser.username)}
                    </div>
                    <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800 }}>{currentUser.display_name || currentUser.username}</h3>
                    <div style={{ color: '#C98262', fontSize: '13px', fontWeight: 600 }}>@{currentUser.username}</div>
                  </div>

                  {profileSuccessMessage && (
                    <div style={{ backgroundColor: 'rgba(120, 168, 120, 0.15)', border: '1px solid rgba(120, 168, 120, 0.4)', color: '#2E632E', padding: '12px', borderRadius: '10px', fontSize: '13px', marginBottom: '20px', textAlign: 'center' }}>
                      {profileSuccessMessage}
                    </div>
                  )}

                  {profileErrorMessage && (
                    <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#C93B3B', padding: '12px', borderRadius: '10px', fontSize: '13px', marginBottom: '20px', textAlign: 'center' }}>
                      {profileErrorMessage}
                    </div>
                  )}

                  <form onSubmit={handleUpdateProfileSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: '#81766C', marginBottom: '6px', fontWeight: 600 }}>Change Profile Photo</label>
                      <input type="file" accept="image/png, image/jpeg, image/webp" onChange={handleImageUpload} style={{ fontSize: '13px' }} />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: '#81766C', marginBottom: '6px', fontWeight: 600 }}>Display Name</label>
                      <input className="auren-input" type="text" required value={editDisplayName} onChange={(e) => setEditDisplayName(e.target.value)} />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: '#81766C', marginBottom: '6px', fontWeight: 600 }}>Email Address</label>
                      <input className="auren-input" type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
                    </div>

                    <button type="submit" disabled={isUpdatingProfile} className="auren-btn-primary" style={{ padding: '12px', marginTop: '8px' }}>
                      {isUpdatingProfile ? 'Saving...' : 'Save Profile'}
                    </button>
                  </form>

                  <button onClick={handleLogout} style={{ width: '100%', padding: '12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#C93B3B', borderRadius: '10px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', marginTop: '20px' }}>
                    ↪ Sign Out of Account
                  </button>
                </div>
              )}

              {activeSettingsTab === 'security' && (
                <div>
                  <h3 style={{ margin: '0 0 8px 0', fontSize: '16px' }}>Status: {currentUser.two_factor_enabled ? '🟢 ENABLED' : '⚪ NOT ENABLED'}</h3>
                  <p style={{ fontSize: '13px', color: '#81766C', marginBottom: '20px', lineHeight: '1.5' }}>
                    Two-Step Verification adds an additional layer of security by requiring a 6-digit TOTP code from an authenticator app (Google Authenticator, Authy, 1Password) when logging into your account.
                  </p>

                  {totpErrorMessage && (
                    <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#C93B3B', padding: '12px', borderRadius: '10px', fontSize: '13px', marginBottom: '20px', textAlign: 'center' }}>
                      {totpErrorMessage}
                    </div>
                  )}

                  {!currentUser.two_factor_enabled ? (
                    !totpSetupData ? (
                      <button onClick={handleStart2FASetup} disabled={isSettingUp2FA} className="auren-btn-primary" style={{ padding: '12px 20px', fontSize: '14px' }}>
                        {isSettingUp2FA ? 'Initializing...' : 'Enable Two-Step Verification'}
                      </button>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div style={{ textAlign: 'center', background: '#FFF9EF', padding: '20px', borderRadius: '16px', border: '1px solid #E9DED1' }}>
                          <div style={{ fontWeight: 800, marginBottom: '12px', fontSize: '14px' }}>1. Scan QR Code in Authenticator App</div>
                          <div style={{ width: '180px', height: '180px', margin: '0 auto 12px auto', border: '3px solid #E7A23B', borderRadius: '12px', background: '#FFFDF8', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <div dangerouslySetInnerHTML={{ __html: QrGenerator.generateSvg(totpSetupData.otpauth_url, 160) }} />
                          </div>
                          <div style={{ fontSize: '12px', color: '#81766C', wordBreak: 'break-all' }}>
                            Manual Secret: <strong style={{ color: '#3B3530' }}>{totpSetupData.secret}</strong>
                          </div>
                        </div>

                        <div style={{ background: '#FFF9EF', padding: '16px', borderRadius: '12px', border: '1px solid #E9DED1' }}>
                          <div style={{ fontWeight: 800, fontSize: '13px', marginBottom: '8px' }}>2. Store Recovery Codes (Keep Safe)</div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '12px', fontFamily: 'monospace', color: '#3B3530', fontWeight: 700 }}>
                            {totpSetupData.recovery_codes.map((code) => (
                              <div key={code} style={{ background: '#FFFDF8', padding: '6px', borderRadius: '6px', textAlign: 'center', border: '1px solid #E9DED1' }}>{code}</div>
                            ))}
                          </div>
                        </div>

                        <form onSubmit={handleConfirm2FAEnable} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '12px', color: '#81766C', marginBottom: '6px', fontWeight: 600 }}>3. Enter 6-Digit Code to Verify</label>
                            <input
                              className="auren-input"
                              type="text"
                              maxLength={6}
                              required
                              placeholder="000000"
                              value={totpVerificationCode}
                              onChange={(e) => setTotpVerificationCode(e.target.value.replace(/\D/g, ''))}
                              style={{ textAlign: 'center', letterSpacing: '6px', fontSize: '20px', fontWeight: 800 }}
                            />
                          </div>

                          <div style={{ display: 'flex', gap: '12px' }}>
                            <button type="submit" disabled={isSettingUp2FA || totpVerificationCode.length !== 6} className="auren-btn-primary" style={{ flex: 1, padding: '12px' }}>
                              {isSettingUp2FA ? 'Verifying...' : 'Confirm & Enable 2FA'}
                            </button>
                            <button type="button" onClick={() => setTotpSetupData(null)} style={{ padding: '12px 18px', border: '1px solid var(--border-warm)', borderRadius: '10px', background: '#FFFDF8', fontWeight: 700, cursor: 'pointer' }}>
                              Cancel
                            </button>
                          </div>
                        </form>
                      </div>
                    )
                  ) : (
                    <button onClick={handleDisable2FA} style={{ padding: '12px 20px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#C93B3B', borderRadius: '10px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
                      Disable Two-Step Verification
                    </button>
                  )}
                </div>
              )}

              {activeSettingsTab === 'devices' && (
                <div>
                  <h3 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>Authorized Device Sessions</h3>

                  <div style={{ marginBottom: '24px', background: '#FFF9EF', padding: '16px', borderRadius: '14px', border: '1px solid #E9DED1' }}>
                    <div style={{ fontWeight: 800, fontSize: '13px', marginBottom: '6px' }}>📱 Approve New Laptop via QR Code</div>
                    <p style={{ fontSize: '12px', color: '#81766C', marginBottom: '12px', margin: '0 0 12px 0' }}>
                      Enter the QR pairing ID displayed on your laptop browser screen to approve the session.
                    </p>
                    <form onSubmit={handleApproveQrCode} style={{ display: 'flex', gap: '10px' }}>
                      <input className="auren-input" type="text" placeholder="Enter QR Pairing ID..." value={scanQrInput} onChange={(e) => setScanQrInput(e.target.value)} style={{ flex: 1, fontSize: '13px' }} />
                      <button type="submit" className="auren-btn-primary" style={{ padding: '8px 16px', fontSize: '13px' }}>Approve</button>
                    </form>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 800 }}>Active Sessions ({devicesList.length})</h4>
                    {devicesList.length > 1 && (
                      <button onClick={handleLogoutOtherDevices} style={{ background: 'none', border: 'none', color: '#C93B3B', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}>
                        Revoke All Other Sessions
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {devicesList.map((dev) => (
                      <div key={dev.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderRadius: '12px', background: '#FFFDF8', border: '1px solid var(--border-warm)' }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '13px' }}>{dev.device_name} ({dev.device_type})</div>
                          <div style={{ fontSize: '11px', color: '#81766C' }}>Registered: {new Date(dev.created_at).toLocaleDateString()} • Last Active: {formatLastSeen(dev.last_seen)}</div>
                        </div>
                        <button onClick={() => handleRevokeDevice(dev.id)} style={{ padding: '6px 12px', border: '1px solid rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.08)', color: '#C93B3B', borderRadius: '6px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                          Revoke
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* New Conversation Modal */}
      {showNewChatModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(59, 53, 48, 0.4)', backdropFilter: 'blur(4px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="warm-card animate-fade-in" style={{ width: '100%', maxWidth: '420px', padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>Start New Conversation</h3>
              <button onClick={() => setShowNewChatModal(false)} style={{ background: 'none', border: 'none', fontSize: '18px', color: '#81766C', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
              <input
                className="auren-input"
                type="text"
                autoFocus
                placeholder="Search username or ID..."
                value={userSearchTerm}
                onChange={(e) => setUserSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchUsers()}
                style={{ flex: 1, fontSize: '13px' }}
              />
              <button onClick={handleSearchUsers} className="auren-btn-primary" style={{ padding: '10px 16px', fontSize: '13px' }}>
                Search
              </button>
            </div>

            <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
              {isSearchingUsers ? (
                <div style={{ textAlign: 'center', color: '#81766C', padding: '16px' }}>Searching Chartpie directory...</div>
              ) : searchResults.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#81766C', padding: '16px', fontSize: '13px' }}>
                  {userSearchTerm ? 'No users found matching query.' : 'Type a username to find Chartpie users.'}
                </div>
              ) : (
                searchResults.map((u) => (
                  <div
                    key={u.id}
                    onClick={() => startConversationWithUser(u)}
                    className="warm-card-interactive"
                    style={{ padding: '10px 14px', borderRadius: '10px', marginBottom: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}
                  >
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: getAvatarBg(u.display_name || u.username), display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '13px', color: '#3B3530' }}>
                      {getInitials(u.display_name || u.username)}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '13px' }}>{u.display_name || u.username}</div>
                      <div style={{ fontSize: '11px', color: '#81766C' }}>@{u.username}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
