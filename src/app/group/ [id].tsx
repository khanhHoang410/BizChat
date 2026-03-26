import { Colors } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    Modal,
    ScrollView,
    StatusBar,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
    useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const BASE_URL = 'http://103.82.25.230:3001';

type Member = {
  user: {
    _id: string;
    name: string;
    email: string;
    avatar?: string;
    status: 'online' | 'offline' | 'away';
  };
  role: 'admin' | 'moderator' | 'member';
  joinedAt: string;
};

type Group = {
  _id: string;
  name: string;
  description?: string;
  avatar?: string;
  createdBy: { _id: string; name: string };
  admins: { _id: string; name: string }[];
  members: Member[];
  settings: { isPrivate: boolean; allowFiles: boolean; maxMembers: number };
  isActive: boolean;
};

type UserInfo = {
  id: string;
  name: string;
  email: string;
  avatar?: string;
};

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin',
  moderator: 'Mod',
  member: 'Thành viên',
};

const ROLE_COLOR: Record<string, string> = {
  admin: '#E53935',
  moderator: '#FB8C00',
  member: '#43A047',
};

const GroupDetailScreen = () => {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const scheme = useColorScheme();
  const colors = Colors['light'];

  const [group, setGroup] = useState<Group | null>(null);
  const [currentUser, setCurrentUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Edit mode
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editPrivate, setEditPrivate] = useState(false);

  // Add member modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchUsers, setSearchUsers] = useState('');
  const [userResults, setUserResults] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Member options modal
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [showMemberOptions, setShowMemberOptions] = useState(false);

  const getToken = () => AsyncStorage.getItem('userToken');

  const fetchCurrentUser = async () => {
    const token = await getToken();
    const res = await fetch(`${BASE_URL}/api/auth/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setCurrentUser(data.user);
  };

  const fetchGroup = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${BASE_URL}/api/groups/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setGroup(data.group);
        setEditName(data.group.name);
        setEditDesc(data.group.description || '');
        setEditPrivate(data.group.settings?.isPrivate || false);
      }
    } catch (error) {
      console.error('Fetch group error:', error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchCurrentUser();
    fetchGroup();
  }, []);

  // Derived permissions
  const isAdmin = group?.admins?.some(a => a._id === currentUser?.id) || false;
  const isOwner = group?.createdBy?._id === currentUser?.id || false;
  const myRole = group?.members?.find(m => m.user._id === currentUser?.id)?.role || 'member';

  // ─── Update group info ─────────────────────────────────────────────────────
  const handleSaveEdit = async () => {
    if (!editName.trim()) {
      Alert.alert('Lỗi', 'Tên nhóm không được để trống');
      return;
    }
    setSaving(true);
    try {
      const token = await getToken();
      const res = await fetch(`${BASE_URL}/api/groups/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: editName.trim(),
          description: editDesc.trim(),
          settings: { isPrivate: editPrivate },
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setGroup(data.group);
        setEditMode(false);
      } else {
        Alert.alert('Lỗi', data.error);
      }
    } catch {
      Alert.alert('Lỗi', 'Không thể cập nhật thông tin nhóm');
    } finally {
      setSaving(false);
    }
  };

  // ─── Search users to add ───────────────────────────────────────────────────
  const handleSearchUsers = async (query: string) => {
    setSearchUsers(query);
    if (!query.trim()) { setUserResults([]); return; }
    setLoadingUsers(true);
    try {
      const token = await getToken();
      const res = await fetch(`${BASE_URL}/api/users?search=${query}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      // Lọc ra những người chưa ở trong nhóm
      const memberIds = group?.members.map(m => m.user._id) || [];
      setUserResults((data.users || []).filter((u: any) => !memberIds.includes(u._id)));
    } catch {
      setUserResults([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  // ─── Add member ────────────────────────────────────────────────────────────
  const handleAddMember = async (userId: string, userName: string) => {
    try {
      const token = await getToken();
      const res = await fetch(`${BASE_URL}/api/groups/${id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (res.ok) {
        setGroup(data.group);
        setUserResults(prev => prev.filter(u => u._id !== userId));
        Alert.alert('✅ Thành công', `${userName} đã được thêm vào nhóm`);
      } else {
        Alert.alert('Lỗi', data.error);
      }
    } catch {
      Alert.alert('Lỗi', 'Không thể thêm thành viên');
    }
  };

  // ─── Remove member ─────────────────────────────────────────────────────────
  const handleRemoveMember = (member: Member) => {
    Alert.alert(
      'Xóa thành viên',
      `Bạn có chắc muốn xóa ${member.user.name} khỏi nhóm?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await getToken();
              const res = await fetch(`${BASE_URL}/api/groups/${id}/members/${member.user._id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
              });
              const data = await res.json();
              if (res.ok) {
                setGroup(data.group);
                setShowMemberOptions(false);
              } else {
                Alert.alert('Lỗi', data.error);
              }
            } catch {
              Alert.alert('Lỗi', 'Không thể xóa thành viên');
            }
          },
        },
      ]
    );
  };

  // ─── Promote / Demote ──────────────────────────────────────────────────────
  const handlePromote = async (member: Member, newRole: 'admin' | 'moderator') => {
    try {
      const token = await getToken();
      const res = await fetch(`${BASE_URL}/api/groups/${id}/members/${member.user._id}/promote`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json();
      if (res.ok) {
        setGroup(data.group);
        setShowMemberOptions(false);
        Alert.alert('✅ Thành công', `${member.user.name} đã được thăng lên ${ROLE_LABEL[newRole]}`);
      } else {
        Alert.alert('Lỗi', data.error);
      }
    } catch {
      Alert.alert('Lỗi', 'Không thể thay đổi quyền');
    }
  };

  const handleDemote = async (member: Member) => {
    try {
      const token = await getToken();
      const res = await fetch(`${BASE_URL}/api/groups/${id}/members/${member.user._id}/demote`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setGroup(data.group);
        setShowMemberOptions(false);
        Alert.alert('✅ Thành công', `${member.user.name} đã bị hạ xuống Thành viên`);
      } else {
        Alert.alert('Lỗi', data.error);
      }
    } catch {
      Alert.alert('Lỗi', 'Không thể thay đổi quyền');
    }
  };

  // ─── Leave group ───────────────────────────────────────────────────────────
  const handleLeave = () => {
    Alert.alert(
      'Rời nhóm',
      'Bạn có chắc chắn muốn rời khỏi nhóm này?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Rời nhóm',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await getToken();
              const res = await fetch(`${BASE_URL}/api/groups/${id}/leave`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
              });
              const data = await res.json();
              if (res.ok) {
                router.replace('/(tabs)' as any);
              } else {
                Alert.alert('Lỗi', data.error);
              }
            } catch {
              Alert.alert('Lỗi', 'Không thể rời nhóm');
            }
          },
        },
      ]
    );
  };

  // ─── Dissolve group ────────────────────────────────────────────────────────
  const handleDissolve = () => {
    Alert.alert(
      '⚠️ Giải tán nhóm',
      `Bạn có chắc chắn muốn giải tán nhóm "${group?.name}"? Tất cả thành viên sẽ bị xóa và hành động này không thể hoàn tác.`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Giải tán',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await getToken();
              const res = await fetch(`${BASE_URL}/api/groups/${id}/dissolve`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
              });
              const data = await res.json();
              if (res.ok) {
                Alert.alert('✅ Nhóm đã được giải tán', '', [
                  { text: 'OK', onPress: () => router.replace('/(tabs)' as any) },
                ]);
              } else {
                Alert.alert('Lỗi', data.error);
              }
            } catch {
              Alert.alert('Lỗi', 'Không thể giải tán nhóm');
            }
          },
        },
      ]
    );
  };

  // ─── Member options modal ──────────────────────────────────────────────────
  const renderMemberOptions = () => {
    if (!selectedMember) return null;
    const mem = selectedMember;
    const isMemAdmin = mem.role === 'admin';
    const isMemMod = mem.role === 'moderator';
    const isSelf = mem.user._id === currentUser?.id;

    return (
      <Modal
        visible={showMemberOptions}
        transparent
        animationType="slide"
        onRequestClose={() => setShowMemberOptions(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowMemberOptions(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.optionsSheet, { backgroundColor: colors.background }]}>
                {/* Member info */}
                <View style={styles.optionsMemberInfo}>
                  {mem.user.avatar ? (
                    <Image source={{ uri: mem.user.avatar }} style={styles.optionsAvatar} />
                  ) : (
                    <View style={[styles.optionsAvatar, { backgroundColor: colors.tint + '20' }]}>
                      <Text style={[styles.optionsAvatarText, { color: colors.tint }]}>
                        {mem.user.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View>
                    <Text style={[styles.optionsMemberName, { color: colors.text }]}>
                      {mem.user.name}
                    </Text>
                    <View style={[styles.roleBadge, { backgroundColor: ROLE_COLOR[mem.role] + '20' }]}>
                      <Text style={[styles.roleText, { color: ROLE_COLOR[mem.role] }]}>
                        {ROLE_LABEL[mem.role]}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={[styles.optionsDivider, { backgroundColor: colors.borderColor }]} />

                {/* Promote to admin */}
                {isAdmin && !isSelf && !isMemAdmin && (
                  <TouchableOpacity
                    style={styles.optionItem}
                    onPress={() => handlePromote(mem, 'admin')}
                  >
                    <View style={[styles.optionIcon, { backgroundColor: '#E53935' + '20' }]}>
                      <Ionicons name="shield-checkmark-outline" size={20} color="#E53935" />
                    </View>
                    <Text style={[styles.optionText, { color: colors.text }]}>Thăng lên Admin</Text>
                  </TouchableOpacity>
                )}

                {/* Promote to moderator */}
                {isAdmin && !isSelf && !isMemMod && !isMemAdmin && (
                  <TouchableOpacity
                    style={styles.optionItem}
                    onPress={() => handlePromote(mem, 'moderator')}
                  >
                    <View style={[styles.optionIcon, { backgroundColor: '#FB8C00' + '20' }]}>
                      <Ionicons name="star-outline" size={20} color="#FB8C00" />
                    </View>
                    <Text style={[styles.optionText, { color: colors.text }]}>Thăng lên Moderator</Text>
                  </TouchableOpacity>
                )}

                {/* Demote */}
                {isAdmin && !isSelf && (isMemAdmin || isMemMod) && (
                  <TouchableOpacity
                    style={styles.optionItem}
                    onPress={() => handleDemote(mem)}
                  >
                    <View style={[styles.optionIcon, { backgroundColor: '#FB8C00' + '20' }]}>
                      <Ionicons name="arrow-down-circle-outline" size={20} color="#FB8C00" />
                    </View>
                    <Text style={[styles.optionText, { color: colors.text }]}>Hạ xuống Thành viên</Text>
                  </TouchableOpacity>
                )}

                {/* Remove */}
                {isAdmin && !isSelf && (
                  <TouchableOpacity
                    style={styles.optionItem}
                    onPress={() => handleRemoveMember(mem)}
                  >
                    <View style={[styles.optionIcon, { backgroundColor: '#E53935' + '20' }]}>
                      <Ionicons name="person-remove-outline" size={20} color="#E53935" />
                    </View>
                    <Text style={[styles.optionText, { color: '#E53935' }]}>Xóa khỏi nhóm</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.optionItem, { marginTop: 4 }]}
                  onPress={() => setShowMemberOptions(false)}
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
  };

  // ─── Add member modal ──────────────────────────────────────────────────────
  const renderAddMemberModal = () => (
    <Modal
      visible={showAddModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowAddModal(false)}
    >
      <View style={[styles.addModalContainer, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.addModalHeader, { borderBottomColor: colors.borderColor }]}>
          <Text style={[styles.addModalTitle, { color: colors.text }]}>Thêm thành viên</Text>
          <TouchableOpacity onPress={() => { setShowAddModal(false); setSearchUsers(''); setUserResults([]); }}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={[styles.addSearchBar, { backgroundColor: colors.backgroundElement }]}>
          <Ionicons name="search" size={18} color={colors.textSecondary} />
          <TextInput
            style={[styles.addSearchInput, { color: colors.text }]}
            placeholder="Tìm kiếm người dùng..."
            placeholderTextColor={colors.textSecondary}
            value={searchUsers}
            onChangeText={handleSearchUsers}
            autoFocus
          />
        </View>

        {/* Results */}
        {loadingUsers ? (
          <ActivityIndicator style={{ marginTop: 20 }} color={colors.tint} />
        ) : (
          <FlatList
            data={userResults}
            keyExtractor={item => item._id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.addUserItem, { borderBottomColor: colors.borderColor }]}
                onPress={() => handleAddMember(item._id, item.name)}
              >
                {item.avatar ? (
                  <Image source={{ uri: item.avatar }} style={styles.addUserAvatar} />
                ) : (
                  <View style={[styles.addUserAvatar, { backgroundColor: colors.tint + '20' }]}>
                    <Text style={[{ color: colors.tint, fontSize: 18, fontWeight: 'bold' }]}>
                      {item.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={styles.addUserInfo}>
                  <Text style={[styles.addUserName, { color: colors.text }]}>{item.name}</Text>
                  <Text style={[styles.addUserEmail, { color: colors.textSecondary }]}>{item.email}</Text>
                </View>
                <View style={[styles.addBtn, { backgroundColor: colors.tint }]}>
                  <Ionicons name="person-add" size={16} color="#fff" />
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              searchUsers.length > 0 ? (
                <Text style={[styles.addEmptyText, { color: colors.textSecondary }]}>
                  Không tìm thấy người dùng
                </Text>
              ) : (
                <Text style={[styles.addEmptyText, { color: colors.textSecondary }]}>
                  Nhập tên để tìm kiếm
                </Text>
              )
            }
          />
        )}
      </View>
    </Modal>
  );

  // ─── Render member item ────────────────────────────────────────────────────
  const renderMember = ({ item }: { item: Member }) => {
    const isSelf = item.user._id === currentUser?.id;
    const canLongPress = isAdmin && !isSelf;

    return (
      <TouchableOpacity
        style={[styles.memberItem, { borderBottomColor: colors.borderColor }]}
        onLongPress={canLongPress ? () => { setSelectedMember(item); setShowMemberOptions(true); } : undefined}
        onPress={canLongPress ? () => { setSelectedMember(item); setShowMemberOptions(true); } : undefined}
        activeOpacity={canLongPress ? 0.7 : 1}
      >
        <View style={styles.memberAvatarContainer}>
          {item.user.avatar ? (
            <Image source={{ uri: item.user.avatar }} style={styles.memberAvatar} />
          ) : (
            <View style={[styles.memberAvatar, { backgroundColor: colors.tint + '20' }]}>
              <Text style={[styles.memberAvatarText, { color: colors.tint }]}>
                {item.user.name.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View
            style={[
              styles.memberStatusDot,
              {
                backgroundColor:
                  item.user.status === 'online' ? colors.onlineStatus : colors.offlineStatus,
                borderColor: colors.background,
              },
            ]}
          />
        </View>

        <View style={styles.memberInfo}>
          <View style={styles.memberNameRow}>
            <Text style={[styles.memberName, { color: colors.text }]}>
              {item.user.name}
              {isSelf ? ' (Bạn)' : ''}
            </Text>
            <View style={[styles.roleBadge, { backgroundColor: ROLE_COLOR[item.role] + '15' }]}>
              <Text style={[styles.roleText, { color: ROLE_COLOR[item.role] }]}>
                {ROLE_LABEL[item.role]}
              </Text>
            </View>
          </View>
          <Text style={[styles.memberEmail, { color: colors.textSecondary }]} numberOfLines={1}>
            {item.user.email}
          </Text>
        </View>

        {isAdmin && !isSelf && (
          <Ionicons name="ellipsis-vertical" size={18} color={colors.textSecondary} />
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  if (!group) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text }}>Không tìm thấy nhóm</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} />

        {renderMemberOptions()}
        {renderAddMemberModal()}

        {/* Header */}
        <View style={[styles.topHeader, { borderBottomColor: colors.borderColor }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.topHeaderTitle, { color: colors.text }]}>Thông tin nhóm</Text>
          {isAdmin && (
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => setEditMode(!editMode)}
            >
              <Ionicons name={editMode ? 'close' : 'pencil'} size={20} color={colors.tint} />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Group avatar + info */}
          <View style={[styles.groupInfoSection, { borderBottomColor: colors.borderColor }]}>
            {group.avatar ? (
              <Image source={{ uri: group.avatar }} style={styles.groupAvatar} />
            ) : (
              <View style={[styles.groupAvatar, { backgroundColor: colors.tint + '20' }]}>
                <Ionicons name="people" size={48} color={colors.tint} />
              </View>
            )}

            {editMode ? (
              // ── Edit mode ──
              <View style={styles.editForm}>
                <TextInput
                  style={[styles.editNameInput, { color: colors.text, borderColor: colors.borderColor }]}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Tên nhóm"
                  placeholderTextColor={colors.textSecondary}
                  maxLength={50}
                />
                <TextInput
                  style={[styles.editDescInput, { color: colors.text, borderColor: colors.borderColor }]}
                  value={editDesc}
                  onChangeText={setEditDesc}
                  placeholder="Mô tả nhóm"
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  maxLength={200}
                />
                <View style={styles.editSettingRow}>
                  <Text style={[styles.editSettingLabel, { color: colors.text }]}>Nhóm riêng tư</Text>
                  <Switch
                    value={editPrivate}
                    onValueChange={setEditPrivate}
                    trackColor={{ false: colors.borderColor, true: colors.tint }}
                    thumbColor="#fff"
                  />
                </View>
                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: colors.tint }]}
                  onPress={handleSaveEdit}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.saveBtnText}>Lưu thay đổi</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              // ── Display mode ──
              <>
                <Text style={[styles.groupName, { color: colors.text }]}>{group.name}</Text>
                {group.description ? (
                  <Text style={[styles.groupDesc, { color: colors.textSecondary }]}>
                    {group.description}
                  </Text>
                ) : null}
                <View style={styles.groupMeta}>
                  <View style={[styles.metaTag, { backgroundColor: colors.backgroundElement }]}>
                    <Ionicons name="people-outline" size={14} color={colors.textSecondary} />
                    <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                      {group.members.length} thành viên
                    </Text>
                  </View>
                  {group.settings?.isPrivate && (
                    <View style={[styles.metaTag, { backgroundColor: colors.tint + '15' }]}>
                      <Ionicons name="lock-closed-outline" size={14} color={colors.tint} />
                      <Text style={[styles.metaText, { color: colors.tint }]}>Riêng tư</Text>
                    </View>
                  )}
                  <View style={[styles.metaTag, { backgroundColor: colors.backgroundElement }]}>
                    <Ionicons name="shield-outline" size={14} color={colors.textSecondary} />
                    <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                      {ROLE_LABEL[myRole]}
                    </Text>
                  </View>
                </View>

                {/* Quick action - vào chat */}
                <TouchableOpacity
                  style={[styles.chatButton, { backgroundColor: colors.tint }]}
                  onPress={() => router.push(`/chat/${id}?type=group` as any)}
                >
                  <Ionicons name="chatbubble-outline" size={18} color="#fff" />
                  <Text style={styles.chatButtonText}>Vào nhóm chat</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Members section */}
          <View style={styles.membersSection}>
            <View style={styles.membersSectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                THÀNH VIÊN ({group.members.length})
              </Text>
              {isAdmin && (
                <TouchableOpacity
                  style={[styles.addMemberBtn, { backgroundColor: colors.tint + '15' }]}
                  onPress={() => setShowAddModal(true)}
                >
                  <Ionicons name="person-add-outline" size={16} color={colors.tint} />
                  <Text style={[styles.addMemberBtnText, { color: colors.tint }]}>Thêm</Text>
                </TouchableOpacity>
              )}
            </View>

            <FlatList
              data={group.members}
              keyExtractor={item => item.user._id}
              renderItem={renderMember}
              scrollEnabled={false}
            />
          </View>

          {/* Danger zone */}
          <View style={[styles.dangerSection, { borderTopColor: colors.borderColor }]}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              THAO TÁC NHÓM
            </Text>

            <TouchableOpacity
              style={[styles.dangerItem, { borderBottomColor: colors.borderColor }]}
              onPress={handleLeave}
            >
              <View style={[styles.dangerIcon, { backgroundColor: '#FB8C00' + '20' }]}>
                <Ionicons name="exit-outline" size={20} color="#FB8C00" />
              </View>
              <Text style={[styles.dangerText, { color: '#FB8C00' }]}>Rời khỏi nhóm</Text>
              <Ionicons name="chevron-forward" size={18} color="#FB8C00" />
            </TouchableOpacity>

            {isOwner && (
              <TouchableOpacity style={styles.dangerItem} onPress={handleDissolve}>
                <View style={[styles.dangerIcon, { backgroundColor: '#E53935' + '20' }]}>
                  <Ionicons name="trash-outline" size={20} color="#E53935" />
                </View>
                <Text style={[styles.dangerText, { color: '#E53935' }]}>Giải tán nhóm</Text>
                <Ionicons name="chevron-forward" size={18} color="#E53935" />
              </TouchableOpacity>
            )}
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </>
  );
};

export default GroupDetailScreen;

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },

  // Header
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 4, marginRight: 12 },
  topHeaderTitle: { flex: 1, fontSize: 18, fontWeight: '700' },
  editBtn: { padding: 8 },

  // Group info
  groupInfoSection: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  groupAvatar: {
    width: 90,
    height: 90,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  groupName: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 6,
  },
  groupDesc: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 20,
  },
  groupMeta: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 20,
  },
  metaTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  metaText: { fontSize: 12, fontWeight: '500' },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  chatButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  // Edit form
  editForm: { width: '100%' },
  editNameInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  editDescInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    marginBottom: 10,
    minHeight: 70,
    textAlignVertical: 'top',
  },
  editSettingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  editSettingLabel: { fontSize: 15, fontWeight: '500' },
  saveBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Members
  membersSection: { paddingTop: 16 },
  membersSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  sectionTitle: { fontSize: 12, fontWeight: '600' },
  addMemberBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  addMemberBtnText: { fontSize: 13, fontWeight: '600' },
  memberItem: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  memberAvatarContainer: { position: 'relative', marginRight: 12 },
  memberAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberAvatarText: { fontSize: 18, fontWeight: 'bold' },
  memberStatusDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 2,
  },
  memberInfo: { flex: 1 },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
    flexWrap: 'wrap',
  },
  memberName: { fontSize: 15, fontWeight: '500' },
  memberEmail: { fontSize: 13 },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  roleText: { fontSize: 11, fontWeight: '600' },

  // Danger section
  dangerSection: {
    paddingTop: 16,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    marginTop: 16,
  },
  dangerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  dangerIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dangerText: { flex: 1, fontSize: 15, fontWeight: '500' },

  // Member options modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  optionsSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingBottom: 34,
    paddingHorizontal: 16,
  },
  optionsMemberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  optionsAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionsAvatarText: { fontSize: 20, fontWeight: 'bold' },
  optionsMemberName: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  optionsDivider: { height: 1, marginVertical: 8 },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionText: { fontSize: 15, fontWeight: '500' },

  // Add member modal
  addModalContainer: {
    flex: 1,
    marginTop: 60,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  addModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  addModalTitle: { fontSize: 18, fontWeight: '700' },
  addSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    paddingHorizontal: 14,
    height: 44,
    borderRadius: 22,
    gap: 8,
  },
  addSearchInput: { flex: 1, fontSize: 15, padding: 0 },
  addUserItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  addUserAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addUserInfo: { flex: 1 },
  addUserName: { fontSize: 15, fontWeight: '500', marginBottom: 2 },
  addUserEmail: { fontSize: 13 },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addEmptyText: {
    textAlign: 'center',
    paddingVertical: 24,
    fontSize: 14,
  },
});