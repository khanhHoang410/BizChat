import { API_BASE } from '@/constants/api';
import { Colors } from '@/constants/theme';
import { useAppColorScheme } from '@/hooks/use-color-scheme';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// ─── Types ────────────────────────────────────────────────────────────────────

type FileItem = {
  _id: string;
  name: string;
  url: string;
  type: 'image' | 'document' | 'video' | 'audio' | 'other';
  size: number;
  createdAt: string;
  uploadedBy: { _id: string; name: string; avatar?: string };
};

type UserInfo = {
  _id: string;
  name: string;
  avatar?: string;
  status: 'online' | 'offline' | 'away';
  email?: string;
};

type Tab = 'images' | 'files' | 'links';

const BASE_URL = API_BASE;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });
};

const getFileIcon = (type: string) => {
  switch (type) {
    case 'document': return 'document-text-outline';
    case 'video': return 'videocam-outline';
    case 'audio': return 'musical-notes-outline';
    default: return 'document-outline';
  }
};

const getFileIconColor = (type: string) => {
  switch (type) {
    case 'document': return '#F44336';
    case 'video': return '#9C27B0';
    case 'audio': return '#FF9800';
    default: return '#607D8B';
  }
};

// ─── Component ────────────────────────────────────────────────────────────────

const ChatInfoScreen = () => {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { resolvedScheme } = useAppColorScheme();
  const scheme = resolvedScheme;
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  const [activeTab, setActiveTab] = useState<Tab>('images');
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [images, setImages] = useState<FileItem[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [links, setLinks] = useState<{ url: string; content: string; createdAt: string }[]>([]);
  const [loadingUser, setLoadingUser] = useState(true);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [muted, setMuted] = useState(false);

  const getToken = () => AsyncStorage.getItem('userToken');

  // ─── Fetch user info ───────────────────────────────────────────────────────

  const fetchUserInfo = async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${BASE_URL}/api/users/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setUserInfo(data.user);
    } catch (e) {
      console.error('fetchUserInfo:', e);
    } finally {
      setLoadingUser(false);
    }
  };

  const fetchMuteState = async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${BASE_URL}/api/auth/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const mutedUsers: any[] = data?.user?.settings?.mutedUsers || [];
      setMuted(mutedUsers.some((x: any) => String(x) === String(id)));
    } catch {
      // ignore
    }
  };

  // ─── Fetch files ───────────────────────────────────────────────────────────

  const fetchFiles = async () => {
    try {
      setLoadingFiles(true);
      const token = await getToken();

      // Fetch ảnh
      const imgRes = await fetch(`${BASE_URL}/api/chat/files/${id}?type=image`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const imgData = await imgRes.json();
      setImages(imgData.files || []);

      // Fetch file document/video/audio
      const fileRes = await fetch(`${BASE_URL}/api/chat/files/${id}?type=document`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const fileData = await fileRes.json();

      const videoRes = await fetch(`${BASE_URL}/api/chat/files/${id}?type=video`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const videoData = await videoRes.json();

      setFiles([...(fileData.files || []), ...(videoData.files || [])]);
    } catch (e) {
      console.error('fetchFiles:', e);
    } finally {
      setLoadingFiles(false);
    }
  };

  // ─── Fetch links từ tin nhắn ───────────────────────────────────────────────

  const fetchLinks = async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${BASE_URL}/api/chat/messages/${id}?limit=200`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      // Extract URLs từ tin nhắn text
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const foundLinks: { url: string; content: string; createdAt: string }[] = [];

      (data.messages || []).forEach((msg: any) => {
        if (msg.type === 'text' && msg.content) {
          const matches = msg.content.match(urlRegex);
          if (matches) {
            matches.forEach((url: string) => {
              foundLinks.push({ url, content: msg.content, createdAt: msg.createdAt });
            });
          }
        }
      });

      setLinks(foundLinks.reverse());
    } catch (e) {
      console.error('fetchLinks:', e);
    }
  };

  useEffect(() => {
    fetchUserInfo();
    fetchFiles();
    fetchLinks();
    fetchMuteState();
  }, [id]);

  const updateMute = async (value: boolean) => {
    try {
      const token = await getToken();
      const res = await fetch(`${BASE_URL}/api/users/notification-preferences`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ targetType: 'private', targetId: id, muted: value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Không thể cập nhật');
      setMuted(value);
    } catch (e: any) {
      Alert.alert('Lỗi', e?.message || 'Không thể cập nhật cài đặt thông báo');
    }
  };

  // ─── Render tabs ──────────────────────────────────────────────────────────

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: 'images', label: 'Ảnh', icon: 'image-outline' },
    { key: 'files', label: 'File', icon: 'document-outline' },
    { key: 'links', label: 'Link', icon: 'link-outline' },
  ];

  // ─── Render image grid ────────────────────────────────────────────────────

  const renderImageGrid = () => {
    if (loadingFiles) {
      return <ActivityIndicator style={{ marginTop: 40 }} color={colors.tint} />;
    }
    if (images.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="image-outline" size={48} color={colors.textSecondary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Chưa có ảnh nào</Text>
        </View>
      );
    }
    return (
      <FlatList
        data={images}
        keyExtractor={item => item._id}
        numColumns={3}
        scrollEnabled={false}
        contentContainerStyle={styles.imageGrid}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.imageGridItem}
            onPress={() => Linking.openURL(item.url)}
          >
            <Image source={{ uri: item.url }} style={styles.gridImage} resizeMode="cover" />
            <Text style={[styles.imageDate, { color: colors.textSecondary }]}>
              {formatDate(item.createdAt)}
            </Text>
          </TouchableOpacity>
        )}
      />
    );
  };

  // ─── Render file list ─────────────────────────────────────────────────────

  const renderFileList = () => {
    if (loadingFiles) {
      return <ActivityIndicator style={{ marginTop: 40 }} color={colors.tint} />;
    }
    if (files.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="document-outline" size={48} color={colors.textSecondary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Chưa có file nào</Text>
        </View>
      );
    }
    return (
      <View>
        {files.map(item => (
          <TouchableOpacity
            key={item._id}
            style={[styles.fileItem, { borderBottomColor: colors.borderColor }]}
            onPress={() => Linking.openURL(item.url)}
          >
            <View style={[styles.fileIconContainer, { backgroundColor: getFileIconColor(item.type) + '20' }]}>
              <Ionicons name={getFileIcon(item.type) as any} size={24} color={getFileIconColor(item.type)} />
            </View>
            <View style={styles.fileItemInfo}>
              <Text style={[styles.fileItemName, { color: colors.text }]} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={[styles.fileItemMeta, { color: colors.textSecondary }]}>
                {formatSize(item.size)} • {formatDate(item.createdAt)} • {item.uploadedBy?.name}
              </Text>
            </View>
            <Ionicons name="download-outline" size={20} color={colors.tint} />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  // ─── Render link list ─────────────────────────────────────────────────────

  const renderLinkList = () => {
    if (links.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="link-outline" size={48} color={colors.textSecondary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Chưa có link nào</Text>
        </View>
      );
    }
    return (
      <View>
        {links.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={[styles.linkItem, { borderBottomColor: colors.borderColor, backgroundColor: colors.backgroundElement }]}
            onPress={() => Linking.openURL(item.url)}
          >
            <View style={[styles.linkIconContainer, { backgroundColor: colors.tint + '20' }]}>
              <Ionicons name="link-outline" size={20} color={colors.tint} />
            </View>
            <View style={styles.linkInfo}>
              <Text style={[styles.linkUrl, { color: colors.tint }]} numberOfLines={1}>
                {item.url}
              </Text>
              <Text style={[styles.linkDate, { color: colors.textSecondary }]}>
                {formatDate(item.createdAt)}
              </Text>
            </View>
            <Ionicons name="open-outline" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  // ─── Loading ──────────────────────────────────────────────────────────────

  if (loadingUser) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
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

        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.borderColor }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Thông tin</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Profile section */}
          <View style={[styles.profileSection, { borderBottomColor: colors.borderColor }]}>
            {userInfo?.avatar ? (
              <Image source={{ uri: userInfo.avatar }} style={styles.profileAvatar} />
            ) : (
              <View style={[styles.profileAvatar, styles.profileAvatarPlaceholder, { backgroundColor: colors.tint + '20' }]}>
                <Text style={[styles.profileAvatarText, { color: colors.tint }]}>
                  {userInfo?.name?.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <Text style={[styles.profileName, { color: colors.text }]}>{userInfo?.name}</Text>
            <Text style={[styles.profileEmail, { color: colors.textSecondary }]}>{userInfo?.email}</Text>

            {/* Status badge */}
            <View style={[styles.statusBadge, {
              backgroundColor: userInfo?.status === 'online' ? '#4CAF50' + '20' : colors.backgroundElement
            }]}>
              <View style={[styles.statusDot, {
                backgroundColor: userInfo?.status === 'online' ? '#4CAF50' : colors.textSecondary
              }]} />
              <Text style={[styles.statusText, {
                color: userInfo?.status === 'online' ? '#4CAF50' : colors.textSecondary
              }]}>
                {userInfo?.status === 'online' ? 'Đang hoạt động' : 'Ngoại tuyến'}
              </Text>
            </View>

            {/* Action buttons */}
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.tint }]}
                onPress={() => router.back()}
              >
                <Ionicons name="chatbubble-outline" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Nhắn tin</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Notification setting */}
          <View style={[styles.fileItem, { borderBottomColor: colors.borderColor }]}>
            <View style={[styles.fileIconContainer, { backgroundColor: colors.tint + '20' }]}>
              <Ionicons name="notifications-outline" size={24} color={colors.tint} />
            </View>
            <View style={styles.fileItemInfo}>
              <Text style={[styles.fileItemName, { color: colors.text }]}>Tắt thông báo</Text>
              <Text style={[styles.fileItemMeta, { color: colors.textSecondary }]}>
                Áp dụng riêng cho cuộc trò chuyện này
              </Text>
            </View>
            <Switch
              value={muted}
              onValueChange={updateMute}
              trackColor={{ false: colors.borderColor, true: colors.tint }}
              thumbColor="#fff"
            />
          </View>

          {/* Tabs */}
          <View style={[styles.tabBar, { borderBottomColor: colors.borderColor }]}>
            {TABS.map(tab => (
              <TouchableOpacity
                key={tab.key}
                style={[
                  styles.tabItem,
                  activeTab === tab.key && { borderBottomColor: colors.tint, borderBottomWidth: 2 }
                ]}
                onPress={() => setActiveTab(tab.key)}
              >
                <Ionicons
                  name={tab.icon as any}
                  size={18}
                  color={activeTab === tab.key ? colors.tint : colors.textSecondary}
                />
                <Text style={[
                  styles.tabLabel,
                  { color: activeTab === tab.key ? colors.tint : colors.textSecondary }
                ]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Tab content */}
          <View style={styles.tabContent}>
            {activeTab === 'images' && renderImageGrid()}
            {activeTab === 'files' && renderFileList()}
            {activeTab === 'links' && renderLinkList()}
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
};

export default ChatInfoScreen;

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1,
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: '600' },

  // Profile
  profileSection: {
    alignItems: 'center', paddingVertical: 28, paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  profileAvatar: { width: 88, height: 88, borderRadius: 44, marginBottom: 12 },
  profileAvatarPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  profileAvatarText: { fontSize: 36, fontWeight: 'bold' },
  profileName: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  profileEmail: { fontSize: 14, marginBottom: 12 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginBottom: 20,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 13, fontWeight: '500' },
  actionButtons: { flexDirection: 'row', gap: 12 },
  actionButton: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20,
  },
  actionButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 },

  // Tabs
  tabBar: {
    flexDirection: 'row', borderBottomWidth: 1,
  },
  tabItem: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, gap: 6,
  },
  tabLabel: { fontSize: 13, fontWeight: '500' },
  tabContent: { paddingBottom: 32 },

  // Image grid
  imageGrid: { padding: 2 },
  imageGridItem: { flex: 1/3, margin: 2 },
  gridImage: { width: '100%', aspectRatio: 1, borderRadius: 4 },
  imageDate: { fontSize: 9, textAlign: 'center', marginTop: 2 },

  // File list
  fileItem: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    paddingVertical: 12, borderBottomWidth: 1, gap: 12,
  },
  fileIconContainer: {
    width: 44, height: 44, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  fileItemInfo: { flex: 1 },
  fileItemName: { fontSize: 14, fontWeight: '500', marginBottom: 3 },
  fileItemMeta: { fontSize: 12 },

  // Link list
  linkItem: {
    flexDirection: 'row', alignItems: 'center', marginHorizontal: 16,
    marginTop: 8, padding: 12, borderRadius: 10, gap: 10,
  },
  linkIconContainer: {
    width: 36, height: 36, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center',
  },
  linkInfo: { flex: 1 },
  linkUrl: { fontSize: 13, fontWeight: '500' },
  linkDate: { fontSize: 11, marginTop: 2 },

  // Empty
  emptyContainer: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { fontSize: 14, marginTop: 12 },
});