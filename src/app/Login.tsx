import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import socketService from './lib/socket';
import {
  GOOGLE_IOS_CLIENT_ID,
  GOOGLE_WEB_CLIENT_ID,
  postEmailPasswordLogin,
  postGoogleIdToken,
} from '@/lib/googleBackendAuth';

export default function LoginScreen() {
  return Platform.OS === 'web' ? <LoginScreenWeb /> : <LoginScreenNative />;
}

async function persistSessionAndGoHome(
  data: { token: string; user: Record<string, unknown> },
  router: ReturnType<typeof useRouter>
) {
  await AsyncStorage.setItem('userToken', data.token);
  await AsyncStorage.setItem('userInfo', JSON.stringify(data.user));
  socketService.connect();
  router.replace('/(tabs)');
}

function LoginScreenWeb() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('vinmotion@gmail.com');
  const [password, setPassword] = useState('vinmotion');

  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
  }, []);

  const [, , promptAsync] = Google.useIdTokenAuthRequest({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID,
  });

  const handleEmailLogin = async () => {
    try {
      setLoading(true);
      const { ok, data } = await postEmailPasswordLogin(email, password);
      if (ok) {
        await persistSessionAndGoHome(data as { token: string; user: Record<string, unknown> }, router);
      } else {
        Alert.alert('Lỗi', (data as { error?: string })?.error || 'Đăng nhập thất bại');
      }
    } catch {
      Alert.alert('Lỗi', 'Không thể kết nối đến server');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      const result = await promptAsync();
      if (result?.type === 'success') {
        const idToken = result.params?.id_token as string | undefined;
        if (!idToken) {
          Alert.alert('Lỗi', 'Không lấy được ID token từ Google (web). Kiểm tra redirect URI trong Google Cloud Console cho http://localhost:8081.');
          return;
        }
        const { ok, data } = await postGoogleIdToken(idToken);
        if (ok) {
          await persistSessionAndGoHome(data as { token: string; user: Record<string, unknown> }, router);
        } else {
          Alert.alert('Lỗi', (data as { error?: string })?.error || 'Đăng nhập thất bại');
        }
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('❌ Google Sign-In error (web):', error);
      if (!msg.toLowerCase().includes('cancel')) {
        Alert.alert('Lỗi', msg || 'Đăng nhập Google thất bại');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <LoginFormUI
      loading={loading}
      email={email}
      password={password}
      onEmailChange={setEmail}
      onPasswordChange={setPassword}
      onEmailLogin={handleEmailLogin}
      onGooglePress={handleGoogleSignIn}
      router={router}
    />
  );
}

function LoginScreenNative() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('vinmotion@gmail.com');
  const [password, setPassword] = useState('vinmotion');

  useEffect(() => {
    GoogleSignin.configure({
      webClientId: GOOGLE_WEB_CLIENT_ID,
      iosClientId: GOOGLE_IOS_CLIENT_ID,
      offlineAccess: false,
    });
  }, []);

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo.data?.idToken ?? (userInfo as { idToken?: string }).idToken;

      if (!idToken) {
        throw new Error('Không lấy được ID token');
      }

      const { ok, data } = await postGoogleIdToken(idToken);
      if (ok) {
        await persistSessionAndGoHome(data as { token: string; user: Record<string, unknown> }, router);
      } else {
        Alert.alert('Lỗi', (data as { error?: string })?.error || 'Đăng nhập thất bại');
      }
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      console.error('❌ Google Sign-In error:', error);

      if (err.code === 'SIGN_IN_CANCELLED') {
        console.log('✋ User cancelled');
      } else {
        Alert.alert('Lỗi', err.message || 'Đăng nhập Google thất bại');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async () => {
    try {
      setLoading(true);
      const { ok, data } = await postEmailPasswordLogin(email, password);
      if (ok) {
        await persistSessionAndGoHome(data as { token: string; user: Record<string, unknown> }, router);
      } else {
        Alert.alert('Lỗi', (data as { error?: string })?.error || 'Đăng nhập thất bại');
      }
    } catch {
      Alert.alert('Lỗi', 'Không thể kết nối đến server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LoginFormUI
      loading={loading}
      email={email}
      password={password}
      onEmailChange={setEmail}
      onPasswordChange={setPassword}
      onEmailLogin={handleEmailLogin}
      onGooglePress={handleGoogleSignIn}
      router={router}
    />
  );
}

function LoginFormUI({
  loading,
  email,
  password,
  onEmailChange,
  onPasswordChange,
  onEmailLogin,
  onGooglePress,
  router,
}: {
  loading: boolean;
  email: string;
  password: string;
  onEmailChange: (v: string) => void;
  onPasswordChange: (v: string) => void;
  onEmailLogin: () => void;
  onGooglePress: () => void;
  router: ReturnType<typeof useRouter>;
}) {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <LinearGradient
        colors={['#667eea', '#764ba2']}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.decorCircle1} />
        <View style={styles.decorCircle2} />
      </LinearGradient>

      <Animated.View entering={FadeInUp.delay(200).duration(1000)}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(400).duration(1000)} style={styles.header}>
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

      <Animated.View entering={FadeInDown.delay(600).duration(1000)} style={styles.card}>
        <View style={styles.cardContent}>
          <View style={styles.welcomeSection}>
            <Ionicons name="hand-left" size={28} color="#667eea" />
            <Text style={styles.welcomeText}>Đăng nhập để kết nối với bạn bè</Text>
          </View>

          <Text style={styles.inputLabel}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="email@example.com"
            placeholderTextColor="#999"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={onEmailChange}
            editable={!loading}
          />
          <Text style={styles.inputLabel}>Mật khẩu</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor="#999"
            secureTextEntry
            value={password}
            onChangeText={onPasswordChange}
            editable={!loading}
          />
          <TouchableOpacity
            style={[styles.emailLoginButton, loading && styles.buttonDisabled]}
            onPress={onEmailLogin}
            disabled={loading}
            activeOpacity={0.9}
          >
            <Text style={styles.emailLoginButtonText}>Đăng nhập bằng email</Text>
          </TouchableOpacity>

          <View style={styles.orRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.orText}>hoặc</Text>
            <View style={styles.dividerLine} />
          </View>

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
                <Text style={styles.googleButtonText}>Đăng nhập với Google</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>Bảo mật & an toàn</Text>
            <View style={styles.dividerLine} />
          </View>

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

      <Animated.View entering={FadeInDown.delay(800).duration(1000)} style={styles.footer}>
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
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111',
    marginBottom: 14,
    backgroundColor: '#fafafa',
  },
  emailLoginButton: {
    backgroundColor: '#667eea',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  emailLoginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  orText: {
    marginHorizontal: 12,
    color: '#999',
    fontSize: 13,
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
