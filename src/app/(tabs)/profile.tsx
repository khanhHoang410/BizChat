import { Colors } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import socketService from '../lib/socket';

type UserInfo = {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  status: 'online' | 'offline' | 'away';
  role: string;
  settings?: {
    notifications: boolean;
    theme: 'light' | 'dark';
  };
};

const ProfileScreen = () => {
  const router = useRouter();
  const scheme = useColorScheme();
  const colors = Colors['light'];
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [notifications, setNotifications] = useState(true);
  const [saving, setSaving] = useState(false);

  // Fetch thông tin user
  const fetchUserProfile = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await fetch('http://192.168.1.75:3001/api/auth/profile', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      console.log('👤 Profile:', data.user);
      setUser(data.user);
      setNotifications(data.user.settings?.notifications ?? true);
    } catch (error) {
      console.error('Fetch profile error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserProfile();
  }, []);

  // Cập nhật cài đặt
  const updateSettings = async (key: string, value: any) => {
    if (!user) return;
    
    setSaving(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await fetch('http://192.168.1.75:3001/api/users/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          settings: { ...user.settings, [key]: value }
        })
      });

      // if (response.ok) {
      //   setUser(prev => prev ? {
      //     ...prev,
      //     settings: { ...prev.settings, [key]: value }
      //   } : null);
      // }
    } catch (error) {
      console.error('Update settings error:', error);
    } finally {
      setSaving(false);
    }
  };

  // Đăng xuất
  const handleLogout = async () => {
    Alert.alert(
      'Đăng xuất',
      'Bạn có chắc chắn muốn đăng xuất?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Đăng xuất',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('userToken');
              await fetch('http://192.168.1.75:3001/api/auth/logout', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
              });
              
              await AsyncStorage.removeItem('userToken');
              await AsyncStorage.removeItem('userInfo');
              socketService.disconnect();
              router.replace('/Login');
            } catch (error) {
              console.error('Logout error:', error);
            }
          }
        }
      ]
    );
  };

  const handleChangeAvatar = () => {
    // TODO: Implement chọn ảnh từ thư viện
    Alert.alert('Thông báo', 'Tính năng đang phát triển');
  };

  const handleEditName = () => {
    // TODO: Implement sửa tên
    Alert.alert('Thông báo', 'Tính năng đang phát triển');
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} />
      
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Profile</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Avatar Section */}
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={handleChangeAvatar} style={styles.avatarWrapper}>
            {user?.avatar ? (
              <Image source={{ uri: user.avatar }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, { backgroundColor: colors.tint + '20' }]}>
                <Text style={[styles.avatarText, { color: colors.tint }]}>
                  {user?.name?.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={[styles.editBadge, { backgroundColor: colors.tint }]}>
              <Ionicons name="camera" size={14} color="#fff" />
            </View>
          </TouchableOpacity>
          
          <View style={styles.nameSection}>
            <Text style={[styles.name, { color: colors.text }]}>{user?.name}</Text>
            <TouchableOpacity onPress={handleEditName}>
              <Ionicons name="pencil" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          
          <Text style={[styles.email, { color: colors.textSecondary }]}>{user?.email}</Text>
          
          <View style={[styles.statusBadge, { 
            backgroundColor: user?.status === 'online' 
              ? colors.onlineStatus + '20' 
              : colors.offlineStatus + '20' 
          }]}>
            <View style={[styles.statusDot, { 
              backgroundColor: user?.status === 'online' 
                ? colors.onlineStatus 
                : colors.offlineStatus 
            }]} />
            <Text style={[styles.statusText, { 
              color: user?.status === 'online' 
                ? colors.onlineStatus 
                : colors.offlineStatus 
            }]}>
              {user?.status === 'online' ? 'Đang hoạt động' : 'Ngoại tuyến'}
            </Text>
          </View>
        </View>

        {/* Settings Section */}
        <View style={[styles.section, { borderTopColor: colors.borderColor }]}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>CÀI ĐẶT</Text>
          
          <View style={[styles.settingItem, { borderBottomColor: colors.borderColor }]}>
            <View style={styles.settingLeft}>
              <Ionicons name="notifications" size={22} color={colors.tint} />
              <Text style={[styles.settingText, { color: colors.text }]}>Thông báo</Text>
            </View>
            <Switch
              value={notifications}
              onValueChange={(value) => {
                setNotifications(value);
                updateSettings('notifications', value);
              }}
              trackColor={{ false: colors.borderColor, true: colors.tint }}
              thumbColor="#fff"
              disabled={saving}
            />
          </View>

          <View style={[styles.settingItem, { borderBottomColor: colors.borderColor }]}>
            <View style={styles.settingLeft}>
              <Ionicons name="moon" size={22} color={colors.tint} />
              <Text style={[styles.settingText, { color: colors.text }]}>Chế độ tối</Text>
            </View>
            <Switch
              value={scheme === 'dark'}
              onValueChange={() => {
                // TODO: Implement theme switching
                Alert.alert('Thông báo', 'Tính năng đang phát triển');
              }}
              trackColor={{ false: colors.borderColor, true: colors.tint }}
              thumbColor="#fff"
            />
          </View>

          <TouchableOpacity style={[styles.settingItem, { borderBottomColor: colors.borderColor }]}>
            <View style={styles.settingLeft}>
              <Ionicons name="lock-closed" size={22} color={colors.tint} />
              <Text style={[styles.settingText, { color: colors.text }]}>Quyền riêng tư</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.settingItem, { borderBottomColor: colors.borderColor }]}>
            <View style={styles.settingLeft}>
              <Ionicons name="help-circle" size={22} color={colors.tint} />
              <Text style={[styles.settingText, { color: colors.text }]}>Trợ giúp</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Account Section */}
        <View style={[styles.section, { borderTopColor: colors.borderColor }]}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>TÀI KHOẢN</Text>
          
          <View style={[styles.infoItem, { borderBottomColor: colors.borderColor }]}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Vai trò</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>
              {user?.role === 'admin' ? 'Quản trị viên' : 'Thành viên'}
            </Text>
          </View>

          <View style={[styles.infoItem, { borderBottomColor: colors.borderColor }]}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>ID</Text>
            <Text style={[styles.infoValue, { color: colors.text }]} numberOfLines={1}>
              {user?.id}
            </Text>
          </View>

          <View style={[styles.infoItem, { borderBottomColor: colors.borderColor }]}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Tham gia</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>
              {/* TODO: Format ngày tham gia */}
              Tháng 3, 2026
            </Text>
          </View>
        </View>

        {/* Logout Button */}
        <TouchableOpacity 
          style={[styles.logoutButton, { borderTopColor: colors.borderColor }]}
          onPress={handleLogout}
        >
          <Ionicons name="log-out" size={22} color={colors.error} />
          <Text style={[styles.logoutText, { color: colors.error }]}>Đăng xuất</Text>
        </TouchableOpacity>

        <View style={styles.version}>
          <Text style={[styles.versionText, { color: colors.textSecondary }]}>
            Phiên bản 1.0.0
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default ProfileScreen;

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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 40,
    fontWeight: 'bold',
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  nameSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  name: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  email: {
    fontSize: 14,
    marginBottom: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  section: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 8,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingText: {
    fontSize: 16,
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  infoLabel: {
    fontSize: 14,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    maxWidth: '60%',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    marginTop: 16,
    borderTopWidth: 1,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
  },
  version: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  versionText: {
    fontSize: 12,
  },
});