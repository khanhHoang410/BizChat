import { Colors } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Conversation = {
  id: string;
  name: string;
  avatar: string | null;
  lastMessage: string;
  timestamp: string;
  unreadCount: number;
  status: 'online' | 'offline' | 'away' | null;
  type: 'private' | 'group';
  members?: number;
};

const MOCK_CONVERSATIONS: Conversation[] = [
  {
    id: '1',
    name: 'Nguyễn Văn A',
    avatar: null,
    lastMessage: 'Chào bạn, khỏe không?',
    timestamp: '5 phút',
    unreadCount: 2,
    status: 'online',
    type: 'private',
  },
  {
    id: '2',
    name: 'Trần Thị B',
    avatar: null,
    lastMessage: 'Hẹn gặp bạn lúc 3h',
    timestamp: '1 giờ',
    unreadCount: 0,
    status: 'offline',
    type: 'private',
  },
  {
    id: '3',
    name: 'Nhóm BizChat',
    avatar: null,
    lastMessage: 'Bạn đã được thêm vào nhóm',
    timestamp: '2 giờ',
    unreadCount: 5,
    status: null,
    type: 'group',
    members: 8,
  },
  {
    id: '4',
    name: 'Lê Văn C',
    avatar: null,
    lastMessage: 'Ok, tôi sẽ gửi file cho bạn',
    timestamp: 'hôm qua',
    unreadCount: 0,
    status: 'away',
    type: 'private',
  },
  {
    id: '5',
    name: 'Phòng Kỹ thuật',
    avatar: null,
    lastMessage: 'Họp lúc 10h sáng mai',
    timestamp: 'hôm qua',
    unreadCount: 1,
    status: null,
    type: 'group',
    members: 12,
  },
];

// Màu avatar dựa trên tên
const AVATAR_COLORS = ['#667eea', '#764ba2', '#f093fb', '#4facfe', '#43e97b', '#fa709a', '#fee140'];
const getAvatarColor = (name: string) => AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];

const ConversationItem = React.memo(({
  item,
  onPress,
}: {
  item: Conversation;
  onPress: () => void;
}) => {
  const formatTimestamp = (ts: string) => {
    if (ts === 'hôm qua') return 'Hôm qua';
    return ts;
  };

  const avatarColor = getAvatarColor(item.name);
  const hasUnread = item.unreadCount > 0;

  return (
    <TouchableOpacity style={styles.item} onPress={onPress} activeOpacity={0.6}>
      {/* Avatar */}
      <View style={styles.avatarWrap}>
        {item.avatar ? (
          <Image source={{ uri: item.avatar }} style={styles.avatarImg} />
        ) : (
          <LinearGradient
            colors={[avatarColor, avatarColor + 'bb']}
            style={styles.avatarGrad}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.avatarLetter}>{item.name.charAt(0).toUpperCase()}</Text>
          </LinearGradient>
        )}

        {/* Status */}
        {item.type === 'private' && item.status === 'online' && (
          <View style={styles.onlineDot} />
        )}
        {item.type === 'group' && (
          <View style={styles.groupBadge}>
            <Ionicons name="people" size={9} color="#fff" />
          </View>
        )}
      </View>

      {/* Content */}
      <View style={styles.itemBody}>
        <View style={styles.itemTop}>
          <Text style={[styles.itemName, hasUnread && styles.itemNameBold]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={[styles.itemTime, hasUnread && styles.itemTimePurple]}>
            {formatTimestamp(item.timestamp)}
          </Text>
        </View>

        <View style={styles.itemBottom}>
          <Text style={[styles.itemMsg, hasUnread && styles.itemMsgDark]} numberOfLines={1}>
            {item.lastMessage}
          </Text>
          {hasUnread ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {item.unreadCount > 99 ? '99+' : item.unreadCount}
              </Text>
            </View>
          ) : item.type === 'group' && item.members ? (
            <View style={styles.memberPill}>
              <Ionicons name="person-outline" size={10} color="#aaa" />
              <Text style={styles.memberText}>{item.members}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
});

const ListHeader = React.memo(({
  searchQuery,
  onSearchChange,
  onNewChat,
}: {
  searchQuery: string;
  onSearchChange: (t: string) => void;
  onNewChat: () => void;
}) => (
  <View>
    {/* Header */}
    <LinearGradient
      colors={['#667eea', '#764ba2']}
      style={styles.header}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      {/* Decorative circles */}
      <View style={styles.deco1} />
      <View style={styles.deco2} />

      <View style={styles.headerRow}>
        <View>
          <Text style={styles.headerSub}>BizChat</Text>
          <Text style={styles.headerTitle}>Tin nhắn</Text>
        </View>
        <TouchableOpacity style={styles.newBtn} onPress={onNewChat}>
          <Ionicons name="create-outline" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Search inside gradient */}
      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={16} color="#667eea" />
        <TextInput
          style={styles.searchInput}
          placeholder="Tìm kiếm..."
          placeholderTextColor="#bbb"
          value={searchQuery}
          onChangeText={onSearchChange}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>
    </LinearGradient>

    {/* Section label */}
    {!searchQuery && (
      <Text style={styles.sectionLabel}>Gần đây</Text>
    )}
  </View>
));

const EmptyState = React.memo(({
  searchQuery,
  onStartChat,
}: {
  searchQuery: string;
  onStartChat: () => void;
}) => (
  <View style={styles.empty}>
    <View style={styles.emptyIcon}>
      <Ionicons
        name={searchQuery ? 'search-outline' : 'chatbubble-ellipses-outline'}
        size={40}
        color="#667eea"
      />
    </View>
    <Text style={styles.emptyTitle}>
      {searchQuery ? 'Không tìm thấy kết quả' : 'Chưa có tin nhắn'}
    </Text>
    <Text style={styles.emptyDesc}>
      {searchQuery
        ? `Không có cuộc trò chuyện nào với "${searchQuery}"`
        : 'Bắt đầu trò chuyện với bạn bè và đồng nghiệp'}
    </Text>
    {!searchQuery && (
      <TouchableOpacity style={styles.emptyBtn} onPress={onStartChat} activeOpacity={0.85}>
        <LinearGradient colors={['#667eea', '#764ba2']} style={styles.emptyBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.emptyBtnText}>Tạo cuộc trò chuyện</Text>
        </LinearGradient>
      </TouchableOpacity>
    )}
  </View>
));

const Index = () => {
  const router = useRouter();
  const scheme = useColorScheme();
  const colors = Colors['light'];
  const [refreshing, setRefreshing] = useState(false);
  const [conversations] = useState<Conversation[]>(MOCK_CONVERSATIONS);
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    return conversations.filter(c =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
    );
  }, [conversations, searchQuery]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  }, []);

  const navigateToChat = useCallback((item: Conversation) => {
    // router.push({ pathname: '/chat/[id]', params: { id: item.id } });
  }, []);

  const renderItem = useCallback(({ item }: { item: Conversation }) => (
    <ConversationItem item={item} onPress={() => navigateToChat(item)} />
  ), [navigateToChat]);

  const renderSeparator = useCallback(() => <View style={styles.separator} />, []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" />

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ItemSeparatorComponent={renderSeparator}
        ListHeaderComponent={
          <ListHeader
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onNewChat={() => router.push('/contacts')}
          />
        }
        ListEmptyComponent={
          <EmptyState
            searchQuery={searchQuery}
            onStartChat={() => router.push('/contacts')}
          />
        }
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#667eea"
          />
        }
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={true}
        contentContainerStyle={filtered.length === 0 ? { flex: 1 } : { paddingBottom: 32 }}
      />
    </SafeAreaView>
  );
};

