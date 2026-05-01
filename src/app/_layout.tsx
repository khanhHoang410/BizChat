import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import * as SplashScreen from 'expo-splash-screen';
import Constants from 'expo-constants';
import React, { useEffect, useRef, useState } from "react";
import { Animated, AppState, AppStateStatus, Image, Platform, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import socketService from "./lib/socket";
import { API_BASE } from "@/constants/api";
import { AppColorSchemeProvider, useAppColorScheme } from "@/hooks/use-color-scheme";
import AsyncStorage from "@react-native-async-storage/async-storage";
SplashScreen.preventAutoHideAsync();

// expo-notifications bị xóa khỏi Expo Go từ SDK 53.
// Chỉ import + dùng khi chạy trên development build hoặc production build.
const isExpoGo = Constants.appOwnership === 'expo';

function RootLayoutInner() {
    const [appIsReady,setIsAppReady] = useState(false);
    const { resolvedScheme } = useAppColorScheme();
    const colorScheme = resolvedScheme;
    const insets = useSafeAreaInsets();

    // In-app notification banner — Messenger style
    const [bannerData, setBannerData] = useState<{ title: string; body: string; avatar?: string } | null>(null);
    const bannerY = useRef(new Animated.Value(-120)).current;
    const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Track app state để biết đang foreground hay background
    const appStateRef = useRef<AppStateStatus>(AppState.currentState);

    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextState) => {
            appStateRef.current = nextState;
        });
        return () => subscription.remove();
    }, []);

    useEffect(()=>{
        const initApp = async()=>{
            try {
                if (!isExpoGo && Platform.OS !== 'web') {
                    // Chỉ chạy trên Development Build hoặc Production
                    const Notifications = await import('expo-notifications');
                    Notifications.setNotificationHandler({
                        handleNotification: async () => ({
                            shouldShowAlert: false,
                            shouldPlaySound: false,
                            shouldSetBadge: false,
                        }),
                    });
                    await Notifications.requestPermissionsAsync();
                    if (Platform.OS === 'android') {
                        await Notifications.setNotificationChannelAsync('messages', {
                            name: 'Tin nhắn mới',
                            importance: Notifications.AndroidImportance.HIGH,
                            vibrationPattern: [0, 250, 250, 250],
                            lightColor: '#208AEF',
                            sound: 'default',
                        });
                    }
                }
            } catch (error) {
                console.log('Notification setup error:', error);
            } finally {
                setIsAppReady(true);
            }
        };
        initApp();
    },[])

    const showBanner = (data: { title: string; body: string; avatar?: string }) => {
        setBannerData(data);
        Animated.spring(bannerY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 80,
            friction: 10,
        }).start();
        if (bannerTimer.current) clearTimeout(bannerTimer.current);
        bannerTimer.current = setTimeout(() => {
            Animated.timing(bannerY, { toValue: -120, duration: 280, useNativeDriver: true }).start(() => {
                setBannerData(null);
            });
        }, 3500);
    };

    useEffect(() => {
        let currentSocket: ReturnType<typeof socketService.getSocket> = null;

        const attachHandler = (socket: NonNullable<ReturnType<typeof socketService.getSocket>>) => {
            // Gỡ listener cũ nếu có (tránh duplicate)
            socket.off('receive_message', handler);
            socket.on('receive_message', handler);
            console.log('✅ [Notification] receive_message listener attached');
        };

        const handler = async (data: any) => {
            try {
                const token = await AsyncStorage.getItem('userToken');
                if (!token) return;

                const msg = data?.message;
                if (!msg) return;

                // Bỏ qua nếu chính mình gửi
                const senderId = msg.sender?._id != null ? String(msg.sender._id) : (msg.sender?.id != null ? String(msg.sender.id) : '');
                try {
                    const meRaw = await AsyncStorage.getItem('userInfo');
                    if (meRaw && senderId) {
                        const me = JSON.parse(meRaw) as { id?: string };
                        if (me?.id && String(me.id) === senderId) return;
                    }
                } catch {
                    // ignore
                }

                // Kiểm tra mute settings
                const profileRes = await fetch(`${API_BASE}/api/auth/profile`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const profile = await profileRes.json();
                const settings = profile?.user?.settings;
                if (settings?.notifications === false) return;

                const isGroup = data?.type === 'group';
                const targetId = isGroup ? msg.group : msg.sender?._id;
                const mutedList: string[] = isGroup ? (settings?.mutedGroups || []) : (settings?.mutedUsers || []);
                if (targetId && mutedList?.some((x: any) => String(x) === String(targetId))) return;

                const senderName = isGroup ? (msg.sender?.name || 'Ai đó') : (msg.sender?.name || 'Tin nhắn mới');
                const groupName = isGroup ? (msg.groupName || 'Nhóm') : null;
                const title = isGroup ? `${groupName} • ${senderName}` : senderName;
                const body = msg.type === 'image' ? '📷 Đã gửi một ảnh'
                           : msg.type === 'file'  ? '📎 Đã gửi một file'
                           : (msg.content || 'Tin nhắn mới');

                const isBackground = appStateRef.current === 'background' || appStateRef.current === 'inactive';

                if (!isExpoGo && isBackground && Platform.OS !== 'web') {
                    // ── Development/Production Build + App background → local notification ──
                    const Notifications = await import('expo-notifications');
                    await Notifications.scheduleNotificationAsync({
                        content: {
                            title,
                            body,
                            sound: 'default',
                            data: {
                                type: isGroup ? 'group' : 'private',
                                chatId: isGroup ? String(msg.group) : senderId,
                            },
                        },
                        trigger: null,
                        ...(Platform.OS === 'android' ? { channelId: 'messages' } as any : {}),
                    });
                } else {
                    // ── Expo Go hoặc app foreground → in-app banner ──
                    showBanner({ title, body, avatar: msg.sender?.avatar });
                }
            } catch (e) {
                console.log('[Notification] handler error:', e);
            }
        };

        // Poll mỗi 1s cho đến khi socket xuất hiện (sau login), rồi gắn listener
        const interval = setInterval(() => {
            const socket = socketService.getSocket();
            if (socket && socket !== currentSocket) {
                currentSocket = socket;
                attachHandler(socket);

                // Khi socket reconnect, gắn lại listener
                socket.on('connect', () => attachHandler(socket));
            }
        }, 1000);

        return () => {
            clearInterval(interval);
            if (currentSocket) {
                currentSocket.off('receive_message', handler);
            }
        };
    }, []);


    const onLayoutRootView = async () => {
        if (appIsReady) {
            await SplashScreen.hideAsync();
        }
    };

    if (!appIsReady) {
        return null;
    }

    const isDark = colorScheme === 'dark';
    const avatarInitial = bannerData?.title?.[0]?.toUpperCase() ?? '?';

    return (
        <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
        <View style={{ flex: 1 }} onLayout={onLayoutRootView}>

        {/* ── Messenger-style floating notification banner ── */}
        {bannerData && (
            <Animated.View
                style={{
                    transform: [{ translateY: bannerY }],
                    position: 'absolute',
                    top: Math.max(insets.top, 14) + 4,
                    left: 12,
                    right: 12,
                    zIndex: 9999,
                    borderRadius: 20,
                    backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: isDark ? 0.5 : 0.15,
                    shadowRadius: 16,
                    elevation: 12,
                    overflow: 'hidden',
                }}
            >
                <TouchableOpacity
                    activeOpacity={0.92}
                    onPress={() => {
                        if (bannerTimer.current) clearTimeout(bannerTimer.current);
                        Animated.timing(bannerY, { toValue: -120, duration: 220, useNativeDriver: true }).start(() => setBannerData(null));
                    }}
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: 14,
                        paddingVertical: 12,
                        gap: 12,
                    }}
                >
                    {/* Avatar */}
                    <View style={{ position: 'relative' }}>
                        {bannerData.avatar ? (
                            <Image
                                source={{ uri: bannerData.avatar }}
                                style={{ width: 44, height: 44, borderRadius: 22 }}
                            />
                        ) : (
                            <View style={{
                                width: 44,
                                height: 44,
                                borderRadius: 22,
                                backgroundColor: '#0084FF',
                                justifyContent: 'center',
                                alignItems: 'center',
                            }}>
                                <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>
                                    {avatarInitial}
                                </Text>
                            </View>
                        )}
                        {/* Blue dot indicator (Messenger style) */}
                        <View style={{
                            position: 'absolute',
                            bottom: 0,
                            right: 0,
                            width: 14,
                            height: 14,
                            borderRadius: 7,
                            backgroundColor: '#0084FF',
                            borderWidth: 2,
                            borderColor: isDark ? '#1C1C1E' : '#FFFFFF',
                        }} />
                    </View>

                    {/* Text content */}
                    <View style={{ flex: 1 }}>
                        <Text
                            style={{
                                fontSize: 14,
                                fontWeight: '700',
                                color: isDark ? '#FFFFFF' : '#000000',
                                marginBottom: 2,
                            }}
                            numberOfLines={1}
                        >
                            {bannerData.title}
                        </Text>
                        <Text
                            style={{
                                fontSize: 13,
                                color: isDark ? '#ABABAB' : '#555555',
                                lineHeight: 18,
                            }}
                            numberOfLines={1}
                        >
                            {bannerData.body}
                        </Text>
                    </View>

                    {/* Dismiss hint */}
                    <Text style={{ fontSize: 11, color: isDark ? '#555' : '#BBB', marginLeft: 4 }}>✕</Text>
                </TouchableOpacity>
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
    );

}

export default function RootLayout() {
    return (
        <SafeAreaProvider>
            <AppColorSchemeProvider>
                <RootLayoutInner />
            </AppColorSchemeProvider>
        </SafeAreaProvider>
    );
}