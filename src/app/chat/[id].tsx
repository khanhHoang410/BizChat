import { Colors } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import socketService from '../lib/socket';

// ─── Types ────────────────────────────────────────────────────────────────────
type Message = {
  _id: string;
  sender: { _id: string; name: string; avatar?: string };
  content: string;
  type: 'text' | 'image' | 'file' | 'system' | 'poll';
  createdAt: string;
  readBy: string[];
  attachments?: { url: string; type: string; name: string }[];
  isRevoked?: boolean;
  pinned?: boolean;
  pinnedAt?: string;
  threadCount?: number;
  metadata?: {
    poll?: {
      options: string[];
      votes: { user: string; option: number }[];
    };
  };
};

type UserInfo = {
  _id: string;
  name: string;
  avatar?: string;
  status: 'online' | 'offline' | 'away';
};

type GroupInfo = {
  _id: string;
  name: string;
  avatar?: string;
  membersCount: number;
};

type ThreadInfo = {
  parentId: string;
  replyCount: number;
  lastReplyAt: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────
const BASE_URL = 'http://103.82.25.230:3001';
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const EMOJI_CATEGORIES = [
  { label: 'Phổ biến', icon: '⭐', emojis: ['😀','😂','🥰','😍','🤩','😎','🥳','😅','🤣','😭','😤','😡','🥺','😢','😮','🤔','🤫','🤭','😏','😒'] },
  { label: 'Cảm xúc', icon: '😊', emojis: ['😊','😇','🙂','🙃','😉','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🥴','🤧','🥵','🥶','😵'] },
  { label: 'Tay', icon: '👋', emojis: ['👋','🤚','🖐️','✋','🖖','👌','🤌','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','👇','☝️','👍','👎','✊'] },
  { label: 'Trái tim', icon: '❤️', emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','♥️'] },
];

// ─── Component ────────────────────────────────────────────────────────────────
const ChatDetailScreen = () => {
  const { id, type } = useLocalSearchParams<{ id: string; type: string }>();
  const router = useRouter();
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  const flatListRef = useRef<FlatList>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasMarkedReadRef = useRef(false);
  const onViewableItemsChanged = useRef((_: any) => {});
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 });
  const currentUserRef = useRef<UserInfo | null>(null); // ← thêm ref để dùng trong socket closure

  const [currentUser, setCurrentUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [groupInfo, setGroupInfo] = useState<GroupInfo | null>(null);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [emojiCategoryIndex, setEmojiCategoryIndex] = useState(0);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [showMessageOptions, setShowMessageOptions] = useState(false);
  // Tin nhắn được ghim (hiện banner đầu màn hình)
  const [pinnedMessage, setPinnedMessage] = useState<Message | null>(null);
  // ── Thread ────────────────────────────────────────────────────────────────────
  const [threadCounts, setThreadCounts] = useState<Record<string, number>>({});
  const [threadByParentId, setThreadByParentId] = useState<Record<string, ThreadInfo>>({});
  const [showThread, setShowThread] = useState(false);
  const [activeThreadParentId, setActiveThreadParentId] = useState<string | null>(null);
  const [threadMessages, setThreadMessages] = useState<Message[]>([]);
  const [threadParent, setThreadParent] = useState<Message | null>(null);
  const [threadInput, setThreadInput] = useState('');
  const [sendingThread, setSendingThread] = useState(false);
  const threadListRef = useRef<FlatList>(null);

  // ── Poll state ────────────────────────────────────────────────────────────────
  const [showPollModal, setShowPollModal] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [creatingPoll, setCreatingPoll] = useState(false);

  const getToken = () => AsyncStorage.getItem('userToken');

  // ─── Poll functions ───────────────────────────────────────────────────────────
  const createPoll = async () => {
    if (!pollQuestion.trim()) return Alert.alert('Lỗi', 'Nhập câu hỏi bình chọn');
    const validOptions = pollOptions.map(o => o.trim()).filter(Boolean);
    if (validOptions.length < 2) return Alert.alert('Lỗi', 'Cần ít nhất 2 lựa chọn');
    setCreatingPoll(true);
    try {
      const token = await getToken();
      const res = await fetch(`${BASE_URL}/api/chat/poll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ groupId: id, question: pollQuestion.trim(), options: validOptions }),
      });
      const data = await res.json();
      if (res.ok && data.message) {
        setMessages(prev => [...prev, data.message]);
        flatListRef.current?.scrollToEnd({ animated: true });
        const socket = socketService.getSocket();
        setShowPollModal(false);
        setPollQuestion('');
        setPollOptions(['', '']);
      } else Alert.alert('Lỗi', data.error || 'Không thể tạo bình chọn');
    } catch (e) { Alert.alert('Lỗi', 'Không thể kết nối server'); }
    finally { setCreatingPoll(false); }
  };

  const votePoll = async (messageId: string, optionIndex: number) => {
    try {
      const token = await getToken();
      const res = await fetch(`${BASE_URL}/api/chat/poll/${messageId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ optionIndex }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessages(prev => prev.map(m =>
          m._id === messageId ? { ...m, metadata: { ...m.metadata, poll: data.poll } } : m
        ));
        // Emit socket để realtime
        const socket = socketService.getSocket();
        socket?.emit('vote_poll', { messageId, optionIndex });
      }
    } catch (e) { console.error('Vote error:', e); }
  };

  // ─── Fetch functions ─────────────────────────────────────────────────────────
  const fetchCurrentUser = async () => {
    try {
      const token = await getToken();
      const response = await fetch(`${BASE_URL}/api/auth/profile`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json();
      if (data.user) {
        const user = { _id: data.user.id, name: data.user.name, avatar: data.user.avatar, status: data.user.status };
        setCurrentUser(user);
        currentUserRef.current = user; // ← update ref luôn
      }
    } catch (error) { console.error('Fetch current user error:', error); }
  };

  const fetchUserInfo = async () => {
    try {
      const token = await getToken();
      const response = await fetch(`${BASE_URL}/api/users/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json();
      setUserInfo(data.user);
    } catch (error) { console.error('Fetch user info error:', error); }
  };

  const fetchGroupInfo = async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${BASE_URL}/api/groups/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok) setGroupInfo({ _id: data.group._id, name: data.group.name, avatar: data.group.avatar, membersCount: data.group.members.length });
    } catch (error) { console.error('Fetch group info error:', error); }
  };

  const fetchMessages = async () => {
    try {
      const token = await getToken();
      const response = await fetch(`${BASE_URL}/api/chat/messages/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json();
      const msgs: Message[] = (data.messages || []).filter((m: any) => !m.thread);
      setMessages(msgs);
      const pinned = msgs.filter(m => m.pinned).sort((a, b) => new Date(b.pinnedAt || 0).getTime() - new Date(a.pinnedAt || 0).getTime())[0];
      setPinnedMessage(pinned || null);
      // Load thread summary cho nhóm
      if (type === 'group') fetchThreadSummary();
    } catch (error) { console.error('Fetch messages error:', error); }
    finally { setLoading(false); }
  };

  const fetchThreadSummary = async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${BASE_URL}/api/chat/thread-summary/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok && data.threads) {
        const counts: Record<string, number> = {};
        data.threads.forEach((t: any) => { counts[t.parentId] = t.replyCount; });
        setThreadCounts(counts);
      }
    } catch (e) { console.error('Thread summary error:', e); }
  };

  const openThread = async (parentId: string) => {
    try {
      const token = await getToken();
      const res = await fetch(`${BASE_URL}/api/chat/thread/${parentId}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok) {
        setThreadParent(data.parent);
        setThreadMessages(data.messages || []);
        setActiveThreadParentId(parentId);
        setShowThread(true);
      }
    } catch (e) { console.error('Open thread error:', e); }
  };

  const sendThreadMessage = async () => {
    if (!threadInput.trim() || !activeThreadParentId || sendingThread) return;
    const content = threadInput.trim();
    setThreadInput('');
    setSendingThread(true);
    try {
      // Thử socket trước
      const socket = socketService.getSocket();
      if (socket?.connected) {
        socket.emit('send_thread_message', { parentId: activeThreadParentId, content, type: 'text' });
        // Optimistic update
        const tempMsg: Message = {
          _id: `temp_${Date.now()}`,
          sender: { _id: currentUser?._id || '', name: currentUser?.name || '', avatar: currentUser?.avatar },
          content, type: 'text', createdAt: new Date().toISOString(), readBy: [],
        };
        setThreadMessages(prev => [...prev, tempMsg]);
        setTimeout(() => threadListRef.current?.scrollToEnd({ animated: true }), 100);
      } else {
        // Fallback REST
        const token = await getToken();
        const res = await fetch(`${BASE_URL}/api/chat/thread/${activeThreadParentId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ content, type: 'text' }),
        });
        const data = await res.json();
        if (res.ok) {
          setThreadMessages(prev => [...prev, data.message]);
          setThreadCounts(prev => ({ ...prev, [activeThreadParentId]: (prev[activeThreadParentId] || 0) + 1 }));
          setTimeout(() => threadListRef.current?.scrollToEnd({ animated: true }), 100);
        }
      }
    } catch (e) { console.error('Send thread error:', e); }
    finally { setSendingThread(false); }
  };

  // ─── Mark as read ─────────────────────────────────────────────────────────────
  const markMessagesAsRead = useCallback(async (msgs: Message[], user: UserInfo) => {
    if (hasMarkedReadRef.current) return; // ← bỏ điều kiện type === 'group'
    const unreadIds = msgs
      .filter(msg => msg.sender._id !== user._id && !msg.readBy.includes(user._id))
      .map(msg => msg._id);
    if (unreadIds.length === 0) return;
    hasMarkedReadRef.current = true;
    try {
      const token = await getToken();
      await fetch(`${BASE_URL}/api/chat/mark-read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messageIds: unreadIds }),
      });
      setMessages(prev => prev.map(msg => ({
        ...msg,
        readBy: unreadIds.includes(msg._id) ? [...msg.readBy, user._id] : msg.readBy
      })));
      const socket = socketService.getSocket();
      if (socket?.connected) {
        socket.emit('messages_read', { messageIds: unreadIds, readerId: user._id, senderId: id });
      }
    } catch { hasMarkedReadRef.current = false; }
  }, [id, type]);

  useEffect(() => {
    onViewableItemsChanged.current = ({ viewableItems }: { viewableItems: Array<{ item: Message }> }) => {
      if (!currentUser) return; // ← bỏ điều kiện type === 'group'
      const visibleIds = viewableItems.map(v => v.item._id);
      const hasUnread = messages.some(msg =>
        visibleIds.includes(msg._id) &&
        msg.sender._id !== currentUser._id &&
        !msg.readBy.includes(currentUser._id)
      );
      if (hasUnread) markMessagesAsRead(messages, currentUser);
    };
  }, [messages, currentUser, markMessagesAsRead, type]);

  // ─── Socket (chính) ──────────────────────────────────────────────────────────
  useEffect(() => {
    fetchCurrentUser();
    if (type === 'group') fetchGroupInfo(); else fetchUserInfo();
    fetchMessages();

    const socket = socketService.getSocket();
    if (!socket) return;

    const handleReceiveMessage = (data: any) => {
      // ← Bỏ qua tin nhắn thuộc thread (có field thread)
      if (data.message?.thread) return;

      if (type === 'private' && data.type === 'private' && data.message.sender._id === id) {
        setMessages(prev => [...prev, data.message]);
        flatListRef.current?.scrollToEnd({ animated: true });
        hasMarkedReadRef.current = false;
      } else if (type === 'group' && data.type === 'group' && data.message.group === id) {
        // Nếu là tin nhắn của chính mình → đã có temp rồi, chỉ replace temp bằng tin thật
        setMessages(prev => {
          const hasTemp = prev.some(m => m._id.startsWith('temp_'));
          if (hasTemp && data.message.sender._id === currentUserRef.current?._id) {
            // Replace temp bằng tin nhắn thật từ server
            return prev.map(m => m._id.startsWith('temp_') ? data.message : m);
          }
          // Tin nhắn của người khác → thêm vào
          return [...prev, data.message];
        });
        flatListRef.current?.scrollToEnd({ animated: true });
      }
    };

    const handleUserTyping = (data: any) => {
      if (type === 'private' && data.userId === id) setOtherUserTyping(data.isTyping);
    };

    const handleMessagesRead = (data: { messageIds: string[]; readerId: string }) => {
      if (type === 'private' && data.readerId === id) {
        setMessages(prev => prev.map(msg => ({
          ...msg,
          readBy: data.messageIds.includes(msg._id) ? [...new Set([...msg.readBy, data.readerId])] : msg.readBy,
        })));
      }
    };

    const handleMessageSent = (data: { messageId: string }) => {
      // Private: replace temp bằng messageId thật
      // Group: không cần xử lý ở đây vì receive_message đã replace temp rồi
      if (type === 'private') {
        setMessages(prev => {
          const hasTemp = prev.some(msg => msg._id.startsWith('temp_'));
          if (!hasTemp) return prev;
          return prev.map(msg => msg._id.startsWith('temp_') ? { ...msg, _id: data.messageId } : msg);
        });
      }
    };

    const handleMessageError = () => {
      setMessages(prev => prev.filter(msg => !msg._id.startsWith('temp_')));
    };

    // ✅ FIX: Thu hồi — xóa attachments và đổi type về text
    const handleMessageRevoked = ({ messageId }: { messageId: string }) => {
      setMessages(prev => prev.map(msg =>
        msg._id === messageId
          ? { ...msg, content: 'Tin nhắn đã được thu hồi', isRevoked: true, type: 'text', attachments: [] }
          : msg
      ));
    };

    // ✅ Ghim — cập nhật pinnedMessage banner
   const handleMessagePinned = ({ messageId, pinned, pinnedAt }: { messageId: string; pinned: boolean; pinnedAt?: string }) => {
  setMessages(prev => prev.map(msg => msg._id === messageId ? { ...msg, pinned, pinnedAt } : msg));
  if (pinned) {
    const msg = messages.find(m => m._id === messageId);
    if (msg) setPinnedMessage({ ...msg, pinned: true, pinnedAt });
  } else {
    setPinnedMessage(null); // ← bỏ hết, không tìm remaining
  }
};

    // ── Thread message nhận được qua socket ──────────────────────────────────
    const handleReceiveThreadMessage = ({ parentId, message }: { parentId: string; message: Message }) => {
      // Cập nhật threadCounts
      setThreadCounts(prev => ({ ...prev, [parentId]: (prev[parentId] || 0) + 1 }));
      // Nếu đang mở thread này thì thêm message vào
      if (activeThreadParentId === parentId) {
        setThreadMessages(prev => {
          // Thay temp nếu có
          const hastemp = prev.some(m => m._id.startsWith('temp_'));
          if (hastemp) return prev.map(m => m._id.startsWith('temp_') ? message : m);
          return [...prev, message];
        });
        setTimeout(() => threadListRef.current?.scrollToEnd({ animated: true }), 100);
      }
    };

    socket.on('receive_message', handleReceiveMessage);
    socket.on('receive_thread_message', handleReceiveThreadMessage);
    socket.on('user_typing', handleUserTyping);
    socket.on('messages_read', handleMessagesRead);
    socket.on('message_sent', handleMessageSent);
    socket.on('message_error', handleMessageError);
    socket.on('message_revoked', handleMessageRevoked);
    socket.on('message_pinned', handleMessagePinned);
    socket.on('poll_updated', ({ messageId, poll }: { messageId: string; poll: any }) => {
      setMessages(prev => prev.map(m =>
        m._id === messageId ? { ...m, metadata: { ...m.metadata, poll } } : m
      ));
    });

    if (type === 'group' && socket.connected) socket.emit('join_group', id);

    return () => {
      socket.off('receive_message', handleReceiveMessage);
      socket.off('receive_thread_message', handleReceiveThreadMessage);
      socket.off('poll_updated');
      socket.off('user_typing', handleUserTyping);
      socket.off('messages_read', handleMessagesRead);
      socket.off('message_sent', handleMessageSent);
      socket.off('message_error', handleMessageError);
      socket.off('message_revoked', handleMessageRevoked);
      socket.off('message_pinned', handleMessagePinned);
    };
  }, [id, type]);

  // ─── Typing ──────────────────────────────────────────────────────────────────
  const handleTyping = (text: string) => {
    setInputText(text);
    const socket = socketService.getSocket();
    if (!socket?.connected) return;
    const eventData = type === 'group' ? { groupId: id, isTyping: text.length > 0 } : { receiverId: id, isTyping: text.length > 0 };
    socket.emit('typing', eventData);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    if (text.length > 0) {
      typingTimerRef.current = setTimeout(() => { socket.emit('typing', { ...eventData, isTyping: false }); }, 2000);
    }
  };

  // ─── Send text ───────────────────────────────────────────────────────────────
  const sendMessage = async () => {
    if (!inputText.trim() || sending) return;
    const messageContent = inputText.trim();
    setInputText('');
    setShowEmojiPicker(false);
    setSending(true);

    const socket = socketService.getSocket();
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    if (socket?.connected) {
      type === 'group'
        ? socket.emit('typing', { groupId: id, isTyping: false })
        : socket.emit('typing', { receiverId: id, isTyping: false });
    }

    const tempId = `temp_${Date.now()}`;
    const newMsg: Message = {
      _id: tempId,
      sender: { _id: currentUser?._id || '', name: currentUser?.name || '', avatar: currentUser?.avatar },
      content: messageContent, type: 'text', createdAt: new Date().toISOString(), readBy: [],
    };
    setMessages(prev => [...prev, newMsg]);
    flatListRef.current?.scrollToEnd({ animated: true });

    if (socket?.connected) {
      type === 'group'
        ? socket.emit('send_group_message', { groupId: id, content: messageContent, type: 'text' })
        : socket.emit('send_private_message', { receiverId: id, content: messageContent, type: 'text' });
    } else {
      try {
        const token = await getToken();
        const body = type === 'group' ? { groupId: id, content: messageContent, type: 'text' } : { receiverId: id, content: messageContent, type: 'text' };
        const response = await fetch(`${BASE_URL}/api/chat/send`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body),
        });
        const data = await response.json();
        if (data.message) setMessages(prev => prev.map(msg => msg._id === tempId ? data.message : msg));
        else setMessages(prev => prev.filter(msg => msg._id !== tempId));
      } catch { setMessages(prev => prev.filter(msg => msg._id !== tempId)); }
    }
    setSending(false);
  };

  // ─── Send image ──────────────────────────────────────────────────────────────
  const pickAndSendImage = async () => {
    setShowAttachMenu(false);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Cần quyền truy cập', 'Cho phép ứng dụng truy cập thư viện ảnh trong Cài đặt.'); return; }

    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: false, quality: 0.7 });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setUploadingImage(true);

    const tempId = `temp_${Date.now()}`;
    setMessages(prev => [...prev, {
      _id: tempId,
      sender: { _id: currentUser?._id || '', name: currentUser?.name || '', avatar: currentUser?.avatar },
      content: '📷 Ảnh', type: 'image', createdAt: new Date().toISOString(), readBy: [],
      attachments: [{ url: asset.uri, type: 'image', name: 'photo.jpg' }],
    }]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const token = await getToken();
      const formData = new FormData();
      formData.append('file', { uri: asset.uri, type: asset.mimeType || 'image/jpeg', name: `photo_${Date.now()}.jpg` } as any);
      type === 'group' ? formData.append('groupId', id as string) : formData.append('receiverId', id as string);

      const uploadRes = await fetch(`${BASE_URL}/api/chat/upload/image`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData });
      const uploadData = await uploadRes.json();
      const imageUrl = uploadData.file?.url || asset.uri;

      setMessages(prev => prev.map(m => m._id === tempId ? { ...m, attachments: [{ url: imageUrl, type: 'image', name: 'photo.jpg' }] } : m));

      const socket = socketService.getSocket();
      if (socket?.connected) {
        const messageData = { content: '📷 Ảnh', type: 'image', attachments: [{ url: imageUrl, type: 'image', name: 'photo.jpg' }] };
        type === 'group'
          ? socket.emit('send_group_message', { groupId: id, ...messageData })
          : socket.emit('send_private_message', { receiverId: id, ...messageData });
      }
    } catch (e) { console.error('Upload image error:', e); }
    finally { setUploadingImage(false); }
  };

  // ─── Send file ───────────────────────────────────────────────────────────────
  const pickAndSendFile = async () => {
    setShowAttachMenu(false);
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/zip','application/x-zip-compressed','video/*','audio/*'],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setUploadingFile(true);

    const tempId = `temp_${Date.now()}`;
    setMessages(prev => [...prev, {
      _id: tempId,
      sender: { _id: currentUser?._id || '', name: currentUser?.name || '', avatar: currentUser?.avatar },
      content: asset.name || 'File', type: 'file', createdAt: new Date().toISOString(), readBy: [],
      attachments: [{ url: '', type: 'document', name: asset.name || 'file' }],
    }]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const token = await getToken();
      const formData = new FormData();
      formData.append('file', { uri: asset.uri, type: asset.mimeType || 'application/octet-stream', name: asset.name || `file_${Date.now()}` } as any);
      type === 'group' ? formData.append('groupId', id as string) : formData.append('receiverId', id as string);

      const uploadRes = await fetch(`${BASE_URL}/api/chat/upload/document`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData });
      const uploadData = await uploadRes.json();
      const fileUrl = uploadData.file?.url || '';

      setMessages(prev => prev.map(m => m._id === tempId ? { ...m, attachments: [{ url: fileUrl, type: 'document', name: asset.name || 'file' }] } : m));

      const socket = socketService.getSocket();
      if (socket?.connected) {
        const messageData = { content: asset.name || 'File', type: 'file', attachments: [{ url: fileUrl, type: 'document', name: asset.name || 'file' }] };
        type === 'group'
          ? socket.emit('send_group_message', { groupId: id, ...messageData })
          : socket.emit('send_private_message', { receiverId: id, ...messageData });
      }
    } catch (e) {
      console.error('Upload file error:', e);
      setMessages(prev => prev.filter(m => m._id !== tempId));
      Alert.alert('Lỗi', 'Không thể gửi file!');
    } finally { setUploadingFile(false); }
  };

  // ─── Message actions ─────────────────────────────────────────────────────────
  // ✅ Cho phép long press cả tin nhắn của mình lẫn người khác
  // — tin nhắn của mình: thu hồi, ghim, xóa
  // — tin nhắn người khác: chỉ ghim
  const handleLongPressMessage = (message: Message) => {
    if (message._id.startsWith('temp_')) return;
    if (message.isRevoked) return;
    if (message.type === 'system') return; // ← không cho long press system message
    setSelectedMessage(message);
    setShowMessageOptions(true);
  };

  const deleteMessage = async () => {
    if (!selectedMessage) return;
    setShowMessageOptions(false);
    try {
      const token = await getToken();
      const res = await fetch(`${BASE_URL}/api/chat/${selectedMessage._id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setMessages(prev => prev.filter(m => m._id !== selectedMessage._id));
      else Alert.alert('Lỗi', 'Không thể xóa tin nhắn!');
    } catch (e) { Alert.alert('Lỗi', 'Không thể xóa tin nhắn!'); }
    finally { setSelectedMessage(null); }
  };

  // ✅ FIX: Thu hồi đúng — đổi type về 'text', xóa attachments
  const revokeMessage = async () => {
    if (!selectedMessage) return;
    setShowMessageOptions(false);
    try {
      const token = await getToken();
      const res = await fetch(`${BASE_URL}/api/chat/${selectedMessage._id}/revoke`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        setMessages(prev => prev.map(msg =>
          msg._id === selectedMessage._id
            ? { ...msg, content: 'Tin nhắn đã được thu hồi', isRevoked: true, type: 'text', attachments: [] }
            : msg
        ));
        const socket = socketService.getSocket();
        if (socket) {
          socket.emit('revoke_message', {
            messageId: selectedMessage._id,
            receiverId: type === 'private' ? id : undefined,
            groupId: type === 'group' ? id : undefined,
          });
        }
      } else Alert.alert('Lỗi', 'Không thể thu hồi tin nhắn');
    } catch (error) { console.error('Revoke error:', error); }
    finally { setSelectedMessage(null); }
  };

  // ✅ Ghim — cập nhật banner + messages
  const pinMessage = async () => {
    if (!selectedMessage) return;
    setShowMessageOptions(false);
    try {
      const token = await getToken();
      const res = await fetch(`${BASE_URL}/api/chat/${selectedMessage._id}/pin`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pinned: !selectedMessage.pinned }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessages(prev => {
          const updated = prev.map(msg => msg._id === selectedMessage._id ? { ...msg, pinned: data.pinned, pinnedAt: data.pinnedAt } : msg);
          if (data.pinned) {
            setPinnedMessage({ ...selectedMessage, pinned: true, pinnedAt: data.pinnedAt });
          } else {
            const remaining = updated.filter(m => m.pinned).sort((a, b) => new Date(b.pinnedAt || 0).getTime() - new Date(a.pinnedAt || 0).getTime());
            setPinnedMessage(remaining[0] || null);
          }
          return updated;
        });
        const socket = socketService.getSocket();
        if (socket) {
          socket.emit('message_pinned', {
            messageId: selectedMessage._id, pinned: data.pinned,
            receiverId: type === 'private' ? id : undefined,
            groupId: type === 'group' ? id : undefined,
          });
        }
      } else Alert.alert('Lỗi', data.error || 'Không thể ghim tin nhắn');
    } catch (error) { console.error('Pin error:', error); }
    finally { setSelectedMessage(null); }
  };

  // ─── Call ────────────────────────────────────────────────────────────────────
  const startCall = async () => {
    if (type === 'group') {
      // Nhóm → vào thẳng Agora (không cần chờ)
      const channelName = `group_${id}`;
      const socket = socketService.getSocket();
      if (!socket) { Alert.alert('Lỗi', 'Không thể kết nối socket.'); return; }
      socket.emit('group_call_offer', { groupId: id, channelName, callerName: currentUser?.name, callerAvatar: currentUser?.avatar });
      router.push({ pathname: '/call/[channelName]', params: { channelName, targetId: id, isGroup: 'true' } });
    } else {
      // 1-1 → qua màn hình chờ trước
      const channelName = `private_${currentUser?._id}_${id}`;
      const socket = socketService.getSocket();
      if (!socket) { Alert.alert('Lỗi', 'Không thể kết nối socket.'); return; }

      // Emit call_offer
      socket.emit('call_offer', {
        to: id,
        channelName,
        callerName: currentUser?.name,
        callerAvatar: currentUser?.avatar,
        type: 'video',
      });

      // Navigate sang màn hình chờ
      router.push({
        pathname: '/call/waiting',
        params: {
          channelName,
          targetId: id,
          targetName: userInfo?.name || '',
          targetAvatar: userInfo?.avatar || '',
          isGroup: 'false',
        },
      });
    }
  };

  // ─── Render helpers ──────────────────────────────────────────────────────────
  const insertEmoji = (emoji: string) => setInputText(prev => prev + emoji);

  const renderEmojiPicker = () => (
    <View style={[styles.emojiPicker, { backgroundColor: colors.background, borderTopColor: colors.borderColor }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.emojiCategoryTabs}>
        {EMOJI_CATEGORIES.map((cat, i) => (
          <TouchableOpacity key={i} onPress={() => setEmojiCategoryIndex(i)}
            style={[styles.emojiCategoryTab, emojiCategoryIndex === i && { borderBottomColor: colors.tint, borderBottomWidth: 2 }]}>
            <Text style={{ fontSize: 20 }}>{cat.icon}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <FlatList
        data={EMOJI_CATEGORIES[emojiCategoryIndex].emojis}
        keyExtractor={(_, i) => `e_${i}`}
        numColumns={8}
        style={{ flex: 1, paddingHorizontal: 8 }}
        renderItem={({ item: emoji }) => (
          <TouchableOpacity style={styles.emojiItem} onPress={() => insertEmoji(emoji)}>
            <Text style={{ fontSize: 26 }}>{emoji}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );

  const renderAttachMenu = () => (
    <View style={[styles.attachMenu, { backgroundColor: colors.background, borderTopColor: colors.borderColor }]}>
      <TouchableOpacity style={styles.attachMenuItem} onPress={pickAndSendImage} disabled={uploadingImage}>
        {uploadingImage ? <ActivityIndicator size={28} color="#4CAF50" /> :
          <View style={[styles.attachMenuIcon, { backgroundColor: '#4CAF50' + '20' }]}>
            <Ionicons name="image-outline" size={28} color="#4CAF50" />
          </View>}
        <Text style={[styles.attachMenuLabel, { color: colors.text }]}>Ảnh</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.attachMenuItem} onPress={pickAndSendFile} disabled={uploadingFile}>
        {uploadingFile ? <ActivityIndicator size={28} color="#2196F3" /> :
          <View style={[styles.attachMenuIcon, { backgroundColor: '#2196F3' + '20' }]}>
            <Ionicons name="document-outline" size={28} color="#2196F3" />
          </View>}
        <Text style={[styles.attachMenuLabel, { color: colors.text }]}>File</Text>
      </TouchableOpacity>
      {type === 'group' && (
        <TouchableOpacity style={styles.attachMenuItem} onPress={() => { setShowAttachMenu(false); setShowPollModal(true); }}>
          <View style={[styles.attachMenuIcon, { backgroundColor: '#9C27B020' }]}>
            <Ionicons name="bar-chart-outline" size={28} color="#9C27B0" />
          </View>
          <Text style={[styles.attachMenuLabel, { color: colors.text }]}>Bình chọn</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const formatTime = (dateString: string) =>
    new Date(dateString).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

 const unpinFromBanner = async (message: Message) => {
  try {
    const token = await getToken();
    const res = await fetch(`${BASE_URL}/api/chat/${message._id}/pin`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ pinned: false }),
    });
    if (res.ok) {
      // ✅ Bỏ ghim tất cả — set null luôn, không tìm tin nhắn ghim khác
      setMessages(prev => prev.map(msg =>
        msg._id === message._id ? { ...msg, pinned: false, pinnedAt: undefined } : msg
      ));
      setPinnedMessage(null); // ← chỉ cần dòng này, bỏ phần tìm remaining
      const socket = socketService.getSocket();
      socket?.emit('message_pinned', {
        messageId: message._id, pinned: false,
        receiverId: type === 'private' ? id : undefined,
        groupId: type === 'group' ? id : undefined,
      });
    }
  } catch (error) { console.error('Unpin error:', error); }
};


  // ✅ Banner tin nhắn ghim — giống Zalo/Messenger
  const renderPinnedBanner = () => {
    if (!pinnedMessage) return null;
    const isRevoked = pinnedMessage.isRevoked;
    const preview = isRevoked
      ? 'Tin nhắn đã được thu hồi'
      : pinnedMessage.type === 'image' ? '📷 Ảnh'
      : pinnedMessage.type === 'file' ? '📎 ' + (pinnedMessage.attachments?.[0]?.name || 'File')
      : pinnedMessage.content;

    return (
      <TouchableOpacity
        style={[styles.pinnedBanner, { backgroundColor: colors.background, borderBottomColor: colors.borderColor }]}
        onPress={() => {
          // Scroll đến tin nhắn ghim
          const idx = messages.findIndex(m => m._id === pinnedMessage._id);
          if (idx !== -1) flatListRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5 });
        }}
        activeOpacity={0.8}
      >
        <View style={[styles.pinnedAccent, { backgroundColor: colors.tint }]} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.pinnedLabel, { color: colors.tint }]}>📌 Tin nhắn đã ghim</Text>
          <Text style={[styles.pinnedPreview, { color: colors.text }]} numberOfLines={1}>{preview}</Text>
        </View>
        <TouchableOpacity
         onPress={() => unpinFromBanner(pinnedMessage)}
          hitSlop={8}
        >
          <Ionicons name="close" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  // ✅ FIX renderMessage — wrap toàn bộ (kể cả ảnh) trong TouchableOpacity có onLongPress
  const renderMessage = ({ item, index }: { item: Message; index: number }) => {

    // ── System message (cuộc gọi) — hiện giữa màn hình giống Zalo ──────────────
    if (item.type === 'system') {
      return (
        <View style={styles.systemMessageRow}>
          <View style={[styles.systemMessageBubble, { backgroundColor: colors.backgroundElement }]}>
            <Text style={[styles.systemMessageText, { color: colors.textSecondary }]}>
              {item.content}
            </Text>
            <Text style={[styles.systemMessageTime, { color: colors.textSecondary }]}>
              {formatTime(item.createdAt)}
            </Text>
          </View>
        </View>
      );
    }

    // ── Poll bubble ──────────────────────────────────────────────────────────────
    if (item.type === 'poll' && item.metadata?.poll) {
      const poll = item.metadata.poll;
      const totalVotes = poll.votes.length;
      const myVote = poll.votes.find(v => v.user === currentUser?._id);

      return (
        <View style={styles.pollRow}>
          <View style={[styles.pollBubble, { backgroundColor: colors.backgroundElement, borderColor: colors.tint + '30' }]}>
            {/* Header */}
            <View style={styles.pollHeader}>
              <Ionicons name="bar-chart-outline" size={16} color={colors.tint} />
              <Text style={[styles.pollLabel, { color: colors.tint }]}>BÌNH CHỌN</Text>
              <Text style={[styles.pollSender, { color: colors.textSecondary }]}>· {item.sender.name}</Text>
            </View>
            <Text style={[styles.pollQuestion, { color: colors.text }]}>{item.content}</Text>

            {/* Options */}
            {poll.options.map((option, idx) => {
              const voteCount = poll.votes.filter(v => v.option === idx).length;
              const percent = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
              const isMyChoice = myVote?.option === idx;

              return (
                <TouchableOpacity
                  key={idx}
                  style={[styles.pollOption, { borderColor: isMyChoice ? colors.tint : colors.borderColor }]}
                  onPress={() => votePoll(item._id, idx)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.pollProgressBar, { width: `${percent}%` as any, backgroundColor: colors.tint + '25' }]} />
                  <View style={styles.pollOptionContent}>
                    <View style={styles.pollOptionLeft}>
                      {isMyChoice
                        ? <Ionicons name="checkmark-circle" size={18} color={colors.tint} />
                        : <View style={[styles.pollCircle, { borderColor: colors.borderColor }]} />}
                      <Text style={[styles.pollOptionText, { color: colors.text, fontWeight: isMyChoice ? '700' : '400' }]}>{option}</Text>
                    </View>
                    <Text style={[styles.pollVoteCount, { color: colors.textSecondary }]}>{percent}%</Text>
                  </View>
                </TouchableOpacity>
              );
            })}

            {/* Footer */}
            <Text style={[styles.pollFooter, { color: colors.textSecondary }]}>
              {totalVotes} người đã bình chọn · {formatTime(item.createdAt)}
            </Text>
          </View>
        </View>
      );
    }
    const isMyMessage = item.sender._id === currentUser?._id;
    const isEndOfSequence = index === messages.length - 1 || messages[index + 1]?.sender._id !== item.sender._id;
    const showAvatar = !isMyMessage && isEndOfSequence;
    const isReadByOther = item.readBy.some(uid => uid !== currentUser?._id);
    const isTemp = item._id.startsWith('temp_');
    const imageAttachment = !item.isRevoked && item.type === 'image' ? item.attachments?.[0] : null;
    const fileAttachment = !item.isRevoked && item.type === 'file' ? item.attachments?.[0] : null;

    const avatarEl = !isMyMessage ? (
      <View style={styles.avatarContainer}>
        {showAvatar ? (
          item.sender.avatar
            ? <Image source={{ uri: item.sender.avatar }} style={styles.avatar} />
            : <View style={[styles.avatar, { backgroundColor: colors.tint + '20' }]}>
                <Text style={[styles.avatarText, { color: colors.tint }]}>{item.sender.name.charAt(0).toUpperCase()}</Text>
              </View>
        ) : <View style={styles.avatarPlaceholder} />}
      </View>
    ) : null;

    const bubbleContent = item.isRevoked ? (
      <Text style={[styles.messageText, { color: isMyMessage ? 'rgba(255,255,255,0.7)' : colors.textSecondary, fontStyle: 'italic' }]}>
        🚫 Tin nhắn đã được thu hồi
      </Text>
    ) : imageAttachment ? (
      // ✅ FIX: onPress mở ảnh, onLongPress mở options — tách biệt hoàn toàn
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => imageAttachment.url && setSelectedImage(imageAttachment.url)}
        onLongPress={() => handleLongPressMessage(item)}
        delayLongPress={400}
      >
        <Image source={{ uri: imageAttachment.url }} style={styles.messageImage} resizeMode="cover" />
        {isTemp && uploadingImage && (
          <View style={styles.mediaOverlay}><ActivityIndicator color="#fff" /></View>
        )}
      </TouchableOpacity>
    ) : fileAttachment ? (
      <TouchableOpacity
        style={styles.fileBubble}
        onPress={() => fileAttachment.url && Linking.openURL(fileAttachment.url)}
        disabled={!fileAttachment.url}
      >
        <View style={[styles.fileIcon, { backgroundColor: isMyMessage ? 'rgba(255,255,255,0.2)' : colors.tint + '20' }]}>
          <Ionicons name="document-outline" size={24} color={isMyMessage ? '#fff' : colors.tint} />
        </View>
        <View style={styles.fileInfo}>
          <Text style={[styles.fileName, { color: isMyMessage ? '#fff' : colors.text }]} numberOfLines={2}>{fileAttachment.name}</Text>
          {!fileAttachment.url && isTemp && (
            <Text style={{ color: isMyMessage ? 'rgba(255,255,255,0.6)' : colors.textSecondary, fontSize: 11 }}>Đang tải lên...</Text>
          )}
        </View>
        {!fileAttachment.url && isTemp
          ? <ActivityIndicator size={16} color={isMyMessage ? '#fff' : colors.tint} />
          : <Ionicons name="download-outline" size={20} color={isMyMessage ? 'rgba(255,255,255,0.8)' : colors.tint} />}
      </TouchableOpacity>
    ) : (
      <Text style={[styles.messageText, { color: isMyMessage ? '#fff' : colors.text }]}>{item.content}</Text>
    );

    // Ảnh không cần bubble background, text/file thì cần
    const isImageMsg = !!imageAttachment && !item.isRevoked;

    return (
      <TouchableOpacity
        activeOpacity={imageAttachment ? 1 : 0.85} // ảnh xử lý press bên trong
        onLongPress={() => !imageAttachment && handleLongPressMessage(item)}
        delayLongPress={400}
      >
        <View style={[styles.messageRow, isMyMessage ? styles.myMessageRow : styles.otherMessageRow]}>
          {avatarEl}
          <View style={[
            isImageMsg ? styles.imageBubble : styles.messageBubble,
            isMyMessage ? styles.myMessage : styles.otherMessage,
            !isImageMsg && { backgroundColor: item.isRevoked
              ? (isMyMessage ? colors.tint + '60' : colors.backgroundElement)
              : (isMyMessage ? colors.tint : colors.backgroundElement) },
          ]}>
            {bubbleContent}

            {/* Footer giờ overlay lên ảnh giống Zalo */}
            {isImageMsg ? (
              <View style={styles.imageFooterOverlay}>
                <Text style={styles.imageFooterTime}>{formatTime(item.createdAt)}</Text>
                {isMyMessage && !isTemp && type !== 'group' && (
                  <Ionicons name={isReadByOther ? 'checkmark-done' : 'checkmark'} size={14} color="rgba(255,255,255,0.9)" />
                )}
              </View>
            ) : (
              <View style={styles.messageFooter}>
                <Text style={[styles.messageTime, { color: isMyMessage ? 'rgba(255,255,255,0.6)' : colors.textSecondary }]}>
                  {formatTime(item.createdAt)}
                </Text>
                {isMyMessage && !isTemp && !item.isRevoked && type !== 'group' && (
                  <Ionicons name={isReadByOther ? 'checkmark-done' : 'checkmark'} size={16}
                    color={isReadByOther ? '#4FC3F7' : 'rgba(255,255,255,0.6)'} />
                )}
                {isTemp && <ActivityIndicator size={12} color="rgba(255,255,255,0.6)" />}
                {item.pinned && !item.isRevoked && (
                  <Ionicons name="pin" size={12} color={isMyMessage ? 'rgba(255,255,255,0.6)' : colors.textSecondary} />
                )}
              </View>
            )}
          </View>

          {/* ── Thread badge ── */}
          {threadCounts[item._id] > 0 && !item.isRevoked && type === 'group' && (
            <TouchableOpacity
              style={[styles.threadBadge, {
                backgroundColor: colors.tint + '18',
                borderColor: colors.tint + '40',
                alignSelf: isMyMessage ? 'flex-end' : 'flex-start',
              }]}
              onPress={() => openThread(item._id)}
              activeOpacity={0.8}
            >
              <Ionicons name="chatbubbles-outline" size={13} color={colors.tint} />
              <Text style={[styles.threadBadgeText, { color: colors.tint }]}>
                {threadCounts[item._id]} phản hồi
              </Text>
              <Ionicons name="chevron-forward" size={13} color={colors.tint} />
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderImageViewer = () => (
    <Modal visible={!!selectedImage} transparent animationType="fade" onRequestClose={() => setSelectedImage(null)}>
      <View style={styles.imageViewerContainer}>
        <TouchableWithoutFeedback onPress={() => setSelectedImage(null)}>
          <View style={styles.imageViewerBg} />
        </TouchableWithoutFeedback>
        <TouchableOpacity style={styles.imageViewerClose} onPress={() => setSelectedImage(null)}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
        {selectedImage && <Image source={{ uri: selectedImage }} style={styles.imageViewerImage} resizeMode="contain" />}
        {selectedImage && (
          <TouchableOpacity style={styles.imageViewerDownload} onPress={() => Linking.openURL(selectedImage!)}>
            <Ionicons name="download-outline" size={24} color="#fff" />
            <Text style={styles.imageViewerDownloadText}>Tải xuống</Text>
          </TouchableOpacity>
        )}
      </View>
    </Modal>
  );

  const renderMessageOptions = () => {
    const isMyMsg = selectedMessage?.sender._id === currentUser?._id;
    return (
    <Modal visible={showMessageOptions} transparent animationType="slide" onRequestClose={() => setShowMessageOptions(false)}>
      <TouchableWithoutFeedback onPress={() => setShowMessageOptions(false)}>
        <View style={styles.optionsOverlay}>
          <TouchableWithoutFeedback>
            <View style={[styles.optionsContainer, { backgroundColor: colors.background }]}>
              <Text style={[styles.optionsTitle, { color: colors.textSecondary }]}>Tùy chọn tin nhắn</Text>

              {/* Tạo thread — chỉ trong group */}
              {type === 'group' && !selectedMessage?.isRevoked && (
                <TouchableOpacity style={styles.optionItem} onPress={() => {
                  setShowMessageOptions(false);
                  if (selectedMessage) openThread(selectedMessage._id);
                  setSelectedMessage(null);
                }}>
                  <View style={[styles.optionIcon, { backgroundColor: colors.tint + '20' }]}>
                    <Ionicons name="chatbubbles-outline" size={20} color={colors.tint} />
                  </View>
                  <Text style={[styles.optionText, { color: colors.tint }]}>
                    {threadCounts[selectedMessage?._id || ''] ? 'Mở thread' : 'Tạo thread'}
                  </Text>
                </TouchableOpacity>
              )}

              {/* Ghim — ai cũng ghim được */}
              {!selectedMessage?.isRevoked && (
                <TouchableOpacity style={styles.optionItem} onPress={pinMessage}>
                  <View style={[styles.optionIcon, { backgroundColor: '#2196F3' + '20' }]}>
                    <Ionicons name="pin" size={20} color="#2196F3" />
                  </View>
                  <Text style={[styles.optionText, { color: '#2196F3' }]}>
                    {selectedMessage?.pinned ? 'Bỏ ghim tin nhắn' : 'Ghim tin nhắn'}
                  </Text>
                </TouchableOpacity>
              )}

              {/* Thu hồi — chỉ tin nhắn của mình */}
              {isMyMsg && !selectedMessage?.isRevoked && (
                <TouchableOpacity style={styles.optionItem} onPress={revokeMessage}>
                  <View style={[styles.optionIcon, { backgroundColor: '#FF9800' + '20' }]}>
                    <Ionicons name="arrow-undo-outline" size={20} color="#FF9800" />
                  </View>
                  <Text style={[styles.optionText, { color: '#FF9800' }]}>Thu hồi tin nhắn</Text>
                </TouchableOpacity>
              )}

              {/* Xóa — chỉ tin nhắn của mình */}
              {isMyMsg && (
                <TouchableOpacity style={styles.optionItem} onPress={() => {
                  setShowMessageOptions(false);
                  Alert.alert('Xóa tin nhắn', 'Bạn có chắc muốn xóa tin nhắn này?', [
                    { text: 'Hủy', style: 'cancel' },
                    { text: 'Xóa', style: 'destructive', onPress: deleteMessage },
                  ]);
                }}>
                  <View style={[styles.optionIcon, { backgroundColor: '#F44336' + '20' }]}>
                    <Ionicons name="trash-outline" size={20} color="#F44336" />
                  </View>
                  <Text style={[styles.optionText, { color: '#F44336' }]}>Xóa tin nhắn</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.optionItem} onPress={() => setShowMessageOptions(false)}>
                <View style={[styles.optionIcon, { backgroundColor: colors.backgroundElement }]}>
                  <Ionicons name="close-outline" size={20} color={colors.text} />
                </View>
                <Text style={[styles.optionText, { color: colors.text }]}>Hủy</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  const headerTitle = type === 'group' ? groupInfo?.name : userInfo?.name;
  const headerSubtitle = type === 'group'
    ? `${groupInfo?.membersCount} thành viên`
    : (otherUserTyping ? 'Đang gõ...' : (userInfo?.status === 'online' ? 'Đang hoạt động' : 'Ngoại tuyến'));

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} />
        {renderImageViewer()}
        {renderMessageOptions()}

        {/* ── Thread Panel ── */}
        <Modal visible={showThread} animationType="slide" transparent onRequestClose={() => setShowThread(false)}>
          <View style={styles.threadOverlay}>
            <TouchableOpacity style={styles.threadBackdrop} onPress={() => setShowThread(false)} />
            <View style={[styles.threadPanel, { backgroundColor: colors.background }]}>
              {/* Thread Header */}
              <View style={[styles.threadHeader, { borderBottomColor: colors.borderColor }]}>
                <Text style={[styles.threadHeaderTitle, { color: colors.text }]}>Thread</Text>
                <TouchableOpacity onPress={() => setShowThread(false)}>
                  <Ionicons name="close" size={22} color={colors.text} />
                </TouchableOpacity>
              </View>

              {/* Tin nhắn gốc */}
              {threadParent && (
                <View style={[styles.threadParentBox, { backgroundColor: colors.backgroundElement, borderLeftColor: colors.tint }]}>
                  <Text style={[styles.threadParentName, { color: colors.tint }]}>{threadParent.sender?.name}</Text>
                  <Text style={[styles.threadParentContent, { color: colors.text }]} numberOfLines={3}>{threadParent.content}</Text>
                </View>
              )}

              {/* Danh sách reply */}
              <FlatList
                ref={threadListRef}
                data={threadMessages}
                keyExtractor={m => m._id}
                style={{ flex: 1 }}
                contentContainerStyle={{ padding: 12, gap: 8 }}
                ListEmptyComponent={
                  <Text style={[styles.threadEmpty, { color: colors.textSecondary }]}>Chưa có phản hồi nào. Hãy là người đầu tiên!</Text>
                }
                renderItem={({ item }) => {
                  const isMine = item.sender._id === currentUser?._id;
                  return (
                    <View style={[styles.threadMsgRow, isMine && styles.threadMsgRowMine]}>
                      {!isMine && (
                        item.sender.avatar
                          ? <Image source={{ uri: item.sender.avatar }} style={styles.threadAvatar} />
                          : <View style={[styles.threadAvatar, { backgroundColor: colors.tint + '20', justifyContent: 'center', alignItems: 'center' }]}>
                              <Text style={{ color: colors.tint, fontWeight: '700', fontSize: 14 }}>{item.sender.name.charAt(0).toUpperCase()}</Text>
                            </View>
                      )}
                      <View style={{ flex: 1 }}>
                        {!isMine && <Text style={[styles.threadMsgName, { color: colors.tint }]}>{item.sender.name}</Text>}
                        <View style={[
                          styles.threadMsgBubble,
                          { backgroundColor: isMine ? colors.tint : colors.backgroundElement, alignSelf: isMine ? 'flex-end' : 'flex-start' }
                        ]}>
                          <Text style={[styles.threadMsgText, { color: isMine ? '#fff' : colors.text }]}>{item.content}</Text>
                          <Text style={[styles.threadMsgTime, { color: isMine ? 'rgba(255,255,255,0.6)' : colors.textSecondary }]}>{formatTime(item.createdAt)}</Text>
                        </View>
                      </View>
                    </View>
                  );
                }}
              />

              {/* Input thread */}
              <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={20}>
                <View style={[styles.threadInputBar, { borderTopColor: colors.borderColor, backgroundColor: colors.background }]}>
                  <TextInput
                    style={[styles.threadInput, { backgroundColor: colors.backgroundElement, color: colors.text }]}
                    placeholder="Phản hồi trong thread..."
                    placeholderTextColor={colors.textSecondary}
                    value={threadInput}
                    onChangeText={setThreadInput}
                    multiline
                  />
                  <TouchableOpacity
                    style={[styles.threadSendBtn, { backgroundColor: threadInput.trim() ? colors.tint : colors.backgroundElement }]}
                    onPress={sendThreadMessage}
                    disabled={!threadInput.trim() || sendingThread}
                  >
                    {sendingThread
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Ionicons name="send" size={18} color={threadInput.trim() ? '#fff' : colors.textSecondary} />
                    }
                  </TouchableOpacity>
                </View>
              </KeyboardAvoidingView>
            </View>
          </View>
        </Modal>

        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.borderColor }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.userInfo}
            onPress={() => { type === 'group' ? router.push(`/group/${id}` as any) : router.push(`/chat/info/${id}` as any); }}
            activeOpacity={0.7}
          >
            <View style={styles.userAvatar}>
              {type === 'group' ? (
                groupInfo?.avatar
                  ? <Image source={{ uri: groupInfo.avatar }} style={styles.headerAvatar} />
                  : <View style={[styles.headerAvatar, { backgroundColor: colors.tint + '20' }]}><Ionicons name="people" size={24} color={colors.tint} /></View>
              ) : (
                userInfo?.avatar
                  ? <Image source={{ uri: userInfo.avatar }} style={styles.headerAvatar} />
                  : <View style={[styles.headerAvatar, { backgroundColor: colors.tint + '20' }]}>
                      <Text style={[styles.headerAvatarText, { color: colors.tint }]}>{userInfo?.name?.charAt(0).toUpperCase()}</Text>
                    </View>
              )}
            </View>
            <View>
              <Text style={[styles.userName, { color: colors.text }]} numberOfLines={1}>{headerTitle || (type === 'group' ? 'Nhóm' : 'Người dùng')}</Text>
              <Text style={[styles.userStatus, { color: otherUserTyping && type !== 'group' ? colors.tint : colors.textSecondary }]}>{headerSubtitle}</Text>
            </View>
          </TouchableOpacity>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.headerButton} onPress={startCall}>
              <Ionicons name="call-outline" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ✅ Banner ghim — hiện ngay dưới header giống Zalo/Messenger */}
        {renderPinnedBanner()}

        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={item => item._id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messagesList}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
          showsVerticalScrollIndicator={false}
          onViewableItemsChanged={onViewableItemsChanged.current}
          viewabilityConfig={viewabilityConfig.current}
          onScrollBeginDrag={() => { setShowEmojiPicker(false); setShowAttachMenu(false); }}
        />

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
          <View style={[styles.inputContainer, { backgroundColor: colors.background, borderTopColor: colors.borderColor }]}>
            <TouchableOpacity style={styles.attachButton} onPress={() => { setShowAttachMenu(prev => !prev); setShowEmojiPicker(false); }}>
              <Ionicons name={showAttachMenu ? 'close' : 'attach'} size={24} color={showAttachMenu ? colors.tint : colors.textSecondary} />
            </TouchableOpacity>
            <TextInput
              style={[styles.input, { backgroundColor: colors.backgroundElement, color: colors.text }]}
              placeholder="Nhập tin nhắn..."
              placeholderTextColor={colors.textSecondary}
              value={inputText}
              onChangeText={handleTyping}
              multiline
              onFocus={() => { setShowEmojiPicker(false); setShowAttachMenu(false); }}
            />
            {inputText.trim() ? (
              <TouchableOpacity style={[styles.sendButton, { backgroundColor: colors.tint }]} onPress={sendMessage} disabled={sending}>
                <Ionicons name="send" size={20} color="#fff" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={{ padding: 8 }} onPress={() => { setShowEmojiPicker(prev => !prev); setShowAttachMenu(false); }}>
                <Text style={{ fontSize: 24 }}>{showEmojiPicker ? '⌨️' : '😊'}</Text>
              </TouchableOpacity>
            )}
          </View>
          {showAttachMenu && renderAttachMenu()}
          {showEmojiPicker && renderEmojiPicker()}
        </KeyboardAvoidingView>

        {/* ── Poll Modal ── */}
        <Modal visible={showPollModal} transparent animationType="slide" onRequestClose={() => setShowPollModal(false)}>
          <TouchableWithoutFeedback onPress={() => setShowPollModal(false)}>
            <View style={styles.pollModalOverlay}>
              <TouchableWithoutFeedback>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'position' : 'height'} keyboardVerticalOffset={0}>
                  <View style={[styles.pollModalBox, { backgroundColor: colors.background }]}>
                  <View style={styles.pollModalHeader}>
                    <Text style={[styles.pollModalTitle, { color: colors.text }]}>🗳️ Tạo bình chọn</Text>
                    <TouchableOpacity onPress={() => setShowPollModal(false)}>
                      <Ionicons name="close" size={22} color={colors.text} />
                    </TouchableOpacity>
                  </View>

                  {/* Câu hỏi */}
                  <TextInput
                    style={[styles.pollModalInput, { backgroundColor: colors.backgroundElement, color: colors.text }]}
                    placeholder="Câu hỏi bình chọn..."
                    placeholderTextColor={colors.textSecondary}
                    value={pollQuestion}
                    onChangeText={setPollQuestion}
                    maxLength={100}
                  />

                  {/* Các lựa chọn */}
                  <Text style={[styles.pollModalSectionTitle, { color: colors.textSecondary }]}>Lựa chọn</Text>
                  {pollOptions.map((opt, idx) => (
                    <View key={idx} style={styles.pollOptionRow}>
                      <TextInput
                        style={[styles.pollModalInput, { flex: 1, backgroundColor: colors.backgroundElement, color: colors.text }]}
                        placeholder={`Lựa chọn ${idx + 1}`}
                        placeholderTextColor={colors.textSecondary}
                        value={opt}
                        onChangeText={text => {
                          const newOpts = [...pollOptions];
                          newOpts[idx] = text;
                          setPollOptions(newOpts);
                        }}
                        maxLength={50}
                      />
                      {pollOptions.length > 2 && (
                        <TouchableOpacity onPress={() => setPollOptions(prev => prev.filter((_, i) => i !== idx))} style={{ padding: 8 }}>
                          <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}

                  {/* Thêm lựa chọn */}
                  {pollOptions.length < 5 && (
                    <TouchableOpacity style={styles.pollAddOption} onPress={() => setPollOptions(prev => [...prev, ''])}>
                      <Ionicons name="add-circle-outline" size={20} color={colors.tint} />
                      <Text style={[styles.pollAddOptionText, { color: colors.tint }]}>Thêm lựa chọn</Text>
                    </TouchableOpacity>
                  )}

                  {/* Nút tạo */}
                  <TouchableOpacity
                    style={[styles.pollCreateBtn, { backgroundColor: colors.tint }]}
                    onPress={createPoll}
                    disabled={creatingPoll}
                  >
                    {creatingPoll
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={styles.pollCreateBtnText}>Tạo bình chọn</Text>}
                  </TouchableOpacity>
                </View>
                </KeyboardAvoidingView>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>

      </SafeAreaView>
    </>
  );
};

export default ChatDetailScreen;

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContent: { justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1 },
  backButton: { padding: 8 },
  userInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: 8, gap: 12 },
  userAvatar: { marginRight: 0 },
  headerAvatar: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  headerAvatarText: { fontSize: 18, fontWeight: 'bold' },
  userName: { fontSize: 16, fontWeight: '600' },
  userStatus: { fontSize: 12 },
  headerActions: { flexDirection: 'row' },
  headerButton: { padding: 8 },

  // ✅ Banner ghim
  pinnedBanner: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth, gap: 10,
  },
  pinnedAccent: { width: 3, height: 36, borderRadius: 2 },
  pinnedLabel: { fontSize: 11, fontWeight: '600', marginBottom: 2 },
  pinnedPreview: { fontSize: 13 },

  messagesList: { paddingHorizontal: 12, paddingVertical: 16 },
  // ── Thread badge ──
  threadBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 12, borderWidth: 1,
    marginTop: 4, alignSelf: 'flex-start',
  },
  threadBadgeText: { fontSize: 12, fontWeight: '500' },
  // ── System message ──
  systemMessageRow: { alignItems: 'center', marginVertical: 8 },
  systemMessageBubble: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16 },
  systemMessageText: { fontSize: 13 },
  systemMessageTime: { fontSize: 11, opacity: 0.7 },
  messageRow: { flexDirection: 'row', marginBottom: 8 },
  myMessageRow: { justifyContent: 'flex-end' },
  otherMessageRow: { justifyContent: 'flex-start' },
  avatarContainer: { width: 36, height: 36, marginRight: 8, alignSelf: 'flex-end' },
  avatar: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 16, fontWeight: 'bold' },
  avatarPlaceholder: { width: 44 },
  messageBubble: { maxWidth: '70%', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18 },
  // ✅ Bubble ảnh: không background, không padding — ảnh chiếm toàn bộ
  imageBubble: { maxWidth: '70%', borderRadius: 14, overflow: 'hidden' },
  // ✅ Giờ và tick overlay lên góc dưới ảnh giống Zalo
  imageFooterOverlay: {
    position: 'absolute', bottom: 6, right: 8,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 10,
    paddingHorizontal: 5, paddingVertical: 2,
  },
  imageFooterTime: { fontSize: 10, color: '#fff' },
  myMessage: { borderBottomRightRadius: 4 },
  otherMessage: { borderBottomLeftRadius: 4 },
  mediaBubble: { padding: 4, paddingBottom: 8 },
  messageImage: { width: 200, height: 200, borderRadius: 14 },
  mediaOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 14, justifyContent: 'center', alignItems: 'center',
  },
  fileBubble: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 4, minWidth: 180 },
  fileIcon: { width: 44, height: 44, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  fileInfo: { flex: 1 },
  fileName: { fontSize: 13, fontWeight: '500' },
  messageText: { fontSize: 15, lineHeight: 20 },
  messageFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4, gap: 4 },
  messageTime: { fontSize: 10 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1 },
  attachButton: { padding: 8 },
  input: { flex: 1, maxHeight: 100, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, fontSize: 15, marginHorizontal: 8 },
  sendButton: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  attachMenu: { flexDirection: 'row', paddingHorizontal: 24, paddingVertical: 16, borderTopWidth: StyleSheet.hairlineWidth, gap: 32 },
  attachMenuItem: { alignItems: 'center', gap: 8 },
  attachMenuIcon: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  attachMenuLabel: { fontSize: 12 },
  emojiPicker: { borderTopWidth: StyleSheet.hairlineWidth, height: 280 },
  emojiCategoryTabs: { flexGrow: 0, paddingHorizontal: 8, paddingVertical: 4 },
  emojiCategoryTab: { paddingHorizontal: 12, paddingVertical: 8, marginRight: 4 },
  emojiItem: { flex: 1, aspectRatio: 1, justifyContent: 'center', alignItems: 'center' },
  imageViewerContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  imageViewerBg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  imageViewerClose: { position: 'absolute', top: 50, right: 20, zIndex: 10, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  imageViewerImage: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT * 0.75 },
  imageViewerDownload: { position: 'absolute', bottom: 50, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  imageViewerDownloadText: { color: '#fff', fontSize: 15, fontWeight: '500' },
  optionsOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  optionsContainer: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 12, paddingBottom: 34, paddingHorizontal: 16 },
  optionsTitle: { fontSize: 13, textAlign: 'center', marginBottom: 16 },
  optionItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  optionIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  optionText: { fontSize: 16, fontWeight: '500' },

  // ── Thread styles ──
  threadOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  threadBackdrop: { flex: 1 },
  threadPanel: { height: '75%', borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  threadHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  threadHeaderTitle: { fontSize: 16, fontWeight: '700' },
  threadEmpty: { textAlign: 'center', marginTop: 32, fontSize: 14 },
  threadParentBox: {
    margin: 12, padding: 12, borderRadius: 12, borderLeftWidth: 3,
  },
  threadParentName: { fontSize: 12, fontWeight: '700', marginBottom: 4 },
  threadParentContent: { fontSize: 14, lineHeight: 20 },
  threadMsgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 4 },
  threadMsgRowMine: { flexDirection: 'row-reverse' },
  threadAvatar: { width: 32, height: 32, borderRadius: 16 },
  threadMsgName: { fontSize: 11, fontWeight: '600', marginBottom: 2, marginLeft: 4 },
  threadMsgBubble: { maxWidth: '75%', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16 },
  threadMsgText: { fontSize: 14, lineHeight: 20 },
  threadMsgTime: { fontSize: 10, marginTop: 3, textAlign: 'right' as const },
  threadInputBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth,
  },
  threadInput: {
    flex: 1, maxHeight: 80, paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, fontSize: 15,
  },
  threadSendBtn: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
  },

  // ── Poll styles ──
  pollRow: { alignItems: 'center', marginVertical: 4, paddingHorizontal: 12 },
  pollBubble: {
    width: '100%', borderRadius: 16, borderWidth: 1, padding: 14,
  },
  pollSender: { fontSize: 11 },
  pollHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  pollLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  pollQuestion: { fontSize: 15, fontWeight: '700', marginBottom: 12, lineHeight: 20 },
  pollOption: {
    position: 'relative', borderRadius: 10, borderWidth: 1.5,
    marginBottom: 8, overflow: 'hidden',
  },
  pollProgressBar: {
    position: 'absolute', top: 0, left: 0, bottom: 0, borderRadius: 10,
  },
  pollOptionContent: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 10,
  },
  pollOptionLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  pollCircle: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5 },
  pollOptionText: { fontSize: 14, flex: 1 },
  pollVoteCount: { fontSize: 12, fontWeight: '600', marginLeft: 8 },
  pollFooter: { fontSize: 11, marginTop: 8, textAlign: 'center' },

  // Poll Modal
  pollModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  pollModalBox: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40, maxHeight: '90%' },
  pollModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  pollModalTitle: { fontSize: 18, fontWeight: '700' },
  pollModalSectionTitle: { fontSize: 12, fontWeight: '600', marginBottom: 8, marginTop: 4 },
  pollModalInput: {
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 15, marginBottom: 8,
  },
  pollOptionRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pollAddOption: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, marginBottom: 8 },
  pollAddOptionText: { fontSize: 14, fontWeight: '500' },
  pollCreateBtn: { borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  pollCreateBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});