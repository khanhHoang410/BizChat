import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
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

const { width } = Dimensions.get('window');

export default function RegisterScreen() {
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
        Alert.alert('Lỗi', error.message || 'Đăng ký Google thất bại');
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

      if (res.ok) {
        await AsyncStorage.setItem('userToken', data.token);
        await AsyncStorage.setItem('userInfo', JSON.stringify(data.user));
        
        Alert.alert('🎉 Thành công', 'Tài khoản của bạn đã được tạo!', [
          { text: 'Bắt đầu ngay', onPress: () => router.replace('/(tabs)') }
        ]);
      } else {
        Alert.alert('Lỗi', data.error || 'Đăng ký thất bại');
      }
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể kết nối đến server');
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Background Decoration */}
      <View style={styles.circle1} />
      <View style={styles.circle2} />
      
      {/* Back button */}
      <Animated.View entering={FadeInUp.delay(200).duration(1000)}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
      </Animated.View>

      {/* Header với animation */}
      <Animated.View 
        entering={FadeInUp.delay(400).duration(1000)}
        style={styles.header}
      >
        <View style={styles.logoContainer}>
          <LinearGradient
            colors={['#667eea', '#764ba2']}
            style={styles.logoGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons name="chatbubbles" size={40} color="#fff" />
          </LinearGradient>
        </View>
        <Text style={styles.title}>Tạo tài khoản mới</Text>
        <Text style={styles.subtitle}>
          Tham gia cùng hàng ngàn người dùng{'\n'}
          trên BizChat
        </Text>
      </Animated.View>

      {/* Features List */}
      <Animated.View 
        entering={FadeInDown.delay(600).duration(1000)}
        style={styles.featuresContainer}
      >
        <View style={styles.featureItem}>
          <View style={styles.featureIcon}>
            <Ionicons name="chatbubble-outline" size={20} color="#667eea" />
          </View>
          <Text style={styles.featureText}>Nhắn tin miễn phí</Text>
        </View>
        <View style={styles.featureItem}>
          <View style={styles.featureIcon}>
            <Ionicons name="people-outline" size={20} color="#667eea" />
          </View>
          <Text style={styles.featureText}>Kết nối bạn bè</Text>
        </View>
        <View style={styles.featureItem}>
          <View style={styles.featureIcon}>
            <Ionicons name="shield-checkmark-outline" size={20} color="#667eea" />
          </View>
          <Text style={styles.featureText}>Bảo mật tuyệt đối</Text>
        </View>
      </Animated.View>

      {/* Google Register Button */}
      <Animated.View 
        entering={FadeInDown.delay(800).duration(1000)}
        style={styles.form}
      >
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
                Tiếp tục với Google
              </Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.termsText}>
          Bằng việc tiếp tục, bạn đồng ý với{' '}
          <Text style={styles.termsLink}>Điều khoản dịch vụ</Text> và{' '}
          <Text style={styles.termsLink}>Chính sách bảo mật</Text> của chúng tôi
        </Text>
      </Animated.View>

      {/* Login Link */}
      <Animated.View 
        entering={FadeInDown.delay(1000).duration(1000)}
        style={styles.footer}
      >
        <Text style={styles.footerText}>Đã có tài khoản? </Text>
        <TouchableOpacity onPress={() => router.push('/Login')}>
          <Text style={styles.loginLink}>Đăng nhập ngay</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9ff',
  },
  circle1: {
    position: 'absolute',
    top: -100,
    right: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#667eea20',
  },
  circle2: {
    position: 'absolute',
    bottom: -80,
    left: -40,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#764ba220',
  },
  backButton: {
    padding: 20,
    marginTop: 40,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  logoContainer: {
    marginBottom: 20,
  },
  logoGradient: {
    width: 80,
    height: 80,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
  featuresContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 20,
    marginBottom: 40,
    flexWrap: 'wrap',
    gap: 15,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  featureIcon: {
    marginRight: 6,
  },
  featureText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  form: {
    paddingHorizontal: 20,
    marginTop: 10,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    gap: 12,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#f0f0f0',
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
  termsText: {
    textAlign: 'center',
    marginTop: 20,
    fontSize: 12,
    color: '#999',
    lineHeight: 18,
    paddingHorizontal: 20,
  },
  termsLink: {
    color: '#667eea',
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
  },
  footerText: {
    color: '#666',
    fontSize: 15,
  },
  loginLink: {
    color: '#667eea',
    fontSize: 15,
    fontWeight: '700',
  },
});