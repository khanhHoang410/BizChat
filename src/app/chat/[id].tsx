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
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import socketService from '../lib/socket';

// Định nghĩa type cho Message
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

// Định nghĩa type cho User info
type UserInfo = {
  _id: string;
  name: string;
  avatar?: string;
  status: 'online' | 'offline' | 'away';
};

const ChatDetailScreen = () => {
  const { id, type } = useLocalSearchParams<{ id: string; type: string }>();
  const router = useRouter();
  const scheme = useColorScheme();
  const colors = Colors['light'];
  const flatListRef = useRef<FlatList>(null);
  const [currentUser, setCurrentUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const [hasMarkedRead, setHasMarkedRead] = useState(false); // Thêm flag để tránh gọi API nhiều lần

  // Fetch thông tin user đang chat
  const fetchUserInfo = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await fetch(`http://192.168.1.75:3001/api/users/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      console.log('👤 Other user:', data);
      setUserInfo(data.user);
    } catch (error) {
      console.error('Fetch user info error:', error);
    }
  };

  // Fetch lịch sử tin nhắn
  const fetchMessages = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await fetch(`http://192.168.1.75:3001/api/chat/messages/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
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
      const token = await AsyncStorage.getItem('userToken');
      const response = await fetch('http://192.168.1.75:3001/api/auth/profile', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      console.log('👤 Current user:', data.user);
      const user = data.user;
      if (user) {
        setCurrentUser({
          _id: user.id,
          name: user.name,
          avatar: user.avatar,
          status: user.status
        });
      }
    } catch (error) {
      console.error('Fetch current user error:', error);
    }
  };

  // Đánh dấu tin nhắn đã đọc
  const markMessagesAsRead = useCallback(async () => {
    if (!currentUser || hasMarkedRead) return; // Chỉ gọi 1 lần
    
    try {
      const token = await AsyncStorage.getItem('userToken');
      const unreadMessages = messages
        .filter(msg => msg.sender._id !== currentUser._id && !msg.readBy.includes(currentUser._id))
        .map(msg => msg._id);

      if (unreadMessages.length > 0) {
        console.log('📚 Đánh dấu đã đọc:', unreadMessages.length, 'tin nhắn');
        
        await fetch('http://192.168.1.75:3001/api/chat/mark-read', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ messageIds: unreadMessages })
        });

        // Cập nhật local state
        setMessages(prev => prev.map(msg => ({
          ...msg,
          readBy: unreadMessages.includes(msg._id) 
            ? [...msg.readBy, currentUser._id]
            : msg.readBy
        })));

        // Emit socket báo cho người kia biết đã đọc
        const socket = socketService.getSocket();
        if (socket) {
          socket.emit('messages_read', {
            messageIds: unreadMessages,
            readerId: currentUser._id,
            senderId: id
          });
        }

        setHasMarkedRead(true);
      }
    } catch (error) {
      console.error('Mark as read error:', error);
    }
  }, [messages, currentUser, id, hasMarkedRead]);

  // Xử lý khi có tin nhắn mới hiển thị
  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: Array<{ item: Message }> }) => {
    if (!currentUser || hasMarkedRead) return;
    
    const visibleMessageIds = viewableItems.map(item => item.item._id);
    const hasUnreadFromOther = messages.some(
      msg => visibleMessageIds.includes(msg._id) && 
             msg.sender._id !== currentUser._id && 
             !msg.readBy.includes(currentUser._id)
    );
    
    if (hasUnreadFromOther) {
      markMessagesAsRead();
    }
  }, [messages, currentUser, hasMarkedRead, markMessagesAsRead]);

  const viewabilityConfig = {
    itemVisiblePercentThreshold: 50,
  };

  useEffect(() => {
    fetchCurrentUser();
    fetchUserInfo();
    fetchMessages();

    const socket = socketService.getSocket();
    if (socket) {
      socket.on('receive_message', (data: any) => {
        if (data.type === 'private' && data.message.sender._id === id) {
          setMessages(prev => [...prev, data.message]);
          flatListRef.current?.scrollToEnd();
          setHasMarkedRead(false); // Reset flag khi có tin nhắn mới
        }
      });

      socket.on('user_typing', (data: any) => {
        if (data.userId === id) {
          setOtherUserTyping(data.isTyping);
        }
      });

      // Lắng nghe event người kia đã đọc tin nhắn
      socket.on('messages_read', (data: { messageIds: string[], readerId: string }) => {
        if (data.readerId === id) {
          setMessages(prev => prev.map(msg => ({
            ...msg,
            readBy: data.messageIds.includes(msg._id) 
              ? [...msg.readBy, data.readerId]
              : msg.readBy
          })));
        }
      });
    }

    return () => {
      if (socket) {
        socket.off('receive_message');
        socket.off('user_typing');
        socket.off('messages_read');
      }
    };
  }, [id]);

  // Gửi typing indicator
  const handleTyping = (text: string) => {
    setInputText(text);
    const socket = socketService.getSocket();
    if (socket) {
      socket.emit('typing', {
        receiverId: id,
        isTyping: text.length > 0
      });
    }
  };

  // Gửi tin nhắn
  const sendMessage = async () => {
    if (!inputText.trim() || sending) return;

    setSending(true);
    const socket = socketService.getSocket();
    
    if (socket) {
      socket.emit('send_private_message', {
        receiverId: id,
        content: inputText.trim(),
        type: 'text'
      });

      const tempMessage: Message = {
        _id: Date.now().toString(),
        sender: {
          _id: currentUser?._id || '', 
          name: currentUser?.name || '',
          avatar: currentUser?.avatar
        },
        content: inputText.trim(),
        type: 'text',
        createdAt: new Date().toISOString(),
        readBy: []
      };

      setMessages(prev => [...prev, tempMessage]);
      setInputText('');
      flatListRef.current?.scrollToEnd();
      setHasMarkedRead(false);
    }
    setSending(false);
  };

  // Format thời gian
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('vi-VN', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  // Render tin nhắn
  // Render tin nhắn
// Render tin nhắn
const renderMessage = ({ item, index }: { item: Message; index: number }) => {
  const isMyMessage = item.sender._id === currentUser?._id;
  
  const isEndOfSequence = index === messages.length - 1 || 
    messages[index + 1]?.sender._id !== item.sender._id;
  
  const showAvatar = !isMyMessage && isEndOfSequence;

  return (
    <View style={[
      styles.messageRow,
      isMyMessage ? styles.myMessageRow : styles.otherMessageRow
    ]}>
      {/* Avatar - chỉ hiển thị ở tin nhắn cuối cụm */}
      {!isMyMessage && (
        <View style={styles.avatarContainer}>
          {showAvatar ? (
            // Hiển thị avatar ở tin nhắn cuối
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
      
      {/* Tin nhắn */}
      <View style={[
        styles.messageBubble,
        isMyMessage ? styles.myMessage : styles.otherMessage,
        { backgroundColor: isMyMessage ? colors.tint : colors.backgroundElement }
      ]}>
        <Text style={[
          styles.messageText,
          { color: isMyMessage ? '#fff' : colors.text }
        ]}>
          {item.content}
        </Text>
        <View style={styles.messageFooter}>
          <Text style={[
            styles.messageTime,
            { color: isMyMessage ? '#fff' + '80' : colors.textSecondary }
          ]}>
            {formatTime(item.createdAt)}
          </Text>
          {isMyMessage && (
            <Ionicons 
              name={item.readBy.length > 0 ? "checkmark-done" : "checkmark"} 
              size={16} 
              color={isMyMessage ? '#fff' + '80' : colors.textSecondary} 
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
    <Stack.Screen options={{headerShown:false}}/>
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} />
      
      {/* Header */}
      <View style={[styles.header, { 
        backgroundColor: colors.background,
        borderBottomColor: colors.borderColor 
      }]}>
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
                  {userInfo?.name.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>
          <View>
            <Text style={[styles.userName, { color: colors.text }]}>{userInfo?.name}</Text>
            <Text style={[styles.userStatus, { 
              color: otherUserTyping ? colors.tint : colors.textSecondary 
            }]}>
              {otherUserTyping ? 'Đang gõ...' : userInfo?.status === 'online' ? 'Đang hoạt động' : 'Ngoại tuyến'}
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
        keyExtractor={(item) => item._id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messagesList}
        onLayout={() => flatListRef.current?.scrollToEnd()}
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
      />

      {/* Input */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={[styles.inputContainer, { 
          backgroundColor: colors.background,
          borderTopColor: colors.borderColor 
        }]}>
          <TouchableOpacity style={styles.attachButton}>
            <Ionicons name="attach" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
          
          <TextInput
            style={[styles.input, { 
              backgroundColor: colors.backgroundElement,
              color: colors.text 
            }]}
            placeholder="Nhập tin nhắn..."
            placeholderTextColor={colors.textSecondary}
            value={inputText}
            onChangeText={handleTyping}
            multiline
          />
          
          {inputText.trim() ? (
            <TouchableOpacity 
              style={[styles.sendButton, { backgroundColor: colors.tint }]}
              onPress={sendMessage}
              disabled={sending}
            >
              <Ionicons name="send" size={20} color="#fff" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.moreButton}>
              <Ionicons name="happy" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
    </>
  );
};

export default ChatDetailScreen;

// Styles giữ nguyên
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  userInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  userAvatar: {
    marginRight: 12,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerAvatarText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
  },
  userStatus: {
    fontSize: 12,
  },
  headerActions: {
    flexDirection: 'row',
  },
  headerButton: {
    padding: 8,
  },
  messagesList: {
    paddingHorizontal: 12,
    paddingVertical: 16,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  myMessageRow: {
    justifyContent: 'flex-end',
  },
  otherMessageRow: {
    justifyContent: 'flex-start',
  },
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
  avatarText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  avatarPlaceholder: {
    width: 44,
  },
  messageBubble: {
    maxWidth: '70%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
  },
  myMessage: {
    borderBottomRightRadius: 4,
  },
  otherMessage: {
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
    gap: 4,
  },
  messageTime: {
    fontSize: 10,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  attachButton: {
    padding: 8,
  },
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
  moreButton: {
    padding: 8,
  },
});