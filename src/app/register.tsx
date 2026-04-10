import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import {
  GOOGLE_ANDROID_CLIENT_ID,
  GOOGLE_IOS_CLIENT_ID,
  GOOGLE_WEB_CLIENT_ID,
  postGoogleIdToken,
} from '@/lib/googleBackendAuth';

export default function RegisterScreen() {
  return Platform.OS === 'web' ? <RegisterScreenWeb /> : <RegisterScreenNative />;
}

function RegisterScreenWeb() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
  }, []);

  const [, , promptAsync] = Google.useIdTokenAuthRequest({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID,
  });

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      const result = await promptAsync();
      if (result?.type === 'success') {
        const idToken = result.params?.id_token as string | undefined;
        if (!idToken) {
          Alert.alert(
            'Lỗi',
            'Không lấy được ID token từ Google (web). Kiểm tra Google Cloud Console (localhost + redirect URI).'
          );
          return;
        }
        const { ok, data } = await postGoogleIdToken(idToken);
        if (ok) {
          await AsyncStorage.setItem('userToken', (data as { token: string }).token);
          await AsyncStorage.setItem('userInfo', JSON.stringify((data as { user: unknown }).user));
          Alert.alert('🎉 Thành công', 'Tài khoản của bạn đã được tạo!', [
            { text: 'Bắt đầu ngay', onPress: () => router.replace('/(tabs)') },
          ]);
        } else {
          Alert.alert('Lỗi', (data as { error?: string })?.error || 'Đăng ký thất bại');
        }
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('❌ Google Sign-In error (web):', error);
      if (!msg.toLowerCase().includes('cancel')) {
        Alert.alert('Lỗi', msg || 'Đăng ký Google thất bại');
      }
    } finally {
      setLoading(false);
    }
  };

  return <RegisterFormUI loading={loading} onGooglePress={handleGoogleSignIn} router={router} />;
}

function RegisterScreenNative() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
  }, []);

  const [, , promptAsync] = Google.useIdTokenAuthRequest({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID,
  });

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      const result = await promptAsync();
      if (result?.type !== 'success') return;

      const idToken = result.params?.id_token as string | undefined;
      if (!idToken) throw new Error('Không lấy được ID token');

      const { ok, data } = await postGoogleIdToken(idToken);
      if (ok) {
        await AsyncStorage.setItem('userToken', (data as { token: string }).token);
        await AsyncStorage.setItem('userInfo', JSON.stringify((data as { user: unknown }).user));
        Alert.alert('🎉 Thành công', 'Tài khoản của bạn đã được tạo!', [
          { text: 'Bắt đầu ngay', onPress: () => router.replace('/(tabs)') },
        ]);
      } else {
        Alert.alert('Lỗi', (data as { error?: string })?.error || 'Đăng ký thất bại');
      }
    } catch (error: unknown) {
      console.error('❌ Google Sign-In error:', error);
      const msg = error instanceof Error ? error.message : String(error);
      if (!msg.toLowerCase().includes('cancel')) Alert.alert('Lỗi', msg || 'Đăng ký Google thất bại');
    } finally {
      setLoading(false);
    }
  };

  return <RegisterFormUI loading={loading} onGooglePress={handleGoogleSignIn} router={router} />;
}

function RegisterFormUI({
  loading,
  onGooglePress,
  router,
}: {
  loading: boolean;
  onGooglePress: () => void;
  router: ReturnType<typeof useRouter>;
}) {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.circle1} />
      <View style={styles.circle2} />

      <Animated.View entering={FadeInUp.delay(200).duration(1000)}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(400).duration(1000)} style={styles.header}>
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

      <Animated.View entering={FadeInDown.delay(600).duration(1000)} style={styles.featuresContainer}>
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

      <Animated.View entering={FadeInDown.delay(800).duration(1000)} style={styles.form}>
        <TouchableOpacity
          style={styles.googleButton}
          onPress={onGooglePress}
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
              <Text style={styles.googleButtonText}>Tiếp tục với Google</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.termsText}>
          Bằng việc tiếp tục, bạn đồng ý với <Text style={styles.termsLink}>Điều khoản dịch vụ</Text> và{' '}
          <Text style={styles.termsLink}>Chính sách bảo mật</Text> của chúng tôi
        </Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(1000).duration(1000)} style={styles.footer}>
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
