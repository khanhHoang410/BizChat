import { API_BASE } from '@/constants/api';
import { Colors } from '@/constants/theme';
import { useAppColorScheme } from '@/hooks/use-color-scheme';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const BASE_URL = API_BASE;

// ─── Types ────────────────────────────────────────────────────────────────────

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

type UserInfo = { id: string; name: string; email: string; avatar?: string };

// ─── Constants ────────────────────────────────────────────────────────────────

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

// ─── Row item type cho FlatList duy nhất ─────────────────────────────────────

type RowItem =
  | { kind: 'hero' }
  | { kind: 'actions' }
  | { kind: 'section_members' }
  | { kind: 'member'; data: Member }
  | { kind: 'section_settings' }
  | { kind: 'setting_notifications' }
  | { kind: 'setting_leave' }
  | { kind: 'setting_dissolve' }
  | { kind: 'footer' };

// ─── Component ────────────────────────────────────────────────────────────────

const GroupDetailScreen = () => {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { resolvedScheme } = useAppColorScheme();
  const scheme = resolvedScheme;
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  const [group, setGroup] = useState<Group | null>(null);
  const [currentUser, setCurrentUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [muted, setMuted] = useState(false);

  // Edit modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editPrivate, setEditPrivate] = useState(false);

  // Add member modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchUsers, setSearchUsers] = useState('');
  const [userResults, setUserResults] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Member options
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [showMemberOptions, setShowMemberOptions] = useState(false);
  const [editAvatar, setEditAvatar] = useState<string | null>(null);


  const getToken = () => AsyncStorage.getItem('userToken');

  // ─── Fetch ──────────────────────────────────────────────────────────────────

  const fetchCurrentUser = async () => {
    const token = await getToken();
    const res = await fetch(`${BASE_URL}/api/auth/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setCurrentUser(data.user);
    const mutedGroups: any[] = data?.user?.settings?.mutedGroups || [];
    setMuted(mutedGroups.some((x: any) => String(x) === String(id)));
  };

  const pickEditAvatar = async () => {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') { Alert.alert('Cần quyền', 'Cho phép truy cập thư viện ảnh'); return; }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true, aspect: [1, 1], quality: 0.7,
  });
  if (!result.canceled && result.assets?.[0]) setEditAvatar(result.assets[0].uri);
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
    } catch (e) {
      console.error('Fetch group error:', e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchCurrentUser();
    fetchGroup();
  }, []);

  const updateMute = async (value: boolean) => {
    try {
      const token = await getToken();
      const res = await fetch(`${BASE_URL}/api/users/notification-preferences`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ targetType: 'group', targetId: id, muted: value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Không thể cập nhật');
      setMuted(value);
    } catch (e: any) {
      Alert.alert('Lỗi', e?.message || 'Không thể cập nhật cài đặt thông báo');
    }
  };

  // ─── Permissions ────────────────────────────────────────────────────────────

  const isAdmin = group?.admins?.some(a => a._id === currentUser?.id) ?? false;
  const isOwner = group?.createdBy?._id === currentUser?.id;
  const myRole = group?.members?.find(m => m.user._id === currentUser?.id)?.role ?? 'member';

  // ─── Edit group ─────────────────────────────────────────────────────────────

  const handleSaveEdit = async () => {
  if (!editName.trim()) { Alert.alert('Lỗi', 'Tên nhóm không được để trống'); return; }
  setSaving(true);
  try {
    const token = await getToken();

    // Upload avatar nếu có chọn ảnh mới
    let avatarUrl = group?.avatar || '';
    if (editAvatar) {
      const formData = new FormData();
      formData.append('file', { uri: editAvatar, type: 'image/jpeg', name: 'group_avatar.jpg' } as any);
      const uploadRes = await fetch(`${BASE_URL}/api/chat/upload/image`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData,
      });
      const uploadData = await uploadRes.json();
      avatarUrl = uploadData.file?.url || avatarUrl;
    }

    const res = await fetch(`${BASE_URL}/api/groups/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name: editName.trim(),
        description: editDesc.trim(),
        avatar: avatarUrl, // ← thêm
        settings: { isPrivate: editPrivate },
      }),
    });
    const data = await res.json();
    if (res.ok) { setGroup(data.group); setEditAvatar(null); setShowEditModal(false); }
    else Alert.alert('Lỗi', data.error);
  } catch { Alert.alert('Lỗi', 'Không thể cập nhật thông tin nhóm'); }
  finally { setSaving(false); }
};

  // ─── Search users ────────────────────────────────────────────────────────────

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
      const memberIds = group?.members.map(m => m.user._id) || [];
      setUserResults((data.users || []).filter((u: any) => !memberIds.includes(u._id)));
    } catch {
      setUserResults([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  // ─── Add member ──────────────────────────────────────────────────────────────

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
        Alert.alert('✅', `${userName} đã được thêm vào nhóm`);
      } else {
        Alert.alert('Lỗi', data.error);
      }
    } catch {
      Alert.alert('Lỗi', 'Không thể thêm thành viên');
    }
  };

  // ─── Remove member ───────────────────────────────────────────────────────────

  const handleRemoveMember = (member: Member) => {
    Alert.alert(
      'Xóa thành viên',
      `Xóa ${member.user.name} khỏi nhóm?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            const token = await getToken();
            const res = await fetch(`${BASE_URL}/api/groups/${id}/members/${member.user._id}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (res.ok) { setGroup(data.group); setShowMemberOptions(false); }
            else Alert.alert('Lỗi', data.error);
          },
        },
      ]
    );
  };

  // ─── Promote / Demote ────────────────────────────────────────────────────────

  const handlePromote = async (member: Member, newRole: 'admin' | 'moderator') => {
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
      Alert.alert('✅', `${member.user.name} → ${ROLE_LABEL[newRole]}`);
    } else Alert.alert('Lỗi', data.error);
  };

  const handleDemote = async (member: Member) => {
    const token = await getToken();
    const res = await fetch(`${BASE_URL}/api/groups/${id}/members/${member.user._id}/demote`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (res.ok) {
      setGroup(data.group);
      setShowMemberOptions(false);
      Alert.alert('✅', `${member.user.name} → Thành viên`);
    } else Alert.alert('Lỗi', data.error);
  };

  // ─── Leave / Dissolve ────────────────────────────────────────────────────────

  const handleLeave = () =>
    Alert.alert('Rời nhóm', 'Bạn có chắc chắn muốn rời khỏi nhóm này?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Rời nhóm',
        style: 'destructive',
        onPress: async () => {
          const token = await getToken();
          const res = await fetch(`${BASE_URL}/api/groups/${id}/leave`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await res.json();
          if (res.ok) router.replace('/(tabs)' as any);
          else Alert.alert('Lỗi', data.error);
        },
      },
    ]);

  const handleDissolve = () =>
    Alert.alert(
      'Giải tán nhóm',
      `Giải tán "${group?.name}"? Hành động này không thể hoàn tác.`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Giải tán',
          style: 'destructive',
          onPress: async () => {
            const token = await getToken();
            const res = await fetch(`${BASE_URL}/api/groups/${id}/dissolve`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (res.ok) router.replace('/(tabs)' as any);
            else Alert.alert('Lỗi', data.error);
          },
        },
      ]
    );

  // ─── Build FlatList rows (tránh nested ScrollView) ───────────────────────────

  const buildRows = (): RowItem[] => {
    if (!group) return [];
    const rows: RowItem[] = [
      { kind: 'hero' },
      { kind: 'actions' },
      { kind: 'section_members' },
      ...group.members.map(m => ({ kind: 'member' as const, data: m })),
      { kind: 'section_settings' },
      { kind: 'setting_notifications' },
      { kind: 'setting_leave' },
      ...(isOwner ? [{ kind: 'setting_dissolve' as const }] : []),
      { kind: 'footer' },
    ];
    return rows;
  };

  // ─── Render FlatList item ────────────────────────────────────────────────────

  const renderRow = ({ item }: { item: RowItem }) => {
    switch (item.kind) {
      // ── Hero ──
      case 'hero':
        return (
          <View style={styles.hero}>
            <View style={styles.heroAvatarWrap}>
              {group?.avatar ? (
                <Image source={{ uri: group.avatar }} style={styles.heroAvatar} />
              ) : (
                <View style={[styles.heroAvatar, { backgroundColor: colors.tint + '25' }]}>
                  <Ionicons name="people" size={52} color={colors.tint} />
                </View>
              )}
              {isAdmin && (
                <TouchableOpacity
                  style={[styles.heroEditBadge, { backgroundColor: colors.tint }]}
                  onPress={() => setShowEditModal(true)}
                >
                  <Ionicons name="camera" size={13} color="#fff" />
                </TouchableOpacity>
              )}
            </View>

            <Text style={[styles.heroName, { color: colors.text }]}>{group?.name}</Text>

            {group?.description ? (
              <Text style={[styles.heroDesc, { color: colors.textSecondary }]}>
                {group.description}
              </Text>
            ) : null}

            <View style={styles.heroBadgeRow}>
              <View style={[styles.heroBadge, { backgroundColor: colors.backgroundElement }]}>
                <Ionicons name="people-outline" size={13} color={colors.textSecondary} />
                <Text style={[styles.heroBadgeText, { color: colors.textSecondary }]}>
                  {group?.members.length} thành viên
                </Text>
              </View>

              {group?.settings?.isPrivate && (
                <View style={[styles.heroBadge, { backgroundColor: colors.tint + '15' }]}>
                  <Ionicons name="lock-closed-outline" size={13} color={colors.tint} />
                  <Text style={[styles.heroBadgeText, { color: colors.tint }]}>Riêng tư</Text>
                </View>
              )}

              <View style={[styles.heroBadge, { backgroundColor: ROLE_COLOR[myRole] + '15' }]}>
                <Ionicons name="shield-outline" size={13} color={ROLE_COLOR[myRole]} />
                <Text style={[styles.heroBadgeText, { color: ROLE_COLOR[myRole] }]}>
                  {ROLE_LABEL[myRole]}
                </Text>
              </View>
            </View>
          </View>
        );

      // ── Quick actions (Messenger-style icon buttons) ──
      case 'actions':
        return (
          <View style={[styles.actionsRow, { borderBottomColor: colors.borderColor }]}>
            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => router.push(`/chat/${id}?type=group` as any)}
            >
            
              <View style={[styles.actionIcon, { backgroundColor: colors.tint }]}>
                <Ionicons name="chatbubble" size={22} color="#fff" />
              </View>
              <Text style={[styles.actionLabel, { color: colors.text }]}>Nhắn tin</Text>
            </TouchableOpacity>

            {isAdmin && (
              <TouchableOpacity
                style={styles.actionItem}
                onPress={() => setShowAddModal(true)}
              >
                <View style={[styles.actionIcon, { backgroundColor: colors.tint + '15' }]}>
                  <Ionicons name="person-add" size={22} color={colors.tint} />
                </View>
                <Text style={[styles.actionLabel, { color: colors.text }]}>Thêm TV</Text>
              </TouchableOpacity>
            )}

            {isAdmin && (
              <TouchableOpacity
                style={styles.actionItem}
                onPress={() => setShowEditModal(true)}
              >
                <View style={[styles.actionIcon, { backgroundColor: colors.tint + '15' }]}>
                  <Ionicons name="pencil" size={22} color={colors.tint} />
                </View>
                <Text style={[styles.actionLabel, { color: colors.text }]}>Chỉnh sửa</Text>
              </TouchableOpacity>
            )}

              
            <TouchableOpacity style={styles.actionItem} onPress={handleLeave}>
              <View style={[styles.actionIcon, { backgroundColor: '#FB8C0015' }]}>
                <Ionicons name="exit-outline" size={22} color="#FB8C00" />
              </View>
              <Text style={[styles.actionLabel, { color: colors.text }]}>Rời nhóm</Text>
            </TouchableOpacity>
          </View>
        );

      // ── Section header: members ──
      case 'section_members':
        return (
          <View style={[styles.sectionHeader, { backgroundColor: colors.backgroundElement }]}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              THÀNH VIÊN · {group?.members.length}
            </Text>
            {isAdmin && (
              <TouchableOpacity onPress={() => setShowAddModal(true)}>
                <Text style={[styles.sectionAction, { color: colors.tint }]}>+ Thêm</Text>
              </TouchableOpacity>
            )}
          </View>
        );

      // ── Member row ──
      case 'member': {
        const mem = item.data;
        const isSelf = mem.user._id === currentUser?.id;
        return (
          <TouchableOpacity
            style={[styles.memberRow, { borderBottomColor: colors.borderColor }]}
            activeOpacity={isAdmin && !isSelf ? 0.6 : 1}
            onPress={
              isAdmin && !isSelf
                ? () => { setSelectedMember(mem); setShowMemberOptions(true); }
                : undefined
            }
          >
            {/* Avatar */}
            <View style={styles.memberAvatarWrap}>
              {mem.user.avatar ? (
                <Image source={{ uri: mem.user.avatar }} style={styles.memberAvatar} />
              ) : (
                <View style={[styles.memberAvatar, { backgroundColor: colors.tint + '20' }]}>
                  <Text style={[styles.memberAvatarLetter, { color: colors.tint }]}>
                    {mem.user.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor:
                      mem.user.status === 'online' ? '#43D87B' : '#9E9E9E',
                    borderColor: colors.background,
                  },
                ]}
              />
            </View>

            {/* Info */}
            <View style={styles.memberMeta}>
              <Text style={[styles.memberName, { color: colors.text }]} numberOfLines={1}>
                {mem.user.name}{isSelf ? ' (Bạn)' : ''}
              </Text>
              <Text style={[styles.memberSub, { color: colors.textSecondary }]} numberOfLines={1}>
                {mem.user.email}
              </Text>
            </View>

            {/* Role badge */}
            {mem.role !== 'member' && (
              <View style={[styles.rolePill, { backgroundColor: ROLE_COLOR[mem.role] + '18' }]}>
                <Text style={[styles.rolePillText, { color: ROLE_COLOR[mem.role] }]}>
                  {ROLE_LABEL[mem.role]}
                </Text>
              </View>
            )}

            {isAdmin && !isSelf && (
              <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} style={{ marginLeft: 4 }} />
            )}
          </TouchableOpacity>
        );
      }

      // ── Section header: settings ──
      case 'section_settings':
        return (
          <View style={[styles.sectionHeader, { backgroundColor: colors.backgroundElement, marginTop: 8 }]}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>THAO TÁC</Text>
          </View>
        );

      case 'setting_notifications':
        return (
          <View style={[styles.dangerRow, { borderBottomColor: colors.borderColor }]}>
            <View style={[styles.dangerIconWrap, { backgroundColor: colors.tint + '15' }]}>
              <Ionicons name="notifications-outline" size={20} color={colors.tint} />
            </View>
            <Text style={[styles.dangerLabel, { color: colors.text }]}>Tắt thông báo nhóm</Text>
            <Switch
              value={muted}
              onValueChange={updateMute}
              trackColor={{ false: colors.borderColor, true: colors.tint }}
              thumbColor="#fff"
            />
          </View>
        );

      // ── Leave ──
      case 'setting_leave':
        return (
          <TouchableOpacity
            style={[styles.dangerRow, { borderBottomColor: colors.borderColor }]}
            onPress={handleLeave}
            activeOpacity={0.7}
          >
            <View style={[styles.dangerIconWrap, { backgroundColor: '#FB8C0018' }]}>
              <Ionicons name="exit-outline" size={20} color="#FB8C00" />
            </View>
            <Text style={[styles.dangerLabel, { color: '#FB8C00' }]}>Rời khỏi nhóm</Text>
            <Ionicons name="chevron-forward" size={16} color="#FB8C00" />
          </TouchableOpacity>
        );

      // ── Dissolve ──
      case 'setting_dissolve':
        return (
          <TouchableOpacity
            style={[styles.dangerRow, { borderBottomColor: 'transparent' }]}
            onPress={handleDissolve}
            activeOpacity={0.7}
          >
            <View style={[styles.dangerIconWrap, { backgroundColor: '#E5393518' }]}>
              <Ionicons name="trash-outline" size={20} color="#E53935" />
            </View>
            <Text style={[styles.dangerLabel, { color: '#E53935' }]}>Giải tán nhóm</Text>
            <Ionicons name="chevron-forward" size={16} color="#E53935" />
          </TouchableOpacity>
        );

      case 'footer':
        return <View style={{ height: 48 }} />;

      default:
        return null;
    }
  };

  // ─── Edit Modal ───────────────────────────────────────────────────────────────

