import { API_BASE } from '@/constants/api';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    Animated,
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import socketService from '../lib/socket';

const BASE_URL = API_BASE;

export default function WaitingScreen() {
  const { channelName, targetId, targetName, targetAvatar, isGroup } = useLocalSearchParams<{
    channelName: string;
    targetId: string;
    targetName: string;
    targetAvatar: string;
    isGroup: string;
  }>();
  const router = useRouter();

  const [callDuration, setCallDuration] = useState(0);
  const [status, setStatus] = useState<'calling' | 'accepted' | 'rejected'>('calling');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Animation pulse cho avatar
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();

    // Lắng nghe socket
    const socket = socketService.getSocket();
    if (!socket) return;

    // Người kia nghe máy → navigate sang màn hình call
    const handleAccepted = ({ channelName: cn }: { channelName: string }) => {
      setStatus('accepted');
      if (timerRef.current) clearInterval(timerRef.current);
      router.replace({
        pathname: '/call/[channelName]',
        params: { channelName: cn || channelName, targetId, isGroup },
      });
    };

    // Người kia từ chối → back về
    const handleRejected = () => {
      setStatus('rejected');
      if (timerRef.current) clearInterval(timerRef.current);
      setTimeout(() => router.back(), 1500);
    };

    // Người kia kết thúc call sớm
    const handleEnded = () => {
      if (timerRef.current) clearInterval(timerRef.current);
      router.back();
    };

    socket.on('call_accepted', handleAccepted);
    socket.on('call_rejected', handleRejected);
    socket.on('call_ended', handleEnded);

    // Đếm thời gian chờ
    timerRef.current = setInterval(() => {
      setCallDuration(prev => {
        // Tự động hủy sau 60 giây không nghe
        if (prev >= 59) {
          handleCancel();
          return prev;
        }
        return prev + 1;
      });
    }, 1000);

    return () => {
      socket.off('call_accepted', handleAccepted);
      socket.off('call_rejected', handleRejected);
      socket.off('call_ended', handleEnded);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleCancel = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    const socket = socketService.getSocket();
    if (socket) {
      socket.emit('call_end', { to: targetId, channelName });
    }
    router.back();
  };

  const statusText = () => {
    if (status === 'rejected') return 'Cuộc gọi bị từ chối';
    if (status === 'accepted') return 'Đang kết nối...';
    return 'Đang gọi...';
  };

  return (
    <>
    <Stack.Screen options={{ headerShown: false }} />
    <View style={styles.container}>
      {/* Background gradient effect */}
      <View style={styles.bgTop} />
      <View style={styles.bgBottom} />

      {/* Avatar */}
      <View style={styles.avatarSection}>
        <Animated.View style={[styles.avatarPulse, { transform: [{ scale: pulseAnim }] }]}>
          <View style={styles.avatarRing} />
        </Animated.View>

        {targetAvatar ? (
          <Image source={{ uri: targetAvatar }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarLetter}>
              {targetName?.charAt(0).toUpperCase() ?? '?'}
            </Text>
          </View>
        )}
      </View>

      {/* Info */}
      <Text style={styles.name}>{targetName || 'Đang gọi...'}</Text>
      <Text style={styles.status}>{statusText()}</Text>

      {/* Nút kết thúc */}
      <View style={styles.controls}>
        <TouchableOpacity style={styles.endBtn} onPress={handleCancel}>
          <Ionicons name="call" size={32} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
        </TouchableOpacity>
        <Text style={styles.endLabel}>Kết thúc</Text>
      </View>
    </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bgTop: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: '50%',
    backgroundColor: '#16213e',
  },
  bgBottom: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: '50%',
    backgroundColor: '#0f3460',
  },

  // Avatar
  avatarSection: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    width: 160,
    height: 160,
  },
  avatarPulse: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
  },
  avatarRing: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  avatar: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#fff',
  },
  avatarPlaceholder: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  avatarLetter: {
    fontSize: 48,
    fontWeight: '700',
    color: '#fff',
  },

  // Info
  name: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  status: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 80,
  },

  // Controls
  controls: {
    alignItems: 'center',
    gap: 12,
  },
  endBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#E53935',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#E53935',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
  endLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
  },
});