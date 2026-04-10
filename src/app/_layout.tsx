import { API_BASE } from "@/constants/api";
import { AppColorSchemeProvider, useAppColorScheme } from "@/hooks/use-color-scheme";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack, useRouter } from "expo-router";
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Image, Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import socketService from "./lib/socket";

SplashScreen.preventAutoHideAsync();

function RootLayoutInner() {
    const [appIsReady,setIsAppReady] = useState(false);
    const { resolvedScheme } = useAppColorScheme();
    const colorScheme = resolvedScheme;
    const router = useRouter();

    // In-app notification banner (non-blocking)
    const [bannerText, setBannerText] = useState<string | null>(null);
    const bannerY = useRef(new Animated.Value(-80)).current;
    const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ── Incoming call modal ───────────────────────────────────────────────────
    const [incomingCall, setIncomingCall] = useState<{
        from: string;
        channelName: string;
        callerName: string;
        callerAvatar?: string;
        isGroup?: boolean;
        groupId?: string;
    } | null>(null);

    useEffect(()=>{
        const initApp = async()=>{
            try {
                console.log('123');
            } catch (error) {
                console.log("123");
            }finally{
                setIsAppReady(true);
            }
        }
        initApp();
    },[])

    const showBanner = (text: string) => {
        setBannerText(text);
        Animated.timing(bannerY, { toValue: 0, duration: 220, useNativeDriver: true }).start();
        if (bannerTimer.current) clearTimeout(bannerTimer.current);
        bannerTimer.current = setTimeout(() => {
            Animated.timing(bannerY, { toValue: -80, duration: 220, useNativeDriver: true }).start(() => {
                setBannerText(null);
            });
        }, 2200);
    };

    useEffect(() => {
        if (!socketService.getSocket()) socketService.connect();

        const registerListeners = () => {
            const socket = socketService.getSocket();
            if (!socket) return;

            console.log('✅ Layout: registerListeners called');

            const handleIncomingCall = ({ from, channelName, callerName, callerAvatar }: any) => {
                console.log('📞 incoming_call nhận được!', callerName);
                setIncomingCall({ from, channelName, callerName, callerAvatar, isGroup: false });
            };

            const handleIncomingGroupCall = ({ from, groupId, channelName, callerName, callerAvatar }: any) => {
                console.log('📞 incoming_group_call nhận được!', callerName);
                setIncomingCall({ from, channelName, callerName, callerAvatar, isGroup: true, groupId });
            };

            const handler = async (data: any) => {
                try {
                    const token = await AsyncStorage.getItem('userToken');
                    if (!token) return;
                    const profileRes = await fetch(`${API_BASE}/api/auth/profile`, {
                        headers: { Authorization: `Bearer ${token}` },
                    });
                    const profile = await profileRes.json();
                    const settings = profile?.user?.settings;
                    if (settings?.notifications === false) return;
                    const msg = data?.message;
                    if (!msg) return;
                    const isGroup = data?.type === 'group';
                    const targetId = isGroup ? msg.group : msg.sender?._id;
                    const mutedList: string[] = isGroup ? (settings?.mutedGroups || []) : (settings?.mutedUsers || []);
                    if (targetId && mutedList?.some((x: any) => String(x) === String(targetId))) return;
                    const title = isGroup ? (msg.sender?.name || 'Nhóm') : (msg.sender?.name || 'Tin nhắn mới');
                    const content = msg.type === 'image' ? '📷 Ảnh' : msg.type === 'file' ? '📎 File' : (msg.content || 'Tin nhắn mới');
                    showBanner(`${title}: ${content}`);
                } catch { }
            };

            // Xóa listener cũ trước khi đăng ký mới (tránh duplicate)
            socket.off('incoming_call', handleIncomingCall);
            socket.off('incoming_group_call', handleIncomingGroupCall);
            socket.off('receive_message', handler);

            socket.on('incoming_call', handleIncomingCall);
            socket.on('incoming_group_call', handleIncomingGroupCall);
            socket.on('receive_message', handler);
        };

        socketService.onReady(registerListeners);
    }, []);

    const bannerStyle = useMemo(() => ({
        transform: [{ translateY: bannerY }],
        position: 'absolute' as const,
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        paddingTop: 48,
        paddingBottom: 12,
        paddingHorizontal: 16,
        backgroundColor: colorScheme === 'dark' ? '#1E1E1E' : '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: colorScheme === 'dark' ? '#2C2C2E' : '#F0F0F0',
    }), [bannerY, colorScheme]);

    const handleAcceptCall = () => {
        if (!incomingCall) return;
        const socket = socketService.getSocket();
        if (socket) {
            socket.emit('call_accept', { to: incomingCall.from, channelName: incomingCall.channelName });
        }
        const params = incomingCall.isGroup
            ? { channelName: incomingCall.channelName, targetId: incomingCall.groupId, isGroup: 'true' }
            : { channelName: incomingCall.channelName, targetId: incomingCall.from, isGroup: 'false' };
        setIncomingCall(null);
        router.push({ pathname: '/call/[channelName]', params } as any);
    };

    const handleRejectCall = () => {
        if (!incomingCall) return;
        const socket = socketService.getSocket();
        if (socket) {
            socket.emit('call_reject', { to: incomingCall.from });
        }
        setIncomingCall(null);
    };

    const onLayoutRootView = async () => {
        if (appIsReady) {
            await SplashScreen.hideAsync();
        }
    };

    if (!appIsReady) {
        return null;
    }

    return (
        <ThemeProvider value={colorScheme==='dark'?DarkTheme:DefaultTheme}>
        <View style={{flex:1}} onLayout={onLayoutRootView}>

        {/* ── Modal cuộc gọi đến giống Zalo ── */}
        <Modal visible={!!incomingCall} transparent animationType="slide">
            <View style={styles.callModalOverlay}>
                <View style={[styles.callModalBox, { backgroundColor: colorScheme === 'dark' ? '#1E1E1E' : '#fff' }]}>
                    {/* Avatar */}
                    <View style={styles.callAvatarWrapper}>
                        {incomingCall?.callerAvatar ? (
                            <Image source={{ uri: incomingCall.callerAvatar }} style={styles.callAvatar} />
                        ) : (
                            <View style={[styles.callAvatar, styles.callAvatarPlaceholder]}>
                                <Text style={styles.callAvatarLetter}>
                                    {incomingCall?.callerName?.charAt(0).toUpperCase() ?? '?'}
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* Info */}
                    <Text style={[styles.callType, { color: colorScheme === 'dark' ? '#aaa' : '#666' }]}>
                        {incomingCall?.isGroup ? 'Cuộc gọi video nhóm' : 'Cuộc gọi video'}
                    </Text>
                    <Text style={[styles.callerName, { color: colorScheme === 'dark' ? '#fff' : '#111' }]}>
                        {incomingCall?.callerName}
                    </Text>
                    <Text style={[styles.callStatus, { color: colorScheme === 'dark' ? '#aaa' : '#666' }]}>
                        Đang gọi cho bạn...
                    </Text>

                    {/* Buttons */}
                    <View style={styles.callButtons}>
                        {/* Từ chối */}
                        <View style={styles.callBtnWrapper}>
                            <TouchableOpacity style={[styles.callBtn, styles.rejectBtn]} onPress={handleRejectCall}>
                                <Text style={styles.callBtnIcon}>📵</Text>
                            </TouchableOpacity>
                            <Text style={[styles.callBtnLabel, { color: colorScheme === 'dark' ? '#aaa' : '#666' }]}>
                                Từ chối
                            </Text>
                        </View>

                        {/* Chấp nhận */}
                        <View style={styles.callBtnWrapper}>
                            <TouchableOpacity style={[styles.callBtn, styles.acceptBtn]} onPress={handleAcceptCall}>
                                <Text style={styles.callBtnIcon}>📞</Text>
                            </TouchableOpacity>
                            <Text style={[styles.callBtnLabel, { color: colorScheme === 'dark' ? '#aaa' : '#666' }]}>
                                Trả lời
                            </Text>
                        </View>
                    </View>
                </View>
            </View>
        </Modal>

        {bannerText && (
            <Animated.View style={bannerStyle}>
                <Text style={{ color: colorScheme === 'dark' ? '#FFFFFF' : '#111111', fontSize: 14 }} numberOfLines={2}>
                    {bannerText}
                </Text>
            </Animated.View>
        )}
        <Stack>
            <Stack.Screen name="Welcome" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="Login" options={{ headerShown: false }} />
            <Stack.Screen name="register" options={{ headerShown: false }} />
        </Stack>
        </View>
        </ThemeProvider>
    )
}

export default function RootLayout() {
    return (
        <AppColorSchemeProvider>
            <RootLayoutInner />
        </AppColorSchemeProvider>
    );
}

const styles = StyleSheet.create({
    // ── Incoming call modal ──
    callModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'flex-end',
    },
    callModalBox: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingTop: 32,
        paddingBottom: 48,
        paddingHorizontal: 24,
        alignItems: 'center',
        gap: 8,
    },
    callAvatarWrapper: { marginBottom: 8 },
    callAvatar: { width: 90, height: 90, borderRadius: 45 },
    callAvatarPlaceholder: {
        backgroundColor: '#667eea',
        justifyContent: 'center',
        alignItems: 'center',
    },
    callAvatarLetter: { fontSize: 36, fontWeight: '700', color: '#fff' },
    callType: { fontSize: 13, marginTop: 4 },
    callerName: { fontSize: 24, fontWeight: '700', textAlign: 'center' },
    callStatus: { fontSize: 14, marginBottom: 16 },
    callButtons: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        width: '100%',
        marginTop: 16,
        paddingHorizontal: 32,
    },
    callBtnWrapper: { alignItems: 'center', gap: 8 },
    callBtn: {
        width: 70, height: 70, borderRadius: 35,
        justifyContent: 'center', alignItems: 'center',
    },
    callBtnIcon: { fontSize: 32 },
    rejectBtn: { backgroundColor: '#E53935' },
    acceptBtn: { backgroundColor: '#43A047' },
    callBtnLabel: { fontSize: 13, fontWeight: '500' },
});