const renderEditModal = () => (
    <Modal
      visible={showEditModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowEditModal(false)}
    >
      <TouchableWithoutFeedback onPress={() => setShowEditModal(false)}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback>
            <View style={[styles.editSheet, { backgroundColor: colors.background }]}>
              <View style={[styles.sheetHandle, { backgroundColor: colors.borderColor }]} />

              <Text style={[styles.sheetTitle, { color: colors.text }]}>Chỉnh sửa nhóm</Text>

              {/* ✅ Avatar picker — thêm vào đây */}
              <TouchableOpacity style={{ alignItems: 'center', marginBottom: 16 }} onPress={pickEditAvatar}>
                {editAvatar || group?.avatar ? (
                  <Image
                    source={{ uri: editAvatar || group?.avatar }}
                    style={{ width: 80, height: 80, borderRadius: 24 }}
                  />
                ) : (
                  <View style={{ width: 80, height: 80, borderRadius: 24, backgroundColor: colors.tint + '25', justifyContent: 'center', alignItems: 'center' }}>
                    <Ionicons name="people" size={40} color={colors.tint} />
                  </View>
                )}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 }}>
                  <Ionicons name="camera-outline" size={14} color={colors.tint} />
                  <Text style={{ color: colors.tint, fontSize: 13, fontWeight: '600' }}>Đổi ảnh nhóm</Text>
                </View>
              </TouchableOpacity>

              {/* Name */}
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Tên nhóm</Text>
              <View style={[styles.fieldInput, { borderColor: colors.borderColor, backgroundColor: colors.backgroundElement }]}>
                <TextInput
                  style={[styles.fieldText, { color: colors.text }]}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Tên nhóm"
                  placeholderTextColor={colors.textSecondary}
                  maxLength={50}
                />
              </View>

              {/* Description */}
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Mô tả</Text>
              <View style={[styles.fieldInput, styles.fieldInputMulti, { borderColor: colors.borderColor, backgroundColor: colors.backgroundElement }]}>
                <TextInput
                  style={[styles.fieldText, { color: colors.text }]}
                  value={editDesc}
                  onChangeText={setEditDesc}
                  placeholder="Mô tả nhóm (tùy chọn)"
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  maxLength={200}
                />
              </View>

              {/* Private toggle */}
              <View style={[styles.toggleRow, { borderColor: colors.borderColor }]}>
                <View style={styles.toggleLeft}>
                  <Ionicons name="lock-closed-outline" size={18} color={colors.tint} />
                  <Text style={[styles.toggleLabel, { color: colors.text }]}>Nhóm riêng tư</Text>
                </View>
                <Switch
                  value={editPrivate}
                  onValueChange={setEditPrivate}
                  trackColor={{ false: colors.borderColor, true: colors.tint }}
                  thumbColor="#fff"
                />
              </View>

              {/* Save */}
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: colors.tint }]}
                onPress={handleSaveEdit}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.saveBtnText}>Lưu thay đổi</Text>
                }
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );

  // ─── Add Member Modal ─────────────────────────────────────────────────────────

  const renderAddModal = () => (
    <Modal
      visible={showAddModal}
      transparent
      animationType="slide"
      onRequestClose={() => { setShowAddModal(false); setSearchUsers(''); setUserResults([]); }}
    >
      <View style={[styles.fullSheet, { backgroundColor: colors.background }]}>
        {/* Header */}
        <SafeAreaView edges={['top']}>
          <View style={[styles.addHeader, { borderBottomColor: colors.borderColor }]}>
            <Text style={[styles.sheetTitle, { color: colors.text, marginBottom: 0 }]}>Thêm thành viên</Text>
            <TouchableOpacity
              onPress={() => { setShowAddModal(false); setSearchUsers(''); setUserResults([]); }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        {/* Search */}
        <View style={[styles.addSearchWrap, { backgroundColor: colors.backgroundElement }]}>
          <Ionicons name="search" size={16} color={colors.textSecondary} />
          <TextInput
            style={[styles.addSearchInput, { color: colors.text }]}
            placeholder="Tìm kiếm người dùng..."
            placeholderTextColor={colors.textSecondary}
            value={searchUsers}
            onChangeText={handleSearchUsers}
            autoFocus
          />
          {searchUsers.length > 0 && (
            <TouchableOpacity onPress={() => { setSearchUsers(''); setUserResults([]); }}>
              <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Results */}
        {loadingUsers ? (
          <ActivityIndicator style={{ marginTop: 32 }} color={colors.tint} />
        ) : (
          <FlatList
            data={userResults}
            keyExtractor={u => u._id}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.addUserRow, { borderBottomColor: colors.borderColor }]}
                onPress={() => handleAddMember(item._id, item.name)}
                activeOpacity={0.7}
              >
                {item.avatar ? (
                  <Image source={{ uri: item.avatar }} style={styles.addAvatar} />
                ) : (
                  <View style={[styles.addAvatar, { backgroundColor: colors.tint + '20' }]}>
                    <Text style={{ color: colors.tint, fontSize: 18, fontWeight: '700' }}>
                      {item.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.addUserName, { color: colors.text }]}>{item.name}</Text>
                  <Text style={[styles.addUserEmail, { color: colors.textSecondary }]} numberOfLines={1}>
                    {item.email}
                  </Text>
                </View>
                <View style={[styles.addIconBtn, { backgroundColor: colors.tint }]}>
                  <Ionicons name="person-add" size={15} color="#fff" />
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.addEmpty}>
                <Ionicons name={searchUsers ? 'search-outline' : 'people-outline'} size={48} color={colors.textSecondary} />
                <Text style={[styles.addEmptyText, { color: colors.textSecondary }]}>
                  {searchUsers ? 'Không tìm thấy người dùng' : 'Nhập tên để tìm kiếm'}
                </Text>
              </View>
            }
          />
        )}
      </View>
    </Modal>
  );

  // ─── Member Options Bottom Sheet ──────────────────────────────────────────────

  const renderMemberOptions = () => {
    if (!selectedMember) return null;
    const mem = selectedMember;
    const isMemAdmin = mem.role === 'admin';
    const isMemMod = mem.role === 'moderator';

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
              <View style={[styles.optSheet, { backgroundColor: colors.background }]}>
                <View style={[styles.sheetHandle, { backgroundColor: colors.borderColor }]} />

                {/* Member identity */}
                <View style={styles.optMemberRow}>
                  {mem.user.avatar ? (
                    <Image source={{ uri: mem.user.avatar }} style={styles.optAvatar} />
                  ) : (
                    <View style={[styles.optAvatar, { backgroundColor: colors.tint + '20' }]}>
                      <Text style={{ color: colors.tint, fontSize: 20, fontWeight: '700' }}>
                        {mem.user.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View>
                    <Text style={[styles.optName, { color: colors.text }]}>{mem.user.name}</Text>
                    <View style={[styles.rolePill, { backgroundColor: ROLE_COLOR[mem.role] + '18', alignSelf: 'flex-start', marginTop: 4 }]}>
                      <Text style={[styles.rolePillText, { color: ROLE_COLOR[mem.role] }]}>
                        {ROLE_LABEL[mem.role]}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={[styles.optDivider, { backgroundColor: colors.borderColor }]} />

                {/* Actions */}
                {isAdmin && !isMemAdmin && (
                  <TouchableOpacity style={styles.optRow} onPress={() => handlePromote(mem, 'admin')}>
                    <View style={[styles.optIcon, { backgroundColor: '#E5393518' }]}>
                      <Ionicons name="shield-checkmark-outline" size={19} color="#E53935" />
                    </View>
                    <Text style={[styles.optText, { color: colors.text }]}>Thăng lên Admin</Text>
                  </TouchableOpacity>
                )}

                {/* {isAdmin && !isMemMod && !isMemAdmin && (
                  <TouchableOpacity style={styles.optRow} onPress={() => handlePromote(mem, 'moderator')}>
                    <View style={[styles.optIcon, { backgroundColor: '#FB8C0018' }]}>
                      <Ionicons name="star-outline" size={19} color="#FB8C00" />
                    </View>
                    <Text style={[styles.optText, { color: colors.text }]}>Thăng lên Moderator</Text>
                  </TouchableOpacity>
                )} */}

                {isAdmin && (isMemAdmin || isMemMod) && (
                  <TouchableOpacity style={styles.optRow} onPress={() => handleDemote(mem)}>
                    <View style={[styles.optIcon, { backgroundColor: '#FB8C0018' }]}>
                      <Ionicons name="arrow-down-circle-outline" size={19} color="#FB8C00" />
                    </View>
                    <Text style={[styles.optText, { color: colors.text }]}>Hạ xuống Thành viên</Text>
                  </TouchableOpacity>
                )}

                {isAdmin && (
                  <TouchableOpacity style={styles.optRow} onPress={() => handleRemoveMember(mem)}>
                    <View style={[styles.optIcon, { backgroundColor: '#E5393518' }]}>
                      <Ionicons name="person-remove-outline" size={19} color="#E53935" />
                    </View>
                    <Text style={[styles.optText, { color: '#E53935' }]}>Xóa khỏi nhóm</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.optCancelBtn, { backgroundColor: colors.backgroundElement }]}
                  onPress={() => setShowMemberOptions(false)}
                >
                  <Text style={[styles.optCancelText, { color: colors.text }]}>Hủy</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    );
  };

  // ─── Loading / Error ──────────────────────────────────────────────────────────

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
        <Ionicons name="alert-circle-outline" size={48} color={colors.textSecondary} />
        <Text style={[{ color: colors.text, marginTop: 12, fontSize: 16 }]}>Không tìm thấy nhóm</Text>
      </View>
    );
  }

  // ─── Main render — 1 FlatList duy nhất, không nested scroll ──────────────────

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} />

        {renderEditModal()}
        {renderAddModal()}
        {renderMemberOptions()}

        {/* Header */}
        <View style={[styles.topBar, { borderBottomColor: colors.borderColor }]}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.topBarTitle, { color: colors.text }]} numberOfLines={1}>
            Thông tin nhóm
          </Text>
          {isAdmin ? (
            <TouchableOpacity onPress={() => setShowEditModal(true)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="pencil-outline" size={22} color={colors.tint} />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 24 }} />
          )}
        </View>

        {/* Single FlatList — không dùng ScrollView bọc ngoài */}
        <FlatList
          data={buildRows()}
          keyExtractor={(item, index) => `${item.kind}_${index}`}
          renderItem={renderRow}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          style={{ backgroundColor: colors.background }}
        />
      </SafeAreaView>
    </>
  );
};

