import { Colors } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
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

const BASE_URL = 'http://103.82.25.230:3001';

type Group = {
  _id: string;
  name: string;
  description?: string;
  avatar?: string;
  members: { user: { _id: string; name: string; avatar?: string }; role: string }[];
  admins: { _id: string; name: string }[];
  createdBy: { _id: string; name: string };
  settings: { isPrivate: boolean };
  updatedAt: string;
};

const GroupsScreen = () => {
  const router = useRouter();
  const scheme = useColorScheme();
  const colors = Colors['light'];

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchGroups = async (search = '') => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const url = `${BASE_URL}/api/groups${search ? `?search=${search}` : ''}`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      setGroups(data.groups || []);
    } catch (error) {
      console.error('Fetch groups error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchGroups(searchQuery);
    }, [])
  );

  // Debounce search
  React.useEffect(() => {
    const timer = setTimeout(() => fetchGroups(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchGroups(searchQuery);
  }, [searchQuery]);

  const renderGroupItem = ({ item }: { item: Group }) => {
    const memberCount = item.members?.length || 0;

    return (
      <TouchableOpacity
        style={[styles.groupItem, { borderBottomColor: colors.borderColor }]}
        onPress={() => router.push(`/chat/${item._id}?type=group` as any)}
        onLongPress={() => router.push(`/group/${item._id}` as any)}
        activeOpacity={0.7}
      >
        {/* Avatar */}
        <View style={styles.avatarContainer}>
          {item.avatar ? (
            <Image source={{ uri: item.avatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, { backgroundColor: colors.secondaryTint + '30' }]}>
              <Ionicons name="people" size={26} color={colors.secondaryTint} />
            </View>
          )}
          {item.settings?.isPrivate && (
            <View style={[styles.privateBadge, { backgroundColor: colors.tint, borderColor: colors.background }]}>
              <Ionicons name="lock-closed" size={8} color="#fff" />
            </View>
          )}
        </View>

        {/* Info */}
        <View style={styles.groupInfo}>
          <View style={styles.groupHeader}>
            <Text style={[styles.groupName, { color: colors.text }]} numberOfLines={1}>
              {item.name}
            </Text>
          </View>
          <Text style={[styles.memberCount, { color: colors.textSecondary }]}>
            {memberCount} thành viên
          </Text>
          {item.description ? (
            <Text style={[styles.description, { color: colors.textSecondary }]} numberOfLines={1}>
              {item.description}
            </Text>
          ) : null}
        </View>

        {/* Arrow */}
        <TouchableOpacity
          style={styles.detailButton}
          onPress={() => router.push(`/group/${item._id}` as any)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="information-circle-outline" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const renderHeader = () => (
    <View style={[styles.header, { backgroundColor: colors.background }]}>
      <View style={styles.headerTop}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Nhóm</Text>
        <TouchableOpacity
          style={[styles.createButton, { backgroundColor: colors.tint }]}
          onPress={() => router.push('/group/create' as any)}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.createButtonText}>Tạo nhóm</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={[styles.searchContainer, { backgroundColor: colors.backgroundElement }]}>
        <Ionicons name="search" size={20} color={colors.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Tìm kiếm nhóm..."
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

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons
        name={searchQuery ? 'search-outline' : 'people-outline'}
        size={64}
        color={colors.textSecondary}
      />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>
        {searchQuery ? `Không tìm thấy "${searchQuery}"` : 'Chưa có nhóm nào'}
      </Text>
      {!searchQuery && (
        <>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            Tạo nhóm để bắt đầu trò chuyện cùng nhiều người
          </Text>
          <TouchableOpacity
            style={[styles.emptyButton, { backgroundColor: colors.tint }]}
            onPress={() => router.push('/group/create' as any)}
          >
            <Text style={styles.emptyButtonText}>Tạo nhóm đầu tiên</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );

  if (loading && !refreshing) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} />

      <FlatList
        data={groups}
        keyExtractor={(item) => item._id}
        renderItem={renderGroupItem}
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
        contentContainerStyle={groups.length === 0 ? { flex: 1 } : undefined}
      />
    </SafeAreaView>
  );
};

export default GroupsScreen;

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
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
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 4,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 46,
    borderRadius: 23,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    padding: 0,
  },
  groupItem: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  privateBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
  },
  groupInfo: {
    flex: 1,
    marginRight: 8,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  groupName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  memberCount: {
    fontSize: 13,
    marginBottom: 2,
  },
  description: {
    fontSize: 12,
  },
  detailButton: {
    padding: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingBottom: 80,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
    lineHeight: 20,
  },
  emptyButton: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 24,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});