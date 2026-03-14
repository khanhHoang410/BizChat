import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import socketService from '../app/lib/socket';

import {
  ActivityIndicator,
  Alert,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import Animated, {
  FadeInDown,
  FadeInUp
} from 'react-native-reanimated';

export default function LoginScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    GoogleSignin.configure({
      webClientId: '296490459621-9kib4m5h4oi1ppetnn7bteu7vbs8kjv5.apps.googleusercontent.com',
      iosClientId: '296490459621-jsbtmljnv158ql755gflgakucomafqs6.apps.googleusercontent.com',
      offlineAccess: false,
    });
  }, []);

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo.data?.idToken ?? (userInfo as any).idToken;

      if (!idToken) {
        throw new Error('Không lấy được ID token');
      }
      
      await handleGoogleLogin(idToken);
      
    } catch (error: any) {
      console.error('❌ Google Sign-In error:', error);
      
      if (error.code === 'SIGN_IN_CANCELLED') {
        console.log('✋ User cancelled');
      } else {
        Alert.alert('Lỗi', error.message || 'Đăng nhập Google thất bại');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async (idToken: string) => {
    try {
      const res = await fetch('http://192.168.1.75:3001/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: idToken })
      });

      const data = await res.json();
      console.log('📦 Login response:', data); 

      if (res.ok) {
        await AsyncStorage.setItem('userToken', data.token);
        await AsyncStorage.setItem('userInfo', JSON.stringify(data.user));
        console.log('✅ Token saved:', data.token); // Debug token đã lưu
        socketService.connect();
        router.replace('/(tabs)');
      } else {
        Alert.alert('Lỗi', data.error || 'Đăng nhập thất bại');
      }
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể kết nối đến server');
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Gradient Background */}
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* Decorative Elements */}
        <View style={styles.decorCircle1} />
        <View style={styles.decorCircle2} />
      </LinearGradient>

      {/* Back button */}
      <Animated.View entering={FadeInUp.delay(200).duration(1000)}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
      </Animated.View>

      {/* Header */}
      <Animated.View 
        entering={FadeInUp.delay(400).duration(1000)}
        style={styles.header}
      >
        <View style={styles.logoContainer}>
          <LinearGradient
            colors={['#fff', '#f0f0f0']}
            style={styles.logoWrapper}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons name="chatbubbles" size={50} color="#667eea" />
          </LinearGradient>
        </View>
        <Text style={styles.title}>Chào mừng trở lại</Text>
        <Text style={styles.subtitle}>
          Rất vui được gặp lại bạn!{'\n'}Hãy đăng nhập để tiếp tục
        </Text>
      </Animated.View>

      {/* Login Card */}
      <Animated.View 
        entering={FadeInDown.delay(600).duration(1000)}
        style={styles.card}
      >
        <View style={styles.cardContent}>
          {/* Welcome Message */}
          <View style={styles.welcomeSection}>
            <Ionicons name="hand-left" size={28} color="#667eea" />
            <Text style={styles.welcomeText}>
              Đăng nhập để kết nối với bạn bè
            </Text>
          </View>

          {/* Google Login Button */}
          <TouchableOpacity
            style={styles.googleButton}
            onPress={handleGoogleSignIn}
            disabled={loading}
            activeOpacity={0.9}
          >
            {loading ? (
              <ActivityIndicator color="#667eea" />
            ) : (
              <>
                <View style={styles.googleIconContainer}>
                  <Ionicons name="logo-google" size={24} color="#DB4437" />
                </View>
                <Text style={styles.googleButtonText}>
                  Đăng nhập với Google
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>Bảo mật & an toàn</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Security Features */}
          <View style={styles.securityFeatures}>
            <View style={styles.securityItem}>
              <Ionicons name="lock-closed" size={16} color="#667eea" />
              <Text style={styles.securityText}>Mã hóa đầu cuối</Text>
            </View>
            <View style={styles.securityItem}>
              <Ionicons name="shield" size={16} color="#667eea" />
              <Text style={styles.securityText}>Bảo vệ 2 lớp</Text>
            </View>
          </View>
        </View>
      </Animated.View>

      {/* Register Link */}
      <Animated.View 
        entering={FadeInDown.delay(800).duration(1000)}
        style={styles.footer}
      >
        <Text style={styles.footerText}>Chưa có tài khoản? </Text>
        <TouchableOpacity onPress={() => router.push('/register')}>
          <Text style={styles.registerLink}>Đăng ký ngay</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  gradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '40%',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    overflow: 'hidden',
  },
  decorCircle1: {
    position: 'absolute',
    top: -50,
    right: -30,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#ffffff20',
  },
  decorCircle2: {
    position: 'absolute',
    bottom: -50,
    left: -30,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#ffffff20',
  },
  backButton: {
    padding: 20,
    marginTop: 40,
  },
  header: {
    alignItems: 'center',
    marginTop: 20,
  },
  logoContainer: {
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  logoWrapper: {
    width: 90,
    height: 90,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    opacity: 0.9,
    lineHeight: 24,
  },
  card: {
    flex: 1,
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginTop: 30,
    borderRadius: 25,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  cardContent: {
    padding: 25,
  },
  welcomeSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9ff',
    padding: 15,
    borderRadius: 15,
    marginBottom: 25,
  },
  welcomeText: {
    marginLeft: 10,
    fontSize: 15,
    color: '#333',
    flex: 1,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 20,
  },
  googleIconContainer: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 15,
  },
  googleButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e0e0e0',
  },
  dividerText: {
    marginHorizontal: 10,
    color: '#999',
    fontSize: 13,
    fontWeight: '500',
  },
  securityFeatures: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
  },
  securityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  securityText: {
    fontSize: 13,
    color: '#666',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    paddingBottom: 30,
  },
  footerText: {
    color: '#fff',
    fontSize: 15,
  },
  registerLink: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});