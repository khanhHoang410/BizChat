import { Colors } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
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

// Định nghĩa type cho Conversation
type Conversation = {
  id: string;
  name: string;
  avatar?: string;
  lastMessage: string;
  timestamp: string;
  unreadCount: number;
  status: 'online' | 'offline' | 'away' | null;
  type: 'private' | 'group';
  members?: number;
  lastMessageTime: string;
};

const HomeScreen = () => {
  const router = useRouter();
  const scheme = useColorScheme();
  const colors = Colors['light'];
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Fetch current user
  const fetchCurrentUser = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await fetch('http://192.168.1.75:3001/api/auth/profile', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setCurrentUser(data.user);
    } catch (error) {
      console.error('Fetch current user error:', error);
    }
  };

  // Fetch conversations
  const fetchConversations = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await fetch('http://192.168.1.75:3001/api/chat/conversations', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      
      // Format data từ API
      const formatted = (data.conversations || []).map((conv: any) => ({
        id: conv.id,
        name: conv.name,
        avatar: conv.avatar,
        lastMessage: conv.lastMessage || 'Chưa có tin nhắn',
        timestamp: formatTimeAgo(conv.lastActivity),
        unreadCount: conv.unreadCount || 0,
        status: conv.status || null,
        type: conv.type,
        members: conv.members,
        lastMessageTime: conv.lastActivity
      }));
      
      setConversations(formatted);
    } catch (error) {
      console.error('Fetch conversations error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Format thời gian
  const formatTimeAgo = (dateString: string) => {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000); // seconds
    
    if (diff < 60) return 'Vừa xong';
    if (diff < 3600) return `${Math.floor(diff / 60)} phút`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} giờ`;
    if (diff < 604800) return `${Math.floor(diff / 86400)} ngày`;
    
    return date.toLocaleDateString('vi-VN');
  };

  // Refresh data
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchConversations();
  }, []);

  // Lắng nghe tin nhắn mới qua socket
  useEffect(() => {
    const socket = socketService.getSocket();
    if (socket) {
      socket.on('receive_message', (data: any) => {
        // Cập nhật conversation khi có tin nhắn mới
        fetchConversations();
      });

      socket.on('user_status_change', (data: any) => {
        // Cập nhật status khi user online/offline
        setConversations(prev => prev.map(conv => 
          conv.type === 'private' && conv.id === data.userId
            ? { ...conv, status: data.status }
            : conv
        ));
      });
    }

    return () => {
      if (socket) {
        socket.off('receive_message');
        socket.off('user_status_change');
      }
    };
  }, []);

  // Load data khi focus vào màn hình
  useFocusEffect(
    useCallback(() => {
      fetchCurrentUser();
      fetchConversations();
    }, [])
  );

  // Filter conversations
  const filteredConversations = conversations.filter(conv =>
    conv.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Render conversation item
  const renderConversation = ({ item }: { item: Conversation }) => (
    <TouchableOpacity
      style={[styles.conversationItem, { borderBottomColor: colors.borderColor }]}
      onPress={() => router.push(`/chat/${item.id}?type=${item.type}`)}
      activeOpacity={0.7}
    >
      {/* Avatar */}
      <View style={styles.avatarContainer}>
        {item.avatar ? (
          <Image source={{ uri: item.avatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, { backgroundColor: colors.tint + '20' }]}>
            <Text style={[styles.avatarText, { color: colors.tint }]}>
              {item.name.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        
        {/* Status dot - chỉ cho private chat */}
        {item.type === 'private' && item.status && (
          <View
            style={[
              styles.statusDot,
              {
                backgroundColor:
                  item.status === 'online'
                    ? colors.onlineStatus
                    : item.status === 'away'
                    ? colors.warning
                    : colors.offlineStatus,
                borderColor: colors.background,
              },
            ]}
          />
        )}
        
        {/* Group badge */}
        {item.type === 'group' && (
          <View style={[styles.groupBadge, { 
            backgroundColor: colors.secondaryTint,
            borderColor: colors.background,
          }]}>
            <Ionicons name="people" size={10} color="#fff" />
          </View>
        )}
      </View>

      {/* Content */}
      <View style={styles.conversationContent}>
        <View style={styles.conversationHeader}>
          <Text style={[styles.conversationName, { color: colors.text }]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={[styles.timestamp, { color: colors.textSecondary }]}>
            {item.timestamp}
          </Text>
        </View>

        <View style={styles.conversationFooter}>
          <Text style={[styles.lastMessage, { color: colors.textSecondary }]} numberOfLines={1}>
            {item.lastMessage}
          </Text>
          
          <View style={styles.rightFooter}>
            {item.type === 'group' && item.members && (
              <View style={styles.memberCount}>
                <Ionicons name="person-outline" size={12} color={colors.textSecondary} />
                <Text style={[styles.memberCountText, { color: colors.textSecondary }]}>
                  {item.members}
                </Text>
              </View>
            )}
            
            {item.unreadCount > 0 && (
              <View style={[styles.unreadBadge, { backgroundColor: colors.tint }]}>
                <Text style={styles.unreadText}>
                  {item.unreadCount > 99 ? '99+' : item.unreadCount}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  // Header với search bar
  const renderHeader = () => (
    <View style={[styles.header, { backgroundColor: colors.background }]}>
      <View style={styles.headerTop}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>BizChat</Text>
        <TouchableOpacity 
          onPress={() => router.push('/profile')}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          {currentUser?.avatar ? (
            <Image source={{ uri: currentUser.avatar }} style={styles.headerAvatar} />
          ) : (
            <View style={[styles.headerAvatar, { backgroundColor: colors.tint + '20' }]}>
              <Text style={[styles.headerAvatarText, { color: colors.tint }]}>
                {currentUser?.name?.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={[styles.searchContainer, { backgroundColor: colors.backgroundElement }]}>
        <Ionicons name="search" size={20} color={colors.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Tìm kiếm cuộc trò chuyện..."
          placeholderTextColor={colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  // Empty state
  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons 
        name={searchQuery ? "search-outline" : "chatbubbles-outline"} 
        size={60} 
        color={colors.textSecondary} 
      />
      <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
        {searchQuery 
          ? `Không tìm thấy "${searchQuery}"`
          : 'Chưa có cuộc trò chuyện nào'}
      </Text>
      {!searchQuery && (
        <TouchableOpacity
          style={[styles.startButton, { backgroundColor: colors.tint }]}
          onPress={() => router.push('/contacts')}
        >
          <Text style={styles.startButtonText}>Bắt đầu chat mới</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  if (loading && !refreshing) {
    return (
      <View style={[styles.container, styles.centerContent, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} />
      
      <FlatList
        data={filteredConversations}
        keyExtractor={(item) => item.id}
        renderItem={renderConversation}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.tint]}
            tintColor={colors.tint}
          />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={filteredConversations.length === 0 ? { flex: 1 } : undefined}
      />

      {/* FAB */}
      {!searchQuery && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: colors.tint }]}
          onPress={() => router.push('/contacts')}
          activeOpacity={0.8}
        >
          <Ionicons name="chatbubble" size={24} color="#fff" />
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
};

export default HomeScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 44,
    borderRadius: 22,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    padding: 0,
  },
  conversationItem: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  statusDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
  },
  groupBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  conversationContent: {
    flex: 1,
    justifyContent: 'center',
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  conversationName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  timestamp: {
    fontSize: 12,
  },
  conversationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMessage: {
    fontSize: 14,
    flex: 1,
    marginRight: 8,
  },
  rightFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  memberCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  memberCountText: {
    fontSize: 11,
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  startButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
});