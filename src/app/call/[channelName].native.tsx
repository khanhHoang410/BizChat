import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Constants from 'expo-constants';
import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { API_BASE } from '@/constants/api';
import socketService from '../lib/socket';

const BASE_URL = API_BASE;

export default function CallScreen() {
  const { channelName, targetId, isGroup } = useLocalSearchParams<{
    channelName: string;
    targetId: string;
    isGroup: string;
  }>();
  const router = useRouter();

  const isExpoGo = Constants.appOwnership === 'expo';
  const [engine, setEngine] = useState<any>(null);
  const [isJoined, setIsJoined] = useState(false);
  const [remoteUids, setRemoteUids] = useState<number[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerEnabled, setIsSpeakerEnabled] = useState(true);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [participantCount, setParticipantCount] = useState(1); // bản thân
  const [RtcSurfaceView, setRtcSurfaceView] = useState<any>(null);
  const [RenderModeType, setRenderModeType] = useState<any>(null);

  useEffect(() => {
    if (!isExpoGo) initAgora();
    return () => {
      if (engine) {
        engine.leaveChannel();
        engine.release();
      }
    };
  }, []);

  const initAgora = async () => {
    try {
      const agora = await import('react-native-agora');
      const {
        ChannelProfileType,
        ClientRoleType,
        RenderModeType,
        RtcSurfaceView,
        createAgoraRtcEngine,
      } = agora as unknown as {
        ChannelProfileType: any;
        ClientRoleType: any;
        RenderModeType: any;
        RtcSurfaceView: any;
        createAgoraRtcEngine: () => any;
      };
      setRtcSurfaceView(() => RtcSurfaceView);
      setRenderModeType(() => RenderModeType);

      const token = await AsyncStorage.getItem('userToken');
      const userInfo = await AsyncStorage.getItem('userInfo');
      const currentUser = userInfo ? JSON.parse(userInfo) : null;
      const uid = Number(currentUser?.id) || Math.floor(Math.random() * 1000000);

      // Lấy token từ backend
      const res = await fetch(`${BASE_URL}/api/agora/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ channelName, uid, role: 'publisher' }),
      });
      const { token: agoraToken, appId } = await res.json();

      // Tạo engine
      const rtcEngine = createAgoraRtcEngine();
      await rtcEngine.initialize({
        appId,
        channelProfile: ChannelProfileType.ChannelProfileLiveBroadcasting,
      });

      await rtcEngine.setClientRole(ClientRoleType.ClientRoleBroadcaster);
      await rtcEngine.enableVideo();

      // Đăng ký sự kiện
      rtcEngine.registerEventHandler({
        onJoinChannelSuccess: (_connection: any, elapsed: number) => {
          console.log('JoinChannelSuccess');
          setIsJoined(true);
        },
        onUserJoined: (_connection: any, remoteUid: number, elapsed: number) => {
          console.log('UserJoined', remoteUid);
          setRemoteUids(prev => [...prev, remoteUid]);
          setParticipantCount(prev => prev + 1);
        },
        onUserOffline: (_connection: any, remoteUid: number, reason: number) => {
          console.log('UserOffline', remoteUid);
          setRemoteUids(prev => prev.filter(uid => uid !== remoteUid));
          setParticipantCount(prev => prev - 1);
        },
        onError: (err: number, msg: string) => {
          console.error('Agora error', err, msg);
        },
      });

      setEngine(rtcEngine);

      // Tham gia kênh
      await rtcEngine.joinChannel(agoraToken, channelName, uid, {});
    } catch (error) {
      console.error('Agora init error:', error);
      Alert.alert(
        'Lỗi',
        "Không thể khởi tạo cuộc gọi. Nếu bạn đang dùng Expo Go thì bắt buộc phải dùng 'development build' (Expo Dev Client) để chạy Agora."
      );
      router.back();
    }
  };

  const toggleMute = async () => {
    if (!engine) return;
    await engine.muteLocalAudioStream(!isMuted);
    setIsMuted(!isMuted);
  };

  const toggleSpeaker = async () => {
    if (!engine) return;
    await engine.setEnableSpeakerphone(!isSpeakerEnabled);
    setIsSpeakerEnabled(!isSpeakerEnabled);
  };

  const switchCamera = async () => {
    if (!engine) return;
    await engine.switchCamera();
    setIsFrontCamera(!isFrontCamera);
  };

  const endCall = () => {
    if (engine) {
      engine.leaveChannel();
      engine.release();
    }
    const socket = socketService.getSocket();
    if (socket) {
      // Nếu là cuộc gọi 1-1, thông báo kết thúc cho người kia
      if (isGroup !== 'true' && targetId) {
        socket.emit('call_end', { to: targetId, channelName });
      }
      // Nếu là nhóm, có thể không cần gửi, hoặc gửi đến tất cả thành viên (tuỳ logic)
    }
    router.back();
  };

  // Hiển thị số người tham gia nếu là nhóm
  const participantText = isGroup === 'true' ? `• ${participantCount} người` : '';

  if (isExpoGo) {
    return (
      <View style={styles.container}>
        <View style={styles.waitingContainer}>
          <Text style={styles.waitingText}>
            Tính năng gọi (Agora) không chạy được trên Expo Go.{'\n'}
            Hãy tạo development build để dùng.
          </Text>
          <TouchableOpacity style={[styles.controlBtn, styles.endCallBtn]} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Video từ xa */}
      <View style={styles.remoteContainer}>
        {RtcSurfaceView && RenderModeType ? (
          remoteUids.length > 0 ? (
            remoteUids.map(uid => (
              <RtcSurfaceView
                key={uid}
                canvas={{ uid, renderMode: RenderModeType.RenderModeFit }}
                style={styles.remoteVideo}
              />
            ))
          ) : (
            <View style={styles.waitingContainer}>
              <Text style={styles.waitingText}>{isJoined ? 'Đang chờ người tham gia...' : 'Đang khởi tạo cuộc gọi...'}</Text>
            </View>
          )
        ) : (
          <View style={styles.waitingContainer}>
            <Text style={styles.waitingText}>Đang tải module cuộc gọi...</Text>
          </View>
        )}
      </View>

      {/* Video local */}
      {RtcSurfaceView && RenderModeType && (
        <View style={styles.localContainer}>
          <RtcSurfaceView
            canvas={{ uid: 0, renderMode: RenderModeType.RenderModeFit }}
            style={styles.localVideo}
          />
          {isGroup === 'true' && participantCount > 1 && (
            <View style={styles.participantBadge}>
              <Text style={styles.participantBadgeText}>{participantText}</Text>
            </View>
          )}
        </View>
      )}

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity style={styles.controlBtn} onPress={toggleMute}>
          <Ionicons name={isMuted ? 'mic-off' : 'mic'} size={24} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.controlBtn, styles.endCallBtn]} onPress={endCall}>
          <Ionicons name="call" size={28} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.controlBtn} onPress={toggleSpeaker}>
          <Ionicons name={isSpeakerEnabled ? 'volume-high' : 'volume-mute'} size={24} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.controlBtn} onPress={switchCamera}>
          <Ionicons name="camera-reverse" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  remoteContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  remoteVideo: { flex: 1, width: '100%' },
  waitingContainer: { justifyContent: 'center', alignItems: 'center' },
  waitingText: { color: '#fff', fontSize: 16 },
  localContainer: {
    position: 'absolute',
    top: 40,
    right: 20,
    width: 100,
    height: 150,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#fff',
  },
  localVideo: { flex: 1 },
  participantBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  participantBadgeText: {
    color: '#fff',
    fontSize: 10,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingBottom: 30,
    paddingTop: 20,
    backgroundColor: '#111',
  },
  controlBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  endCallBtn: { backgroundColor: '#E53935' },
});
