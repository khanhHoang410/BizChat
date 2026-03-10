import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from "react";
import { useColorScheme, View } from "react-native";
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
    const [appIsReady,setIsAppReady] = useState(false);
    const colorScheme = useColorScheme();
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
    const onLayoutRootView  =async()=>{
        if(appIsReady){
            await SplashScreen.hideAsync();
        }
    }
    if(!appIsReady){
        console.log('⏳ Waiting for app to be ready:', { appIsReady });
        return null;
    }

    return (
        <ThemeProvider value={colorScheme==='dark'?DarkTheme:DefaultTheme}>
        <View style={{flex:1}} onLayout={onLayoutRootView}>
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