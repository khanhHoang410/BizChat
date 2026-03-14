import { Colors } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
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
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Định nghĩa type cho User
type User = {
  _id: string;
  name: string;
  email: string;
  avatar?: string;
  status: 'online' | 'offline' | 'away';
  lastSeen?: string;
};

const contacts = () => {
  const router = useRouter();
  const scheme = useColorScheme();
  const colors = Colors['light'];
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'online'>('all');

  // Fetch danh sách users
const fetchUsers = async () => {
  try {
    const token = await AsyncStorage.getItem('userToken');
      console.log('🔑 Token gốc:', token);
    
    const url = filter === 'online' 
      ? 'http://192.168.1.75:3001/api/users/online'
      : `http://192.168.1.75:3001/api/users${searchQuery ? `?search=${searchQuery}` : ''}`;
    
    console.log('📡 Fetching from:', url); // Debug URL
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    console.log('📥 Response status:', response.status); // Debug status
    
    const data = await response.json();
    console.log('📦 Data received:', data); // Debug dữ liệu trả về
    
    if (filter === 'online') {
      // Kiểm tra cấu trúc data trả về
      console.log('Online users data:', data.onlineUsers);
      setUsers(data.onlineUsers || []);
    } else {
      console.log('All users data:', data.users);
      setUsers(data.users || []);
    }
  } catch (error) {
    console.error('❌ Fetch users error:', error);
  } finally {
    setLoading(false);
    setRefreshing(false);
  }
};
  useEffect(() => {
    fetchUsers();
  }, [filter]); // Gọi lại khi filter thay đổi

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (filter === 'all') {
        fetchUsers();
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchUsers();
  }, []);

  // Format last seen
  const formatLastSeen = (lastSeen?: string) => {
    if (!lastSeen) return '';
    const date = new Date(lastSeen);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000 / 60); // phút
    
    if (diff < 1) return 'Vừa xong';
    if (diff < 60) return `${diff} phút trước`;
    if (diff < 1440) return `${Math.floor(diff / 60)} giờ trước`;
    return date.toLocaleDateString('vi-VN');
  };

  // Render từng user item
  const renderUser = ({ item }: { item: User }) => (
    <TouchableOpacity
      style={[styles.userItem, { borderBottomColor: colors.borderColor }]}
      onPress={() => router.push(`/chat/${item._id}?type=private`)}
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
        
        {/* Status dot */}
        <View style={[
          styles.statusDot,
          { 
            backgroundColor: 
              item.status === 'online' 
                ? colors.onlineStatus 
                : item.status === 'away'
                ? colors.warning
                : colors.offlineStatus,
            borderColor: colors.background,
          }
        ]} />
      </View>

      {/* Info */}
      <View style={styles.userInfo}>
        <View style={styles.userHeader}>
          <Text style={[styles.userName, { color: colors.text }]} numberOfLines={1}>
            {item.name}
          </Text>
          {item.status === 'online' && (
            <View style={[styles.onlineBadge, { backgroundColor: colors.onlineStatus + '20' }]}>
              <Text style={[styles.onlineText, { color: colors.onlineStatus }]}>Online</Text>
            </View>
          )}
        </View>
        
        <Text style={[styles.userEmail, { color: colors.textSecondary }]} numberOfLines={1}>
          {item.email}
        </Text>
        
        {item.status !== 'online' && item.lastSeen && (
          <Text style={[styles.lastSeen, { color: colors.textSecondary }]}>
            Hoạt động: {formatLastSeen(item.lastSeen)}
          </Text>
        )}
      </View>

      {/* Chat button */}
      <View style={styles.chatButton}>
        <Ionicons name="chatbubble-outline" size={22} color={colors.tint} />
      </View>
    </TouchableOpacity>
  );

  // Render header với tabs và search
  const renderHeader = () => (
    <View style={[styles.header, { backgroundColor: colors.background }]}>
      <View style={styles.headerTop}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Contacts</Text>
        <TouchableOpacity 
          onPress={() => router.push('/profile')}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="person-circle-outline" size={28} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={[styles.searchContainer, { backgroundColor: colors.backgroundElement }]}>
        <Ionicons name="search" size={20} color={colors.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Tìm kiếm theo tên hoặc email..."
          placeholderTextColor={colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter tabs */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[
            styles.filterTab,
            filter === 'all' && { borderBottomColor: colors.tint, borderBottomWidth: 2 }
          ]}
          onPress={() => setFilter('all')}
        >
          <Text style={[
            styles.filterText,
            { color: filter === 'all' ? colors.tint : colors.textSecondary }
          ]}>
            Tất cả
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.filterTab,
            filter === 'online' && { borderBottomColor: colors.tint, borderBottomWidth: 2 }
          ]}
          onPress={() => setFilter('online')}
        >
          <Text style={[
            styles.filterText,
            { color: filter === 'online' ? colors.tint : colors.textSecondary }
          ]}>
            Đang online
          </Text>
        </TouchableOpacity>
      </View>
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
        data={users}
        keyExtractor={(item) => item._id}
        renderItem={renderUser}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons 
              name={searchQuery ? "search-outline" : "people-outline"} 
              size={60} 
              color={colors.textSecondary} 
            />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {searchQuery 
                ? `Không tìm thấy "${searchQuery}"`
                : filter === 'online'
                ? 'Không có ai đang online'
                : 'Chưa có người dùng nào'}
            </Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.tint]}
            tintColor={colors.tint}
          />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={users.length === 0 ? { flex: 1 } : undefined}
      />
    </SafeAreaView>
  );
};

export default contacts;

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
    paddingBottom: 8,
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 46,
    borderRadius: 23,
    gap: 8,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    padding: 0,
  },
  filterContainer: {
    flexDirection: 'row',
    gap: 24,
    marginTop: 4,
  },
  filterTab: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  filterText: {
    fontSize: 15,
    fontWeight: '500',
  },
  userItem: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  statusDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  userInfo: {
    flex: 1,
    marginRight: 12,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  onlineBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  onlineText: {
    fontSize: 10,
    fontWeight: '500',
  },
  userEmail: {
    fontSize: 13,
    marginBottom: 2,
  },
  lastSeen: {
    fontSize: 11,
  },
  chatButton: {
    padding: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 16,
  },
});