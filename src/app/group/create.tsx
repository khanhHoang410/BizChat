import { Colors } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { API_BASE } from '@/constants/api';
import { useColorScheme } from '@/hooks/use-color-scheme';

const BASE_URL = API_BASE;

type User = {
  _id: string;
  name: string;
  email: string;
  avatar?: string;
  status: 'online' | 'offline' | 'away';
};

const CreateGroupScreen = () => {
  const router = useRouter();
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [creating, setCreating] = useState(false);

  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(true);

  const fetchUsers = async (search = '') => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const url = `${BASE_URL}/api/users${search ? `?search=${search}` : '?limit=50'}`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      setUsers(data.users || []);
    } catch (error) {
      console.error('Fetch users error:', error);
    } finally {
      setLoadingUsers(false);
    }
  };
  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => fetchUsers(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const toggleUser = (user: User) => {
    setSelectedUsers(prev =>
      prev.some(u => u._id === user._id)
        ? prev.filter(u => u._id !== user._id)
        : [...prev, user]
    );
  };

  const isSelected = (userId: string) => selectedUsers.some(u => u._id === userId);

  const handleCreate = async () => {
    if (!groupName.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập tên nhóm');
      return;
    }
    if (selectedUsers.length === 0) {
      Alert.alert('Lỗi', 'Vui lòng chọn ít nhất 1 thành viên');
      return;
    }

    setCreating(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await fetch(`${BASE_URL}/api/groups`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: groupName.trim(),
          description: description.trim(),
          memberIds: selectedUsers.map(u => u._id),
          isPrivate,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert('✅ Thành công', `Nhóm "${groupName}" đã được tạo!`, [
          {
            text: 'Vào nhóm',
            onPress: () => router.replace(`/chat/${data.group._id}?type=group` as any),
          },
        ]);
      } else {
        Alert.alert('Lỗi', data.error || 'Tạo nhóm thất bại');
      }
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể kết nối đến server');
    } finally {
      setCreating(false);
    }
  };

  const renderUserItem = ({ item }: { item: User }) => {
    const selected = isSelected(item._id);

    return (
      <TouchableOpacity
        style={[
          styles.userItem,
          {
            borderBottomColor: colors.borderColor,
            backgroundColor: selected ? colors.tint + '10' : 'transparent',
          },
        ]}
        onPress={() => toggleUser(item)}
        activeOpacity={0.7}
      >
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
          <View
            style={[
              styles.statusDot,
              {
                backgroundColor:
                  item.status === 'online' ? colors.onlineStatus : colors.offlineStatus,
                borderColor: selected ? colors.tint + '10' : colors.background,
              },
            ]}
          />
        </View>

        <View style={styles.userInfo}>
          <Text style={[styles.userName, { color: colors.text }]}>{item.name}</Text>
          <Text style={[styles.userEmail, { color: colors.textSecondary }]} numberOfLines={1}>
            {item.email}
          </Text>
        </View>

        <View
          style={[
            styles.checkbox,
            {
              backgroundColor: selected ? colors.tint : 'transparent',
              borderColor: selected ? colors.tint : colors.borderColor,
            },
          ]}
        >
          {selected && <Ionicons name="checkmark" size={14} color="#fff" />}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <>
    <Stack.Screen options={{ headerShown: false }} />
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.borderColor }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Tạo nhóm mới</Text>
        <TouchableOpacity
          style={[
            styles.createBtn,
            {
              backgroundColor:
                groupName.trim() && selectedUsers.length > 0 ? colors.tint : colors.borderColor,
            },
          ]}
          onPress={handleCreate}
          disabled={creating || !groupName.trim() || selectedUsers.length === 0}
        >
          {creating ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.createBtnText}>Tạo</Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Group Info */}
          <View style={[styles.section, { borderBottomColor: colors.borderColor }]}>
            {/* Avatar placeholder */}
            <View style={styles.avatarPlaceholderRow}>
              <TouchableOpacity
                style={[styles.avatarPlaceholder, { backgroundColor: colors.backgroundElement }]}
              >
                <Ionicons name="camera-outline" size={28} color={colors.textSecondary} />
                <Text style={[styles.avatarPlaceholderText, { color: colors.textSecondary }]}>
                  Ảnh nhóm
                </Text>
              </TouchableOpacity>
            </View>

            {/* Group name */}
            <View style={[styles.inputRow, { borderColor: colors.borderColor }]}>
              <Ionicons name="people-outline" size={20} color={colors.textSecondary} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="Tên nhóm (bắt buộc)"
                placeholderTextColor={colors.textSecondary}
                value={groupName}
                onChangeText={setGroupName}
                maxLength={50}
              />
              <Text style={[styles.charCount, { color: colors.textSecondary }]}>
                {groupName.length}/50
              </Text>
            </View>

            {/* Description */}
            <View style={[styles.inputRow, { borderColor: colors.borderColor }]}>
              <Ionicons name="document-text-outline" size={20} color={colors.textSecondary} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="Mô tả nhóm (tùy chọn)"
                placeholderTextColor={colors.textSecondary}
                value={description}
                onChangeText={setDescription}
                maxLength={200}
                multiline
              />
            </View>

            {/* Private toggle */}
            <View style={[styles.settingRow, { borderTopColor: colors.borderColor }]}>
              <View style={styles.settingLeft}>
                <Ionicons name="lock-closed-outline" size={20} color={colors.tint} />
                <View style={styles.settingTexts}>
                  <Text style={[styles.settingLabel, { color: colors.text }]}>Nhóm riêng tư</Text>
                  <Text style={[styles.settingDesc, { color: colors.textSecondary }]}>
                    Chỉ admin mới có thể mời thành viên
                  </Text>
                </View>
              </View>
              <Switch
                value={isPrivate}
                onValueChange={setIsPrivate}
                trackColor={{ false: colors.borderColor, true: colors.tint }}
                thumbColor="#fff"
              />
            </View>
          </View>

          {/* Selected members preview */}
          {selectedUsers.length > 0 && (
            <View style={[styles.selectedSection, { borderBottomColor: colors.borderColor }]}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                ĐÃ CHỌN ({selectedUsers.length})
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectedList}>
                {selectedUsers.map(user => (
                  <TouchableOpacity
                    key={user._id}
                    style={styles.selectedItem}
                    onPress={() => toggleUser(user)}
                  >
                    <View style={styles.selectedAvatarContainer}>
                      {user.avatar ? (
                        <Image source={{ uri: user.avatar }} style={styles.selectedAvatar} />
                      ) : (
                        <View style={[styles.selectedAvatar, { backgroundColor: colors.tint + '20' }]}>
                          <Text style={[styles.selectedAvatarText, { color: colors.tint }]}>
                            {user.name.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <View style={[styles.removeIcon, { backgroundColor: colors.error }]}>
                        <Ionicons name="close" size={10} color="#fff" />
                      </View>
                    </View>
                    <Text style={[styles.selectedName, { color: colors.textSecondary }]} numberOfLines={1}>
                      {user.name.split(' ').pop()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Members search */}
          <View style={styles.membersSection}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              THÊM THÀNH VIÊN
            </Text>
            <View style={[styles.searchBar, { backgroundColor: colors.backgroundElement }]}>
              <Ionicons name="search" size={18} color={colors.textSecondary} />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder="Tìm kiếm người dùng..."
                placeholderTextColor={colors.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>

            {loadingUsers ? (
              <ActivityIndicator style={{ marginTop: 20 }} color={colors.tint} />
            ) : (
              <FlatList
                data={users}
                keyExtractor={item => item._id}
                renderItem={renderUserItem}
                scrollEnabled={false}
                ListEmptyComponent={
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                    Không tìm thấy người dùng
                  </Text>
                }
              />
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
    </>
  );
};

export default CreateGroupScreen;

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: { padding: 4, marginRight: 12 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700' },
  createBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  section: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  avatarPlaceholderRow: { alignItems: 'center', marginBottom: 16 },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  avatarPlaceholderText: { fontSize: 11 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    gap: 10,
  },
  input: { flex: 1, fontSize: 15, padding: 0 },
  charCount: { fontSize: 12 },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 14,
    borderTopWidth: 1,
    marginTop: 4,
  },
  settingLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  settingTexts: { flex: 1 },
  settingLabel: { fontSize: 15, fontWeight: '500' },
  settingDesc: { fontSize: 12, marginTop: 2 },
  selectedSection: { paddingVertical: 12, borderBottomWidth: 1 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  selectedList: { paddingHorizontal: 12 },
  selectedItem: { alignItems: 'center', marginHorizontal: 6, width: 60 },
  selectedAvatarContainer: { position: 'relative', marginBottom: 4 },
  selectedAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedAvatarText: { fontSize: 20, fontWeight: 'bold' },
  removeIcon: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedName: { fontSize: 11, textAlign: 'center' },
  membersSection: { paddingTop: 12 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 14,
    height: 40,
    borderRadius: 20,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  userItem: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  avatarContainer: { position: 'relative', marginRight: 12 },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: 'bold' },
  statusDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 2,
  },
  userInfo: { flex: 1 },
  userName: { fontSize: 15, fontWeight: '500', marginBottom: 2 },
  userEmail: { fontSize: 13 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: 20,
    fontSize: 14,
  },
});