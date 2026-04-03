import { API_BASE } from '@/constants/api';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  ChannelProfileType,
  ClientRoleType,
  createAgoraRtcEngine,
  RenderModeType,
  RtcSurfaceView,
} from 'react-native-agora';
import socketService from '../lib/socket';


const BASE_URL = API_BASE;
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function CallScreen() {
  const { channelName, targetId, isGroup } = useLocalSearchParams<{
    channelName: string;
    targetId: string;
    isGroup: string;
  }>();
  const router = useRouter();
  const engineRef = useRef<any>(null);

  const [isJoined, setIsJoined] = useState(false);
  const [remoteUids, setRemoteUids] = useState<number[]>([]);
  const [localUid, setLocalUid] = useState<number>(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isSpeakerEnabled, setIsSpeakerEnabled] = useState(true);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const [videoOffUids, setVideoOffUids] = useState<Set<number>>(new Set()); // track ai đang tắt cam
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isGroupCall = isGroup === 'true';

  useEffect(() => {
    initAgora();
    return () => {
      cleanup();
    };
  }, []);

  // Timer đếm thời gian cuộc gọi
  useEffect(() => {
    if (isJoined) {
      timerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isJoined]);

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const cleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (engineRef.current) {
      engineRef.current.leaveChannel();
      engineRef.current.release();
      engineRef.current = null;
    }
  };

  const initAgora = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const userInfo = await AsyncStorage.getItem('userInfo');
      const currentUser = userInfo ? JSON.parse(userInfo) : null;
      const uid = Number(currentUser?.id) || Math.floor(Math.random() * 1000000);
      setLocalUid(uid);

      const res = await fetch(`${BASE_URL}/api/agora/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ channelName, uid, role: 'publisher' }),
      });
      const { token: agoraToken, appId } = await res.json();

      const rtcEngine = createAgoraRtcEngine();
      await rtcEngine.initialize({
        appId,
        channelProfile: ChannelProfileType.ChannelProfileLiveBroadcasting,
      });

      await rtcEngine.setClientRole(ClientRoleType.ClientRoleBroadcaster);
      await rtcEngine.enableVideo();
      await rtcEngine.enableAudio();
      await rtcEngine.startPreview();

      rtcEngine.registerEventHandler({
        onJoinChannelSuccess: () => {
          console.log('✅ JoinChannelSuccess');
          setIsJoined(true);
        },
        onUserJoined: (_connection: any, remoteUid: number) => {
          console.log('👤 UserJoined', remoteUid);
          setRemoteUids(prev => [...prev, remoteUid]);
        },
        onUserOffline: (_connection: any, remoteUid: number) => {
          console.log('👋 UserOffline', remoteUid);
          setRemoteUids(prev => {
            const updated = prev.filter(u => u !== remoteUid);
            // 1-1: người kia offline → kết thúc cuộc gọi
            if (!isGroupCall && updated.length === 0) {
              setTimeout(() => {
                cleanup();
                router.back();
              }, 500);
            }
            return updated;
          });
          setVideoOffUids(prev => { const s = new Set(prev); s.delete(remoteUid); return s; });
        },
        // Track người tắt/bật camera
        onRemoteVideoStateChanged: (_connection: any, remoteUid: number, state: number) => {
          // state 0 = stopped (tắt cam), state 2 = decoding (bật cam)
          setVideoOffUids(prev => {
            const s = new Set(prev);
            if (state === 0) s.add(remoteUid);
            else s.delete(remoteUid);
            return s;
          });
        },
        onError: (err: number, msg: string) => {
          console.error('Agora error', err, msg);
        },
      });

      engineRef.current = rtcEngine;
      await rtcEngine.joinChannel(agoraToken, channelName, uid, {});
    } catch (error) {
      console.error('Agora init error:', error);
      Alert.alert('Lỗi', 'Không thể khởi tạo cuộc gọi');
      router.back();
    }
  };

  const toggleMute = async () => {
    if (!engineRef.current) return;
    await engineRef.current.muteLocalAudioStream(!isMuted);
    setIsMuted(!isMuted);
  };

  const toggleVideo = async () => {
    if (!engineRef.current) return;
    await engineRef.current.muteLocalVideoStream(!isVideoOff);
    setIsVideoOff(!isVideoOff);
  };

  const toggleSpeaker = async () => {
    if (!engineRef.current) return;
    await engineRef.current.setEnableSpeakerphone(!isSpeakerEnabled);
    setIsSpeakerEnabled(!isSpeakerEnabled);
  };

  const switchCamera = async () => {
    if (!engineRef.current) return;
    await engineRef.current.switchCamera();
    setIsFrontCamera(!isFrontCamera);
  };

  const endCall = () => {
    const duration = callDuration; // lưu lại trước khi cleanup reset
    cleanup();
    const socket = socketService.getSocket();
    if (socket) {
      if (!isGroupCall && targetId) {
        socket.emit('call_end', {
          to: targetId,
          channelName,
          duration,
          isGroup: false,
        });
      } else if (isGroupCall && targetId) {
        socket.emit('call_end', {
          to: null,
          channelName,
          duration,
          isGroup: true,
          groupId: targetId,
        });
      }
    }
    router.back();
  };

  // ── Layout grid cho nhóm ────────────────────────────────────────────────────
  const renderGroupVideos = () => {
    const allUids = [0, ...remoteUids]; // 0 = local
    const count = allUids.length;

    // 1 người (chỉ mình)
    if (count === 1) {
      return (
        <View style={styles.gridFull}>
          <RtcSurfaceView
            canvas={{ uid: 0, renderMode: RenderModeType.RenderModeFit }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.videoLabel}>
            <Text style={styles.videoLabelText}>Bạn</Text>
          </View>
        </View>
      );
    }

    // 2 người → chia đôi dọc
    if (count === 2) {
      return (
        <View style={styles.gridHalf}>
          {allUids.map((uid, i) => (
            <View key={uid} style={styles.halfCell}>
              {videoOffUids.has(uid) || (uid === 0 && isVideoOff) ? (
                <View style={styles.videoOffPlaceholder}>
                  <Ionicons name="person" size={40} color="#555" />
                  <Text style={styles.videoOffText}>{uid === 0 ? 'Bạn' : `Người ${i}`}</Text>
                </View>
              ) : (
                <RtcSurfaceView
                  canvas={{ uid, renderMode: RenderModeType.RenderModeFit }}
                  style={StyleSheet.absoluteFill}
                />
              )}
              <View style={styles.videoLabel}>
                <Text style={styles.videoLabelText}>{uid === 0 ? 'Bạn' : `Người ${i}`}</Text>
              </View>
            </View>
          ))}
        </View>
      );
    }

    // 3-4 người → chia 4 ô (2x2)
    if (count <= 4) {
      const cells = [...allUids];
      while (cells.length < 4) cells.push(-1);
      return (
        <View style={styles.grid2x2}>
          {cells.map((uid, i) => (
            <View key={`${uid}_${i}`} style={styles.quarterCell}>
              {uid >= 0 ? (
                <>
                  {videoOffUids.has(uid) || (uid === 0 && isVideoOff) ? (
                    <View style={styles.videoOffPlaceholder}>
                      <Ionicons name="person" size={32} color="#555" />
                    </View>
                  ) : (
                    <RtcSurfaceView
                      canvas={{ uid, renderMode: RenderModeType.RenderModeFit }}
                      style={StyleSheet.absoluteFill}
                    />
                  )}
                  <View style={styles.videoLabel}>
                    <Text style={styles.videoLabelText}>{uid === 0 ? 'Bạn' : `Người ${i + 1}`}</Text>
                  </View>
                </>
              ) : (
                <View style={styles.emptyCell}>
                  <Ionicons name="person" size={32} color="#555" />
                </View>
              )}
            </View>
          ))}
        </View>
      );
    }

    // 5+ người → scroll grid (3 cột)
    return (
      <View style={styles.grid3col}>
        {allUids.map((uid, i) => (
          <View key={uid} style={styles.thirdCell}>
            <RtcSurfaceView
              canvas={{ uid, renderMode: RenderModeType.RenderModeFit }}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.videoLabel}>
              <Text style={styles.videoLabelText}>{uid === 0 ? 'Bạn' : `${i + 1}`}</Text>
            </View>
          </View>
        ))}
      </View>
    );
  };

  // ── Layout 1-1 (giữ nguyên) ─────────────────────────────────────────────────
  const renderPrivateVideos = () => (
    <>
      {/* Remote full screen */}
      <View style={styles.remoteContainer}>
        {remoteUids.length > 0 ? (
          videoOffUids.has(remoteUids[0]) ? (
            // Remote tắt camera → hiện placeholder
            <View style={styles.videoOffPlaceholder}>
              <View style={styles.videoOffAvatar}>
                <Ionicons name="person" size={64} color="#555" />
              </View>
              <Text style={styles.videoOffText}>Đã tắt camera</Text>
            </View>
          ) : (
            <RtcSurfaceView
              canvas={{ uid: remoteUids[0], renderMode: RenderModeType.RenderModeFit }}
              style={styles.remoteVideo}
            />
          )
        ) : (
          <View style={styles.waitingContainer}>
            <Ionicons name="videocam" size={48} color="#555" />
            <Text style={styles.waitingText}>Đang chờ kết nối...</Text>
            {isJoined && (
              <Text style={styles.durationText}>{formatDuration(callDuration)}</Text>
            )}
          </View>
        )}
      </View>

      {/* Local nhỏ góc trên */}
      <View style={styles.localContainer}>
        {isVideoOff ? (
          <View style={styles.videoOffContainer}>
            <Ionicons name="videocam-off" size={24} color="#fff" />
            <Text style={{ color: '#aaa', fontSize: 10, marginTop: 4 }}>Cam tắt</Text>
          </View>
        ) : (
          <RtcSurfaceView
            canvas={{ uid: 0, renderMode: RenderModeType.RenderModeFit }}
            style={styles.localVideo}
          />
        )}
      </View>
    </>
  );

  return (
    <>
        <Stack.Screen options={{ headerShown: false }} />
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {isGroupCall ? `Cuộc gọi nhóm • ${remoteUids.length + 1} người` : 'Cuộc gọi video'}
        </Text>
        {isJoined && (
          <Text style={styles.durationText}>{formatDuration(callDuration)}</Text>
        )}
      </View>

      {/* Video area */}
      <View style={styles.videoArea}>
        {isGroupCall ? renderGroupVideos() : renderPrivateVideos()}
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity style={styles.controlBtn} onPress={toggleMute}>
          <Ionicons name={isMuted ? 'mic-off' : 'mic'} size={24} color="#fff" />
          <Text style={styles.controlLabel}>{isMuted ? 'Bật mic' : 'Tắt mic'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.controlBtn} onPress={toggleVideo}>
          <Ionicons name={isVideoOff ? 'videocam-off' : 'videocam'} size={24} color="#fff" />
          <Text style={styles.controlLabel}>{isVideoOff ? 'Bật cam' : 'Tắt cam'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.controlBtn, styles.endCallBtn]} onPress={endCall}>
          <Ionicons name="call" size={28} color="#fff" />
          <Text style={styles.controlLabel}>Kết thúc</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.controlBtn} onPress={toggleSpeaker}>
          <Ionicons name={isSpeakerEnabled ? 'volume-high' : 'volume-mute'} size={24} color="#fff" />
          <Text style={styles.controlLabel}>{isSpeakerEnabled ? 'Loa ngoài' : 'Loa trong'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.controlBtn} onPress={switchCamera}>
          <Ionicons name="camera-reverse" size={24} color="#fff" />
          <Text style={styles.controlLabel}>Đổi cam</Text>
        </TouchableOpacity>
      </View>
    </View>
    </>
  );
}

const HALF_H = (SCREEN_HEIGHT - 180) / 2;
const QUARTER_W = SCREEN_WIDTH / 2;
const QUARTER_H = (SCREEN_HEIGHT - 180) / 2;
const THIRD_W = SCREEN_WIDTH / 3;
const THIRD_H = SCREEN_WIDTH / 3;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111' },

  // Header
  header: {
    paddingTop: 52,
    paddingBottom: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },
  durationText: { color: '#aaa', fontSize: 13, marginTop: 4 },

  // Video area
  videoArea: { flex: 1 },

  // ── Private layout ──
  remoteContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  remoteVideo: { flex: 1, width: '100%' },
  waitingContainer: { justifyContent: 'center', alignItems: 'center', gap: 12 },
  waitingText: { color: '#aaa', fontSize: 16 },
  localContainer: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 100,
    height: 150,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#fff',
  },
  localVideo: { flex: 1 },
  videoOffContainer: {
    flex: 1,
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Placeholder khi tắt camera
  videoOffPlaceholder: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    ...StyleSheet.absoluteFillObject,
  },
  videoOffText: {
    color: '#666',
    fontSize: 12,
  },
  videoOffAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Group layouts ──
  gridFull: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#000',
  },

  // 2 người — chia đôi dọc
  gridHalf: {
    flex: 1,
    flexDirection: 'column',
  },
  halfCell: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#1a1a1a',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#333',
  },
  // 3-4 người — 2x2
  grid2x2: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  quarterCell: {
    width: QUARTER_W,
    height: QUARTER_H,
    position: 'relative',
    backgroundColor: '#1a1a1a',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#333',
  },
  emptyCell: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },

  // 5+ người — 3 cột
  grid3col: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  thirdCell: {
    width: THIRD_W,
    height: THIRD_H,
    position: 'relative',
    backgroundColor: '#1a1a1a',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#333',
  },

  // Label tên dưới video
  videoLabel: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  videoLabelText: { color: '#fff', fontSize: 11, fontWeight: '500' },

  // Controls
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 36,
    paddingTop: 16,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  controlBtn: {
    alignItems: 'center',
    gap: 6,
    minWidth: 56,
    padding: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  endCallBtn: { backgroundColor: '#E53935' },
  controlLabel: { color: '#fff', fontSize: 10, fontWeight: '500' },
});