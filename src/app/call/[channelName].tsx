import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

/**
 * Fallback (web + default): không import Agora. Trên iOS/Android file .native.tsx được ưu tiên.
 */
export default function CallScreenFallback() {
  const router = useRouter();
  useLocalSearchParams<{ channelName: string }>();

  return (
    <View style={styles.container}>
      <Ionicons name="videocam-off" size={64} color="#888" />
      <Text style={styles.title}>Cuộc gọi video/audio</Text>
      <Text style={styles.hint}>
        Tính năng gọi dùng Agora chỉ khả dụng trên ứng dụng iOS/Android. Trên web chỉ xem được giao diện
        chung — mở app trên điện thoại hoặc emulator để gọi.
      </Text>
      <TouchableOpacity style={styles.btn} onPress={() => router.back()} accessibilityRole="button">
        <Text style={styles.btnText}>Quay lại</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 16,
  },
  title: { color: '#fff', fontSize: 20, fontWeight: '600', textAlign: 'center' },
  hint: { color: '#aaa', fontSize: 15, textAlign: 'center', lineHeight: 22 },
  btn: {
    marginTop: 16,
    backgroundColor: '#667eea',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 10,
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
