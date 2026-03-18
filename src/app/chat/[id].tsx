import { Colors } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import socketService from '../lib/socket';

type Message = {
  _id: string;
  sender: {
    _id: string;
    name: string;
    avatar?: string;
  };
  content: string;
  type: 'text' | 'image' | 'file';
  createdAt: string;
  readBy: string[];
};

type UserInfo = {
  _id: string;
  name: string;
  avatar?: string;
  status: 'online' | 'offline' | 'away';
};

const BASE_URL = 'http://103.82.25.230:3001';

const EMOJI_CATEGORIES = [
  { label: 'Phổ biến', icon: '⭐', emojis: ['😀','😂','🥰','😍','🤩','😎','🥳','😅','🤣','😭','😤','😡','🥺','😢','😮','🤔','🤫','🤭','😏','😒'] },
  { label: 'Cảm xúc', icon: '😊', emojis: ['😊','😇','🙂','🙃','😉','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🥴','🤧','🥵','🥶','😵'] },
  { label: 'Tay', icon: '👋', emojis: ['👋','🤚','🖐️','✋','🖖','👌','🤌','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','👇','☝️','👍','👎','✊'] },
  { label: 'Trái tim', icon: '❤️', emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','♥️'] },
];
const ChatDetailScreen = () => {
  const { id, type } = useLocalSearchParams<{ id: string; type: string }>();
  const router = useRouter();
  const scheme = useColorScheme();

  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];


  const flatListRef = useRef<FlatList>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null); // FIX 2: debounce typing

  const [currentUser, setCurrentUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const hasMarkedReadRef = useRef(false); // FIX 3: dùng ref thay vì state để tránh re-render loop
  const [showEmojiPicker,setShowEmojiPicker] = useState(false);
  const [emojiCategoryIndex,setEmojiCategoryIndex]  = useState(0);
  const getToken = () => AsyncStorage.getItem('userToken');

  // Fetch thông tin user đang chat
  const fetchUserInfo = async () => {
    try {
      const token = await getToken();
      const response = await fetch(`${BASE_URL}/api/users/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      setUserInfo(data.user);
    } catch (error) {
      console.error('Fetch user info error:', error);
    }
  };

  // Fetch lịch sử tin nhắn
  const fetchMessages = async () => {
    try {
      const token = await getToken();
      const response = await fetch(`${BASE_URL}/api/chat/messages/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      setMessages(data.messages || []);
    } catch (error) {
      console.error('Fetch messages error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch thông tin user hiện tại
  const fetchCurrentUser = async () => {
    try {
      const token = await getToken();
      const response = await fetch(`${BASE_URL}/api/auth/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      const user = data.user;
      if (user) {
        setCurrentUser({
          _id: user.id,
          name: user.name,
          avatar: user.avatar,
          status: user.status,
        });
      }
    } catch (error) {
      console.error('Fetch current user error:', error);
    }
  };

  // Đánh dấu tin nhắn đã đọc
  const markMessagesAsRead = useCallback(
    async (msgs: Message[], user: UserInfo) => {
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
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ messageIds: unreadIds }),
        });

        setMessages(prev =>
          prev.map(msg => ({
            ...msg,
            readBy: unreadIds.includes(msg._id)
              ? [...msg.readBy, user._id]
              : msg.readBy,
          }))
        );

        const socket = socketService.getSocket();
        if (socket?.connected) {
          socket.emit('messages_read', {
            messageIds: unreadIds,
            readerId: user._id,
            senderId: id,
          });
        }
      } catch (error) {
        hasMarkedReadRef.current = false; // cho phép thử lại nếu lỗi
        console.error('Mark as read error:', error);
      }
    },
    [id]
  );

  // FIX 4: onViewableItemsChanged và viewabilityConfig phải là ref
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<{ item: Message }> }) => {
      // Dùng callback ref để truy cập giá trị mới nhất
    }
  );

  // Cập nhật ref callback khi dependencies thay đổi
  useEffect(() => {
    onViewableItemsChanged.current = ({ viewableItems }) => {
      if (!currentUser) return;
      const visibleIds = viewableItems.map(v => v.item._id);
      const hasUnread = messages.some(
        msg =>
          visibleIds.includes(msg._id) &&
          msg.sender._id !== currentUser._id &&
          !msg.readBy.includes(currentUser._id)
      );
      if (hasUnread) {
        markMessagesAsRead(messages, currentUser);
      }
    };
  }, [messages, currentUser, markMessagesAsRead]);

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }); // FIX 4

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
        hasMarkedReadRef.current = false; // reset để mark read tin mới
      }
    });

    socket.on('user_typing', (data: any) => {
      if (data.userId === id) {
        setOtherUserTyping(data.isTyping);
      }
    });

    socket.on('messages_read', (data: { messageIds: string[]; readerId: string }) => {
      if (data.readerId === id) {
        setMessages(prev =>
          prev.map(msg => ({
            ...msg,
            readBy: data.messageIds.includes(msg._id)
              ? [...new Set([...msg.readBy, data.readerId])] // tránh duplicate
              : msg.readBy,
          }))
        );
      }
    });

    // FIX 5: Lắng nghe message_error từ server
    socket.on('message_error', (data: { error: string }) => {
      console.error('❌ Message error:', data.error);
      // Xóa temp message bị lỗi
      setMessages(prev => prev.filter(msg => !msg._id.startsWith('temp_')));
    });

    // FIX 6: Lắng nghe message_sent để replace temp ID
    socket.on('message_sent', (data: { messageId: string; status: string }) => {
      setMessages(prev =>
        prev.map(msg =>
          msg._id.startsWith('temp_') ? { ...msg, _id: data.messageId } : msg
        )
      );
    });

    return () => {
      socket.off('receive_message');
      socket.off('user_typing');
      socket.off('messages_read');
      socket.off('message_error');
      socket.off('message_sent');
    };
  }, [id]);

  // FIX 7: Debounce typing indicator — không emit mỗi ký tự
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

  // Gửi tin nhắn
  const sendMessage = async () => {
    if (!inputText.trim() || sending) return;

    const messageContent = inputText.trim();
    setInputText('');
    setSending(true);

    // Tắt typing indicator
    const socket = socketService.getSocket();
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    if (socket?.connected) {
      socket.emit('typing', { receiverId: id, isTyping: false });
    }

    // Thêm temp message hiển thị ngay
    const tempId = `temp_${Date.now()}`;
    const tempMessage: Message = {
      _id: tempId,
      sender: {
        _id: currentUser?._id || '',
        name: currentUser?.name || '',
        avatar: currentUser?.avatar,
      },
      content: messageContent,
      type: 'text',
      createdAt: new Date().toISOString(),
      readBy: [],
    };

    setMessages(prev => [...prev, tempMessage]);
    flatListRef.current?.scrollToEnd({ animated: true });

    if (socket?.connected) {
      // FIX 8: kiểm tra connected trước khi emit
      socket.emit('send_private_message', {
        receiverId: id,
        content: messageContent,
        type: 'text',
      });
    } else {
      // Fallback REST API nếu socket offline
      try {
        const token = await getToken();
        const response = await fetch(`${BASE_URL}/api/chat/send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ receiverId: id, content: messageContent, type: 'text' }),
        });
        const data = await response.json();
        if (data.message) {
          setMessages(prev =>
            prev.map(msg => (msg._id === tempId ? data.message : msg))
          );
        } else {
          setMessages(prev => prev.filter(msg => msg._id !== tempId));
        }
      } catch (error) {
        console.error('Send message REST error:', error);
        setMessages(prev => prev.filter(msg => msg._id !== tempId));
      }
    }

    setSending(false);
  };
  const insertEmoji = (emoji:string)=>{
      setInputText(prev => prev + emoji);
  }
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


  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isMyMessage = item.sender._id === currentUser?._id;
    const isEndOfSequence =
      index === messages.length - 1 ||
      messages[index + 1]?.sender._id !== item.sender._id;
    const showAvatar = !isMyMessage && isEndOfSequence;

    // FIX 9: readBy check đúng — chỉ double tick khi người nhận đã đọc
    const isReadByOther = item.readBy.some(uid => uid !== currentUser?._id);

    return (
      <View
        style={[
          styles.messageRow,
          isMyMessage ? styles.myMessageRow : styles.otherMessageRow,
        ]}
      >
        {!isMyMessage && (
          <View style={styles.avatarContainer}>
            {showAvatar ? (
              item.sender.avatar ? (
                <Image source={{ uri: item.sender.avatar }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, { backgroundColor: colors.tint + '20' }]}>
                  <Text style={[styles.avatarText, { color: colors.tint }]}>
                    {item.sender.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )
            ) : (
              <View style={styles.avatarPlaceholder} />
            )}
          </View>
        )}

        <View
          style={[
            styles.messageBubble,
            isMyMessage ? styles.myMessage : styles.otherMessage,
            { backgroundColor: isMyMessage ? colors.tint : colors.backgroundElement },
          ]}
        >
          <Text style={[styles.messageText, { color: isMyMessage ? '#fff' : colors.text }]}>
            {item.content}
          </Text>
          <View style={styles.messageFooter}>
            <Text
              style={[
                styles.messageTime,
                { color: isMyMessage ? 'rgba(255,255,255,0.6)' : colors.textSecondary },
              ]}
            >
              {formatTime(item.createdAt)}
            </Text>
            {isMyMessage && (
              <Ionicons
                name={isReadByOther ? 'checkmark-done' : 'checkmark'}
                size={16}
                color={isReadByOther ? '#4FC3F7' : 'rgba(255,255,255,0.6)'}
              />
            )}
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} />

        {/* Header */}
        <View
          style={[
            styles.header,
            { backgroundColor: colors.background, borderBottomColor: colors.borderColor },
          ]}
        >
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>

          <View style={styles.userInfo}>
            <View style={styles.userAvatar}>
              {userInfo?.avatar ? (
                <Image source={{ uri: userInfo.avatar }} style={styles.headerAvatar} />
              ) : (
                <View style={[styles.headerAvatar, { backgroundColor: colors.tint + '20' }]}>
                  <Text style={[styles.headerAvatarText, { color: colors.tint }]}>
                    {userInfo?.name?.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
            <View>
              <Text style={[styles.userName, { color: colors.text }]}>{userInfo?.name}</Text>
              <Text
                style={[
                  styles.userStatus,
                  { color: otherUserTyping ? colors.tint : colors.textSecondary },
                ]}
              >
                {otherUserTyping
                  ? 'Đang gõ...'
                  : userInfo?.status === 'online'
                  ? 'Đang hoạt động'
                  : 'Ngoại tuyến'}
              </Text>
            </View>
          </View>

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
          // FIX 4: Dùng ref để tránh FlatList warning
          onViewableItemsChanged={onViewableItemsChanged.current}
          viewabilityConfig={viewabilityConfig.current}
        />

        {/* Input */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <View
            style={[
              styles.inputContainer,
              { backgroundColor: colors.background, borderTopColor: colors.borderColor },
            ]}
          >
            <TouchableOpacity style={styles.attachButton}>
              <Ionicons name="attach" size={24} color={colors.textSecondary} />
            </TouchableOpacity>

            <TextInput
              style={[
                styles.input,
                { backgroundColor: colors.backgroundElement, color: colors.text },
              ]}
              placeholder="Nhập tin nhắn..."
              placeholderTextColor={colors.textSecondary}
              value={inputText}
              onChangeText={handleTyping}
              multiline
            />

        {inputText.trim() ? (
          <TouchableOpacity style={[styles.sendButton, { backgroundColor: colors.tint }]} onPress={sendMessage} disabled={sending}>
            <Ionicons name="send" size={20} color="#fff" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={{ padding: 8 }} onPress={() => setShowEmojiPicker(prev => !prev)}>
            <Text style={{ fontSize: 24 }}>{showEmojiPicker ? '⌨️' : '😊'}</Text>
          </TouchableOpacity>
        )}
          </View>
              {showEmojiPicker && renderEmojiPicker()}

        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
};

export default ChatDetailScreen;

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContent: { justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  backButton: { padding: 8 },
  userInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  userAvatar: { marginRight: 12 },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerAvatarText: { fontSize: 18, fontWeight: 'bold' },
  userName: { fontSize: 16, fontWeight: '600' },
  userStatus: { fontSize: 12 },
  headerActions: { flexDirection: 'row' },
  headerButton: { padding: 8 },
  messagesList: { paddingHorizontal: 12, paddingVertical: 16 },
  messageRow: { flexDirection: 'row', marginBottom: 8 },
  myMessageRow: { justifyContent: 'flex-end' },
  otherMessageRow: { justifyContent: 'flex-start' },
  avatarContainer: {
    width: 36,
    height: 36,
    marginRight: 8,
    alignSelf: 'flex-end',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 16, fontWeight: 'bold' },
  avatarPlaceholder: { width: 44 },
  messageBubble: {
    maxWidth: '70%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
  },
  myMessage: { borderBottomRightRadius: 4 },
  otherMessage: { borderBottomLeftRadius: 4 },
  messageText: { fontSize: 15, lineHeight: 20 },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
    gap: 4,
  },
  messageTime: { fontSize: 10 },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  attachButton: { padding: 8 },
  input: {
    flex: 1,
    maxHeight: 100,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    fontSize: 15,
    marginHorizontal: 8,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreButton: { padding: 8 },
  emojiPicker: { borderTopWidth: StyleSheet.hairlineWidth, height: 280 },
  emojiCategoryTabs: { flexGrow: 0, paddingHorizontal: 8, paddingVertical: 4 },
  emojiCategoryTab: { paddingHorizontal: 12, paddingVertical: 8, marginRight: 4 },
  emojiItem: { flex: 1, aspectRatio: 1, justifyContent: 'center', alignItems: 'center' },
});