import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      {/* Header với logo */}
      <View style={styles.header}>
        <View style={styles.logoCircle}>
          <Ionicons name="chatbubbles" size={80} color="#4285F4" />
        </View>
        <Text style={styles.title}>BizChat</Text>
        <Text style={styles.subtitle}>
          Kết nối doanh nghiệp của bạn với đồng nghiệp một cách dễ dàng
        </Text>
      </View>

      {/* Features */}
      <View style={styles.features}>
        <View style={styles.featureItem}>
          <Ionicons name="chatbubble" size={32} color="#4285F4" />
          <View style={styles.featureText}>
            <Text style={styles.featureTitle}>Nhắn tin thời gian thực</Text>
            <Text style={styles.featureDesc}>Trò chuyện 1-1 hoặc nhóm với đồng nghiệp</Text>
          </View>
        </View>

        <View style={styles.featureItem}>
          <Ionicons name="people" size={32} color="#4285F4" />
          <View style={styles.featureText}>
            <Text style={styles.featureTitle}>Quản lý nhóm</Text>
            <Text style={styles.featureDesc}>Tạo nhóm làm việc, phân quyền dễ dàng</Text>
          </View>
        </View>

        <View style={styles.featureItem}>
          <Ionicons name="videocam" size={32} color="#4285F4" />
          <View style={styles.featureText}>
            <Text style={styles.featureTitle}>Họp video</Text>
            <Text style={styles.featureDesc}>Gọi video chất lượng cao với đồng nghiệp</Text>
          </View>
        </View>
      </View>

      {/* Buttons */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.loginButton}
          onPress={() => router.push('/Login')}
        >
          <Text style={styles.loginButtonText}>Đăng nhập</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.registerButton}
          onPress={() => router.push('/register')}
        >
          <Text style={styles.registerButtonText}>Tạo tài khoản mới</Text>
        </TouchableOpacity>

        <Text style={styles.termsText}>
          Bằng cách tiếp tục, bạn đồng ý với{' '}
          <Text style={styles.linkText}>Điều khoản sử dụng</Text>
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flex: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  logoCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#E8F0FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
  features: {
    flex: 1.5,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  featureItem: {
    flexDirection: 'row',
    marginBottom: 20,
    alignItems: 'center',
  },
  featureText: {
    marginLeft: 15,
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  featureDesc: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  footer: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'flex-end',
    paddingBottom: 30,
  },
  loginButton: {
    backgroundColor: '#4285F4',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  registerButton: {
    backgroundColor: '#fff',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 20,
  },
  registerButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  termsText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 12,
    lineHeight: 18,
  },
  linkText: {
    color: '#4285F4',
  },
});