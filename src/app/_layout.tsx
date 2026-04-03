import { API_BASE } from "@/constants/api";
import { AppColorSchemeProvider, useAppColorScheme } from "@/hooks/use-color-scheme";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Text, View } from "react-native";
import socketService from "./lib/socket";

SplashScreen.preventAutoHideAsync();

function RootLayoutInner() {
    const [appIsReady,setIsAppReady] = useState(false);
    const { resolvedScheme } = useAppColorScheme();
    const colorScheme = resolvedScheme;

    // In-app notification banner (non-blocking)
    const [bannerText, setBannerText] = useState<string | null>(null);
    const bannerY = useRef(new Animated.Value(-80)).current;
    const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        const socket = socketService.getSocket();
        if (!socket) return;

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
        paddingTop: 48,
        paddingBottom: 12,
        paddingHorizontal: 16,
        backgroundColor: colorScheme === 'dark' ? '#1E1E1E' : '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: colorScheme === 'dark' ? '#2C2C2E' : '#F0F0F0',
    }), [bannerY, colorScheme]);

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