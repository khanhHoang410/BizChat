import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import * as SplashScreen from 'expo-splash-screen';
import Constants from 'expo-constants';
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, AppState, AppStateStatus, Platform, Text, View } from "react-native";
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

    // In-app notification banner (non-blocking)
    const [bannerText, setBannerText] = useState<string | null>(null);
    const bannerY = useRef(new Animated.Value(-80)).current;
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
        // Ensure socket is connected for global listeners
        if (!socketService.getSocket()) socketService.connect();
        const socket = socketService.getSocket();
        if (!socket) return;

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
                    showBanner(`${title}: ${body}`);
                }
            } catch {
                // ignore
            }
        };

        socket.on('receive_message', handler);
        return () => {
            socket.off('receive_message', handler);
        };
    }, []);

    const bannerStyle = useMemo(() => ({
        transform: [{ translateY: bannerY }],
        position: 'absolute' as const,
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        paddingTop: Math.max(insets.top, 12) + 8,
        paddingBottom: 12,
        paddingHorizontal: 16,
        backgroundColor: colorScheme === 'dark' ? '#1E1E1E' : '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: colorScheme === 'dark' ? '#2C2C2E' : '#F0F0F0',
    }), [bannerY, colorScheme, insets.top]);

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
        {bannerText && (
            <Animated.View style={bannerStyle}>
                <Text style={{ color: colorScheme === 'dark' ? '#FFFFFF' : '#111111', fontSize: 14 }} numberOfLines={2}>
                    {bannerText}
                </Text>
            </Animated.View>
        )}
        <Stack >
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
        <SafeAreaProvider>
            <AppColorSchemeProvider>
                <RootLayoutInner />
            </AppColorSchemeProvider>
        </SafeAreaProvider>
    );
}