export default GroupDetailScreen;

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  topBarTitle: { flex: 1, fontSize: 17, fontWeight: '700' },

  // Hero
  hero: {
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 20,
    paddingHorizontal: 24,
  },
  heroAvatarWrap: { position: 'relative', marginBottom: 14 },
  heroAvatar: {
    width: 96,
    height: 96,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroEditBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  heroName: { fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 6 },
  heroDesc: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 14 },
  heroBadgeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  heroBadgeText: { fontSize: 12, fontWeight: '600' },

  // Actions row (Messenger-style)
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
  },
  actionItem: { alignItems: 'center', gap: 6, minWidth: 64 },
  actionIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionLabel: { fontSize: 12, fontWeight: '500', textAlign: 'center' },

  // Section headers
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sectionTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 0.4 },
  sectionAction: { fontSize: 13, fontWeight: '600' },

  // Member row
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  memberAvatarWrap: { position: 'relative' },
  memberAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberAvatarLetter: { fontSize: 18, fontWeight: '700' },
  statusDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  memberMeta: { flex: 1 },
  memberName: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  memberSub: { fontSize: 13 },
  rolePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  rolePillText: { fontSize: 11, fontWeight: '700' },

  // Danger rows
  dangerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  dangerIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dangerLabel: { flex: 1, fontSize: 15, fontWeight: '500' },

  // Edit modal / bottom sheet
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  editSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
  },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 18, fontWeight: '700', marginBottom: 20, textAlign: 'center' },
  fieldLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 8 },
  fieldInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 4,
  },
  fieldInputMulti: { minHeight: 70 },
  fieldText: { fontSize: 15, padding: 0 },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 10,
    marginBottom: 20,
  },
  toggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  toggleLabel: { fontSize: 15, fontWeight: '500' },
  saveBtn: { borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Add member modal
  fullSheet: { flex: 1, marginTop: 60, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  addHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  addSearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    paddingHorizontal: 14,
    height: 44,
    borderRadius: 22,
    gap: 8,
  },
  addSearchInput: { flex: 1, fontSize: 15, padding: 0 },
  addUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  addAvatar: { width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center' },
  addUserName: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  addUserEmail: { fontSize: 13 },
  addIconBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  addEmpty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  addEmptyText: { fontSize: 15 },

  // Member options sheet
  optSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
  },
  optMemberRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 8 },
  optAvatar: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  optName: { fontSize: 16, fontWeight: '700' },
  optDivider: { height: StyleSheet.hairlineWidth, marginVertical: 12 },
  optRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 },
  optIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  optText: { fontSize: 15, fontWeight: '500' },
  optCancelBtn: {
    marginTop: 8,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  optCancelText: { fontSize: 16, fontWeight: '600' },
});