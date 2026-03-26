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
  type: 'text' | 'image' | 'file';
  createdAt: string;
  readBy: string[];
  attachments?: { url: string; type: string; name: string }[];
};

type UserInfo = {
  _id: string;
  name: string;
  avatar?: string;
  status: 'online' | 'offline' | 'away';
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

  const [currentUser, setCurrentUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [emojiCategoryIndex, setEmojiCategoryIndex] = useState(0);

  // ← MỚI: Image viewer
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // ← MỚI: Message options (xóa)
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [showMessageOptions, setShowMessageOptions] = useState(false);

  const getToken = () => AsyncStorage.getItem('userToken');

  // ─── Fetch ────────────────────────────────────────────────────────────────

  const fetchUserInfo = async () => {
    try {
      const token = await getToken();
      const response = await fetch(`${BASE_URL}/api/users/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      setUserInfo(data.user);
    } catch (error) { console.error('Fetch user info error:', error); }
  };

  const fetchMessages = async () => {
    try {
      const token = await getToken();
      const response = await fetch(`${BASE_URL}/api/chat/messages/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      setMessages(data.messages || []);
    } catch (error) { console.error('Fetch messages error:', error); }
    finally { setLoading(false); }
  };

  const fetchCurrentUser = async () => {
    try {
      const token = await getToken();
      const response = await fetch(`${BASE_URL}/api/auth/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      const user = data.user;
      if (user) {
        setCurrentUser({ _id: user.id, name: user.name, avatar: user.avatar, status: user.status });
      }
    } catch (error) { console.error('Fetch current user error:', error); }
  };

  // ─── Mark as read ─────────────────────────────────────────────────────────

  const markMessagesAsRead = useCallback(async (msgs: Message[], user: UserInfo) => {
    if (hasMarkedReadRef.current) return;
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
        readBy: unreadIds.includes(msg._id) ? [...msg.readBy, user._id] : msg.readBy,
      })));
      const socket = socketService.getSocket();
      if (socket?.connected) {
        socket.emit('messages_read', { messageIds: unreadIds, readerId: user._id, senderId: id });
      }
    } catch (error) {
      hasMarkedReadRef.current = false;
    }
  }, [id]);

  useEffect(() => {
    onViewableItemsChanged.current = ({ viewableItems }: { viewableItems: Array<{ item: Message }> }) => {
      if (!currentUser) return;
      const visibleIds = viewableItems.map(v => v.item._id);
      const hasUnread = messages.some(
        msg => visibleIds.includes(msg._id) && msg.sender._id !== currentUser._id && !msg.readBy.includes(currentUser._id)
      );
      if (hasUnread) markMessagesAsRead(messages, currentUser);
    };
  }, [messages, currentUser, markMessagesAsRead]);

  // ─── Socket ───────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchCurrentUser();
    fetchUserInfo();
    fetchMessages();

    const socket = socketService.getSocket();
    if (!socket) return;

    socket.on('receive_message', (data: any) => {
      if (data.type === 'private' && data.message.sender._id === id) {
        setMessages(prev => [...prev, data.message]);
        flatListRef.current?.scrollToEnd({ animated: true });
        hasMarkedReadRef.current = false;
      }
    });
    socket.on('user_typing', (data: any) => {
      if (data.userId === id) setOtherUserTyping(data.isTyping);
    });
    socket.on('messages_read', (data: { messageIds: string[]; readerId: string }) => {
      if (data.readerId === id) {
        setMessages(prev => prev.map(msg => ({
          ...msg,
          readBy: data.messageIds.includes(msg._id) ? [...new Set([...msg.readBy, data.readerId])] : msg.readBy,
        })));
      }
    });
    socket.on('message_error', () => {
      setMessages(prev => prev.filter(msg => !msg._id.startsWith('temp_')));
    });
    socket.on('message_sent', (data: { messageId: string }) => {
      setMessages(prev => prev.map(msg => msg._id.startsWith('temp_') ? { ...msg, _id: data.messageId } : msg));
    });

    return () => {
      ['receive_message', 'user_typing', 'messages_read', 'message_error', 'message_sent']
        .forEach(e => socket.off(e));
    };
  }, [id]);

  // ─── Typing ───────────────────────────────────────────────────────────────

  const handleTyping = (text: string) => {
    setInputText(text);
    const socket = socketService.getSocket();
    if (!socket?.connected) return;
    socket.emit('typing', { receiverId: id, isTyping: text.length > 0 });
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    if (text.length > 0) {
      typingTimerRef.current = setTimeout(() => {
        socket.emit('typing', { receiverId: id, isTyping: false });
      }, 2000);
    }
  };

  // ─── Send text ────────────────────────────────────────────────────────────

  const sendMessage = async () => {
    if (!inputText.trim() || sending) return;
    const messageContent = inputText.trim();
    setInputText('');
    setShowEmojiPicker(false);
    setSending(true);

    const socket = socketService.getSocket();
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    if (socket?.connected) socket.emit('typing', { receiverId: id, isTyping: false });

    const tempId = `temp_${Date.now()}`;
    setMessages(prev => [...prev, {
      _id: tempId,
      sender: { _id: currentUser?._id || '', name: currentUser?.name || '', avatar: currentUser?.avatar },
      content: messageContent, type: 'text',
      createdAt: new Date().toISOString(), readBy: [],
    }]);
    flatListRef.current?.scrollToEnd({ animated: true });

    if (socket?.connected) {
      socket.emit('send_private_message', { receiverId: id, content: messageContent, type: 'text' });
    } else {
      try {
        const token = await getToken();
        const response = await fetch(`${BASE_URL}/api/chat/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ receiverId: id, content: messageContent, type: 'text' }),
        });
        const data = await response.json();
        if (data.message) {
          setMessages(prev => prev.map(msg => (msg._id === tempId ? data.message : msg)));
        } else {
          setMessages(prev => prev.filter(msg => msg._id !== tempId));
        }
      } catch {
        setMessages(prev => prev.filter(msg => msg._id !== tempId));
      }
    }
    setSending(false);
  };

  // ─── Send image → Cloudinary ──────────────────────────────────────────────

  const pickAndSendImage = async () => {
    setShowAttachMenu(false);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Cần quyền truy cập', 'Cho phép ứng dụng truy cập thư viện ảnh trong Cài đặt.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.7,
    });

    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setUploadingImage(true);

    const tempId = `temp_${Date.now()}`;
    setMessages(prev => [...prev, {
      _id: tempId,
      sender: { _id: currentUser?._id || '', name: currentUser?.name || '', avatar: currentUser?.avatar },
      content: '📷 Ảnh', type: 'image',
      createdAt: new Date().toISOString(), readBy: [],
      attachments: [{ url: asset.uri, type: 'image', name: 'photo.jpg' }],
    }]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const token = await getToken();
      const formData = new FormData();
      formData.append('file', { uri: asset.uri, type: asset.mimeType || 'image/jpeg', name: `photo_${Date.now()}.jpg` } as any);
      formData.append('receiverId', id as string);

      const uploadRes = await fetch(`${BASE_URL}/api/chat/upload/image`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const uploadData = await uploadRes.json();
      const imageUrl = uploadData.file?.url || asset.uri;

      setMessages(prev => prev.map(m =>
        m._id === tempId ? { ...m, attachments: [{ url: imageUrl, type: 'image', name: 'photo.jpg' }] } : m
      ));

      const socket = socketService.getSocket();
      if (socket?.connected) {
        socket.emit('send_private_message', {
          receiverId: id, content: '📷 Ảnh', type: 'image',
          attachments: [{ url: imageUrl, type: 'image', name: 'photo.jpg' }],
        });
      }
    } catch (e) {
      console.error('Upload image error:', e);
    } finally {
      setUploadingImage(false);
    }
  };

  // ─── Send file → Supabase ─────────────────────────────────────────────────

  const pickAndSendFile = async () => {
    setShowAttachMenu(false);

    const result = await DocumentPicker.getDocumentAsync({
      type: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/zip', 'application/x-zip-compressed',
        'video/*', 'audio/*',
      ],
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setUploadingFile(true);

    const tempId = `temp_${Date.now()}`;
    setMessages(prev => [...prev, {
      _id: tempId,
      sender: { _id: currentUser?._id || '', name: currentUser?.name || '', avatar: currentUser?.avatar },
      content: asset.name || 'File', type: 'file',
      createdAt: new Date().toISOString(), readBy: [],
      attachments: [{ url: '', type: 'document', name: asset.name || 'file' }],
    }]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const token = await getToken();
      const formData = new FormData();
      formData.append('file', {
        uri: asset.uri,
        type: asset.mimeType || 'application/octet-stream',
        name: asset.name || `file_${Date.now()}`,
      } as any);
      formData.append('receiverId', id as string);

      const uploadRes = await fetch(`${BASE_URL}/api/chat/upload/document`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const uploadData = await uploadRes.json();
      const fileUrl = uploadData.file?.url || '';

      setMessages(prev => prev.map(m =>
        m._id === tempId
          ? { ...m, attachments: [{ url: fileUrl, type: 'document', name: asset.name || 'file' }] }
          : m
      ));

      const socket = socketService.getSocket();
      if (socket?.connected) {
        socket.emit('send_private_message', {
          receiverId: id, content: asset.name || 'File', type: 'file',
          attachments: [{ url: fileUrl, type: 'document', name: asset.name || 'file' }],
        });
      }
    } catch (e) {
      console.error('Upload file error:', e);
      setMessages(prev => prev.filter(m => m._id !== tempId));
      Alert.alert('Lỗi', 'Không thể gửi file!');
    } finally {
      setUploadingFile(false);
    }
  };

  // ─── MỚI: Xóa tin nhắn ───────────────────────────────────────────────────

  const handleLongPressMessage = (message: Message) => {
    // Chỉ cho xóa tin nhắn của mình
    if (message.sender._id !== currentUser?._id) return;
    if (message._id.startsWith('temp_')) return; // không xóa temp message
    setSelectedMessage(message);
    setShowMessageOptions(true);
  };

  const deleteMessage = async () => {
    if (!selectedMessage) return;
    setShowMessageOptions(false);

    try {
      const token = await getToken();
      const res = await fetch(`${BASE_URL}/api/chat/${selectedMessage._id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        // Xóa khỏi local state
        setMessages(prev => prev.filter(m => m._id !== selectedMessage._id));
      } else {
        Alert.alert('Lỗi', 'Không thể xóa tin nhắn!');
      }
    } catch (e) {
      console.error('Delete message error:', e);
      Alert.alert('Lỗi', 'Không thể xóa tin nhắn!');
    } finally {
      setSelectedMessage(null);
    }
  };

  // ─── Emoji ────────────────────────────────────────────────────────────────

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

  // ─── Attach menu ──────────────────────────────────────────────────────────

  const renderAttachMenu = () => (
    <View style={[styles.attachMenu, { backgroundColor: colors.background, borderTopColor: colors.borderColor }]}>
      <TouchableOpacity style={styles.attachMenuItem} onPress={pickAndSendImage} disabled={uploadingImage}>
        {uploadingImage
          ? <ActivityIndicator size={28} color="#4CAF50" />
          : <View style={[styles.attachMenuIcon, { backgroundColor: '#4CAF50' + '20' }]}>
              <Ionicons name="image-outline" size={28} color="#4CAF50" />
            </View>
        }
        <Text style={[styles.attachMenuLabel, { color: colors.text }]}>Ảnh</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.attachMenuItem} onPress={pickAndSendFile} disabled={uploadingFile}>
        {uploadingFile
          ? <ActivityIndicator size={28} color="#2196F3" />
          : <View style={[styles.attachMenuIcon, { backgroundColor: '#2196F3' + '20' }]}>
              <Ionicons name="document-outline" size={28} color="#2196F3" />
            </View>
        }
        <Text style={[styles.attachMenuLabel, { color: colors.text }]}>File</Text>
      </TouchableOpacity>
    </View>
  );

  // ─── Format time ──────────────────────────────────────────────────────────

  const formatTime = (dateString: string) =>
    new Date(dateString).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

  // ─── Render message ───────────────────────────────────────────────────────

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isMyMessage = item.sender._id === currentUser?._id;
    const isEndOfSequence = index === messages.length - 1 || messages[index + 1]?.sender._id !== item.sender._id;
    const showAvatar = !isMyMessage && isEndOfSequence;
    const isReadByOther = item.readBy.some(uid => uid !== currentUser?._id);
    const isTemp = item._id.startsWith('temp_');
    const imageAttachment = item.type === 'image' ? item.attachments?.[0] : null;
    const fileAttachment = item.type === 'file' ? item.attachments?.[0] : null;

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onLongPress={() => handleLongPressMessage(item)}
        delayLongPress={400}
      >
        <View style={[styles.messageRow, isMyMessage ? styles.myMessageRow : styles.otherMessageRow]}>
          {!isMyMessage && (
            <View style={styles.avatarContainer}>
              {showAvatar ? (
                item.sender.avatar
                  ? <Image source={{ uri: item.sender.avatar }} style={styles.avatar} />
                  : (
                    <View style={[styles.avatar, { backgroundColor: colors.tint + '20' }]}>
                      <Text style={[styles.avatarText, { color: colors.tint }]}>
                        {item.sender.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )
              ) : <View style={styles.avatarPlaceholder} />}
            </View>
          )}

          <View style={[
            styles.messageBubble,
            isMyMessage ? styles.myMessage : styles.otherMessage,
            (imageAttachment || fileAttachment) ? styles.mediaBubble : null,
            { backgroundColor: isMyMessage ? colors.tint : colors.backgroundElement },
          ]}>
            {imageAttachment ? (
              // ── Ảnh — nhấn để xem full screen ──
              <TouchableOpacity
                onPress={() => imageAttachment.url && setSelectedImage(imageAttachment.url)}
                activeOpacity={0.9}
              >
                <Image source={{ uri: imageAttachment.url }} style={styles.messageImage} resizeMode="cover" />
                {isTemp && uploadingImage && (
                  <View style={styles.mediaOverlay}>
                    <ActivityIndicator color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
            ) : fileAttachment ? (
              // ── File — nhấn để mở ──
              <TouchableOpacity
                style={styles.fileBubble}
                onPress={() => fileAttachment.url && Linking.openURL(fileAttachment.url)}
                disabled={!fileAttachment.url}
              >
                <View style={[styles.fileIcon, { backgroundColor: isMyMessage ? 'rgba(255,255,255,0.2)' : colors.tint + '20' }]}>
                  <Ionicons name="document-outline" size={24} color={isMyMessage ? '#fff' : colors.tint} />
                </View>
                <View style={styles.fileInfo}>
                  <Text style={[styles.fileName, { color: isMyMessage ? '#fff' : colors.text }]} numberOfLines={2}>
                    {fileAttachment.name}
                  </Text>
                  {!fileAttachment.url && isTemp && (
                    <Text style={{ color: isMyMessage ? 'rgba(255,255,255,0.6)' : colors.textSecondary, fontSize: 11 }}>
                      Đang tải lên...
                    </Text>
                  )}
                </View>
                {!fileAttachment.url && isTemp
                  ? <ActivityIndicator size={16} color={isMyMessage ? '#fff' : colors.tint} />
                  : <Ionicons name="download-outline" size={20} color={isMyMessage ? 'rgba(255,255,255,0.8)' : colors.tint} />
                }
              </TouchableOpacity>
            ) : (
              // ── Text ──
              <Text style={[styles.messageText, { color: isMyMessage ? '#fff' : colors.text }]}>
                {item.content}
              </Text>
            )}

            <View style={styles.messageFooter}>
              <Text style={[styles.messageTime, { color: isMyMessage ? 'rgba(255,255,255,0.6)' : colors.textSecondary }]}>
                {formatTime(item.createdAt)}
              </Text>
              {isMyMessage && (
                isTemp
                  ? <ActivityIndicator size={12} color="rgba(255,255,255,0.6)" />
                  : <Ionicons
                      name={isReadByOther ? 'checkmark-done' : 'checkmark'}
                      size={16}
                      color={isReadByOther ? '#4FC3F7' : 'rgba(255,255,255,0.6)'}
                    />
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // ─── MỚI: Image Viewer Modal ──────────────────────────────────────────────

  const renderImageViewer = () => (
    <Modal
      visible={!!selectedImage}
      transparent
      animationType="fade"
      onRequestClose={() => setSelectedImage(null)}
    >
      <View style={styles.imageViewerContainer}>
        <TouchableWithoutFeedback onPress={() => setSelectedImage(null)}>
          <View style={styles.imageViewerBg} />
        </TouchableWithoutFeedback>

        {/* Close button */}
        <TouchableOpacity style={styles.imageViewerClose} onPress={() => setSelectedImage(null)}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>

        {/* Image */}
        {selectedImage && (
          <Image
            source={{ uri: selectedImage }}
            style={styles.imageViewerImage}
            resizeMode="contain"
          />
        )}

        {/* Download button */}
        {selectedImage && (
          <TouchableOpacity
            style={styles.imageViewerDownload}
            onPress={() => Linking.openURL(selectedImage!)}
          >
            <Ionicons name="download-outline" size={24} color="#fff" />
            <Text style={styles.imageViewerDownloadText}>Tải xuống</Text>
          </TouchableOpacity>
        )}
      </View>
    </Modal>
  );

  // ─── MỚI: Message Options Modal (xóa tin nhắn) ───────────────────────────

  const renderMessageOptions = () => (
    <Modal
      visible={showMessageOptions}
      transparent
      animationType="fade"
      onRequestClose={() => setShowMessageOptions(false)}
    >
      <TouchableWithoutFeedback onPress={() => setShowMessageOptions(false)}>
        <View style={styles.optionsOverlay}>
          <TouchableWithoutFeedback>
            <View style={[styles.optionsContainer, { backgroundColor: colors.background }]}>
              <Text style={[styles.optionsTitle, { color: colors.textSecondary }]}>
                Tùy chọn tin nhắn
              </Text>

              <TouchableOpacity
                style={styles.optionItem}
                onPress={() => {
                  setShowMessageOptions(false);
                  Alert.alert(
                    'Xóa tin nhắn',
                    'Bạn có chắc muốn xóa tin nhắn này?',
                    [
                      { text: 'Hủy', style: 'cancel' },
                      { text: 'Xóa', style: 'destructive', onPress: deleteMessage },
                    ]
                  );
                }}
              >
                <View style={[styles.optionIcon, { backgroundColor: '#F44336' + '20' }]}>
                  <Ionicons name="trash-outline" size={20} color="#F44336" />
                </View>
                <Text style={[styles.optionText, { color: '#F44336' }]}>Xóa tin nhắn</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.optionItem}
                onPress={() => setShowMessageOptions(false)}
              >
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

  // ─── Loading ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  // ─── Main render ──────────────────────────────────────────────────────────

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} />

        {/* Image Viewer Modal */}
        {renderImageViewer()}

        {/* Message Options Modal */}
        {renderMessageOptions()}

        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.borderColor }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.userInfo}
            onPress={() => router.push(`/chat/info/${id}` as any)}
            activeOpacity={0.7}
          >
            <View style={styles.userAvatar}>
              {userInfo?.avatar
                ? <Image source={{ uri: userInfo.avatar }} style={styles.headerAvatar} />
                : (
                  <View style={[styles.headerAvatar, { backgroundColor: colors.tint + '20' }]}>
                    <Text style={[styles.headerAvatarText, { color: colors.tint }]}>
                      {userInfo?.name?.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )
              }
            </View>
            <View>
              <Text style={[styles.userName, { color: colors.text }]}>{userInfo?.name}</Text>
              <Text style={[styles.userStatus, { color: otherUserTyping ? colors.tint : colors.textSecondary }]}>
                {otherUserTyping ? 'Đang gõ...' : userInfo?.status === 'online' ? 'Đang hoạt động' : 'Ngoại tuyến'}
              </Text>
            </View>
          </TouchableOpacity>

          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.headerButton}>
              <Ionicons name="call-outline" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Messages */}
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

        {/* Input */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <View style={[styles.inputContainer, { backgroundColor: colors.background, borderTopColor: colors.borderColor }]}>
            <TouchableOpacity
              style={styles.attachButton}
              onPress={() => { setShowAttachMenu(prev => !prev); setShowEmojiPicker(false); }}
            >
              <Ionicons
                name={showAttachMenu ? 'close' : 'attach'}
                size={24}
                color={showAttachMenu ? colors.tint : colors.textSecondary}
              />
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
              <TouchableOpacity
                style={{ padding: 8 }}
                onPress={() => { setShowEmojiPicker(prev => !prev); setShowAttachMenu(false); }}
              >
                <Text style={{ fontSize: 24 }}>{showEmojiPicker ? '⌨️' : '😊'}</Text>
              </TouchableOpacity>
            )}
          </View>

          {showAttachMenu && renderAttachMenu()}
          {showEmojiPicker && renderEmojiPicker()}
        </KeyboardAvoidingView>
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
  userInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: 8 },
  userAvatar: { marginRight: 12 },
  headerAvatar: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  headerAvatarText: { fontSize: 18, fontWeight: 'bold' },
  userName: { fontSize: 16, fontWeight: '600' },
  userStatus: { fontSize: 12 },
  headerActions: { flexDirection: 'row' },
  headerButton: { padding: 8 },
  messagesList: { paddingHorizontal: 12, paddingVertical: 16 },
  messageRow: { flexDirection: 'row', marginBottom: 8 },
  myMessageRow: { justifyContent: 'flex-end' },
  otherMessageRow: { justifyContent: 'flex-start' },
  avatarContainer: { width: 36, height: 36, marginRight: 8, alignSelf: 'flex-end' },
  avatar: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 16, fontWeight: 'bold' },
  avatarPlaceholder: { width: 44 },
  messageBubble: { maxWidth: '70%', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18 },
  myMessage: { borderBottomRightRadius: 4 },
  otherMessage: { borderBottomLeftRadius: 4 },
  mediaBubble: { padding: 4, paddingBottom: 8 },
  messageImage: { width: 200, height: 200, borderRadius: 14 },
  mediaOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
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

  // ── Image Viewer ──
  imageViewerContainer: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center', alignItems: 'center',
  },
  imageViewerBg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  imageViewerClose: {
    position: 'absolute', top: 50, right: 20, zIndex: 10,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  imageViewerImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.75,
  },
  imageViewerDownload: {
    position: 'absolute', bottom: 50,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20,
  },
  imageViewerDownloadText: { color: '#fff', fontSize: 15, fontWeight: '500' },

  // ── Message Options ──
  optionsOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  optionsContainer: {
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingTop: 12, paddingBottom: 34, paddingHorizontal: 16,
  },
  optionsTitle: {
    fontSize: 13, textAlign: 'center', marginBottom: 16,
  },
  optionItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14,
  },
  optionIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  optionText: { fontSize: 16, fontWeight: '500' },
});