export default Index;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },

  // ─── Header ────────────────────────────────────────────────
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28,
    overflow: 'hidden',
  },
  deco1: {
    position: 'absolute',
    top: -40,
    right: -30,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  deco2: {
    position: 'absolute',
    bottom: -20,
    left: 60,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  headerSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 30,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.5,
  },
  newBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 44,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    padding: 0,
  },

  // ─── Section label ─────────────────────────────────────────
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#aaa',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 8,
  },

  // ─── Conversation item ─────────────────────────────────────
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  separator: {
    height: 1,
    backgroundColor: '#f5f5f5',
    marginLeft: 88,
  },
  avatarWrap: {
    position: 'relative',
    marginRight: 14,
  },
  avatarGrad: {
    width: 54,
    height: 54,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImg: {
    width: 54,
    height: 54,
    borderRadius: 18,
  },
  avatarLetter: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#22c55e',
    borderWidth: 2.5,
    borderColor: '#fff',
  },
  groupBadge: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#764ba2',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  itemBody: {
    flex: 1,
    gap: 4,
  },
  itemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#222',
    flex: 1,
    marginRight: 8,
  },
  itemNameBold: {
    fontWeight: '700',
    color: '#111',
  },
  itemTime: {
    fontSize: 12,
    color: '#bbb',
  },
  itemTimePurple: {
    color: '#667eea',
    fontWeight: '600',
  },
  itemBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemMsg: {
    fontSize: 13,
    color: '#bbb',
    flex: 1,
    marginRight: 8,
  },
  itemMsgDark: {
    color: '#666',
    fontWeight: '500',
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  memberPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  memberText: {
    fontSize: 11,
    color: '#ccc',
  },

  // ─── Empty State ───────────────────────────────────────────
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingBottom: 60,
  },
  emptyIcon: {
    width: 88,
    height: 88,
    borderRadius: 28,
    backgroundColor: '#f0f4ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#222',
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 14,
    color: '#aaa',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
  },
  emptyBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  emptyBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  emptyBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
