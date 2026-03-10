import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

export default function RegisterScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Khởi tạo Google Sign-In
  useEffect(() => {
    GoogleSignin.configure({
      webClientId: '296490459621-9kib4m5h4oi1ppetnn7bteu7vbs8kjv5.apps.googleusercontent.com',
      iosClientId: '296490459621-jsbtmljnv158ql755gflgakucomafqs6.apps.googleusercontent.com',
       offlineAccess: false, // Tắt nếu không cần refresh token
    });
  }, []);

  const handleGoogleSignIn = async () => {
  try {
    setLoading(true);
    
    // Kiểm tra Google Play Services (Android)
    await GoogleSignin.hasPlayServices();
    
    // Thực hiện đăng nhập
    const userInfo = await GoogleSignin.signIn();
    // ✅ CÁCH 1: Lấy idToken từ userInfo (Đơn giản nhất)
    // const idToken = userInfo.idToken;
    
    // ✅ CÁCH 2: Hoặc dùng getTokens() sau khi signIn
  const idToken = userInfo.data?.idToken ?? (userInfo as any).idToken;

    if (!idToken) {
      throw new Error('Không lấy được ID token');
    }
    
    console.log('✅ Đăng nhập Google thành công, token:', idToken);
    console.log('✅ User info:', userInfo);
    
    // Gửi token về backend
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
      const res = await fetch('http://192.168.1.33:3001/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: idToken })
      });

      const data = await res.json();

      if (res.ok) {
        await AsyncStorage.setItem('userToken', data.token);
        await AsyncStorage.setItem('userInfo', JSON.stringify(data.user));
        
        Alert.alert('Thành công', 'Đăng ký tài khoản thành công!', [
          { text: 'OK', onPress: () => router.replace('/(tabs)') }
        ]);
      } else {
        Alert.alert('Lỗi', data.error || 'Đăng ký thất bại');
      }
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể kết nối đến server');
    }
  };

  const handleLogout = async () => {
    try {
      await GoogleSignin.signOut();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <View style={styles.container}>
      {/* Back button */}
      <TouchableOpacity 
        style={styles.backButton}
        onPress={() => router.back()}
      >
        <Ionicons name="arrow-back" size={24} color="#333" />
      </TouchableOpacity>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Tạo tài khoản</Text>
        <Text style={styles.subtitle}>Đăng ký để bắt đầu sử dụng BizChat</Text>
      </View>

      {/* Google Register Button */}
      <View style={styles.form}>
        <TouchableOpacity
          style={styles.googleButton}
          onPress={handleGoogleSignIn}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#DB4437" />
          ) : (
            <>
              <Ionicons name="logo-google" size={24} color="#DB4437" />
              <Text style={styles.googleButtonText}>Đăng ký với Google</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>HOẶC</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Email option */}
        <TouchableOpacity 
          style={styles.emailButton}
          onPress={() => Alert.alert('Thông báo', 'Tính năng đang phát triển')}
        >
          <Ionicons name="mail-outline" size={24} color="#4285F4" />
          <Text style={styles.emailButtonText}>Đăng ký bằng Email</Text>
        </TouchableOpacity>
      </View>

      {/* Login Link */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Đã có tài khoản? </Text>
        <TouchableOpacity onPress={() => router.push('/Login')}>
          <Text style={styles.loginLink}>Đăng nhập</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// Styles giữ nguyên
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  backButton: {
    padding: 20,
  },
  header: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  form: {
    paddingHorizontal: 20,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    gap: 10,
    marginBottom: 20,
  },
  googleButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '500',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#ddd',
  },
  dividerText: {
    marginHorizontal: 10,
    color: '#999',
    fontSize: 14,
  },
  emailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#4285F4',
    borderRadius: 12,
    gap: 10,
    backgroundColor: '#f8f9ff',
  },
  emailButtonText: {
    color: '#4285F4',
    fontSize: 16,
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 30,
  },
  footerText: {
    color: '#666',
    fontSize: 14,
  },
  loginLink: {
    color: '#4285F4',
    fontSize: 14,
    fontWeight: '600',
  },
});