import { Colors } from '@/constants/theme';
import { useAppColorScheme } from '@/hooks/use-color-scheme';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Image } from 'react-native';

import {
    Alert,
    Linking,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// ─── FAQ data ─────────────────────────────────────────────────────────────────
const FAQ_LIST = [
  {
    q: 'Làm thế nào để gửi ảnh hoặc file?',
    a: 'Trong màn hình chat, bấm vào icon đính kèm (📎) ở góc trái thanh nhập tin nhắn. Chọn "Ảnh" để gửi ảnh từ thư viện, hoặc "File" để gửi tài liệu, video.',
  },
  {
    q: 'Làm thế nào để tạo nhóm chat?',
    a: 'Vào tab "Nhóm" ở thanh điều hướng phía dưới, bấm nút "+" góc trên phải. Nhập tên nhóm, chọn thành viên và bấm "Tạo".',
  },
  {
    q: 'Làm thế nào để thu hồi tin nhắn đã gửi?',
    a: 'Nhấn giữ (long press) vào tin nhắn muốn thu hồi, chọn "Thu hồi tin nhắn". Tin nhắn sẽ hiển thị "Tin nhắn đã được thu hồi" với cả 2 bên.',
  },
  {
    q: 'Làm thế nào để ghim tin nhắn quan trọng?',
    a: 'Nhấn giữ vào tin nhắn muốn ghim, chọn "Ghim tin nhắn". Tin nhắn được ghim sẽ hiển thị ở banner phía trên màn hình chat để dễ truy cập.',
  },
  {
    q: 'Làm thế nào để gọi video?',
    a: 'Trong màn hình chat 1-1 hoặc nhóm, bấm vào icon điện thoại ở góc trên phải. Đối với chat 1-1, người nhận sẽ được thông báo và có thể chấp nhận hoặc từ chối cuộc gọi.',
  },
  {
    q: 'Làm thế nào để tắt thông báo cho một cuộc trò chuyện?',
    a: 'Vào thông tin nhóm (bấm tên nhóm ở đầu màn hình chat), tìm mục "Tắt thông báo nhóm" và bật switch. Bạn cũng có thể tắt toàn bộ thông báo trong Profile > Cài đặt.',
  },
  {
    q: 'Làm thế nào để xem lại ảnh và file đã gửi trong nhóm?',
    a: 'Vào thông tin nhóm (bấm tên nhóm ở đầu màn hình chat), bấm vào "Ảnh & File". Bạn có thể chuyển qua lại giữa tab Ảnh và File.',
  },
  {
    q: 'Làm thế nào để rời khỏi hoặc giải tán nhóm?',
    a: 'Vào thông tin nhóm, kéo xuống phần "Thao tác". Thành viên có thể chọn "Rời khỏi nhóm". Chỉ người tạo nhóm mới có quyền "Giải tán nhóm".',
  },
//   {
//     q: 'Tại sao tôi không nhận được thông báo khi có tin nhắn mới?',
//     a: 'Hãy kiểm tra: (1) Thông báo trong Profile > Cài đặt đã bật chưa. (2) Quyền thông báo của app trong Cài đặt điện thoại đã được cấp chưa. (3) Cuộc trò chuyện đó có bị tắt thông báo riêng không.',
//   },
];

// ─── Component ────────────────────────────────────────────────────────────────
const HelpScreen = () => {
  const router = useRouter();
  const { resolvedScheme } = useAppColorScheme();
  const scheme = resolvedScheme;
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const toggleFAQ = (index: number) => {
    setExpandedIndex(prev => prev === index ? null : index);
  };

  const handleEmailSupport = () => {
  const email = 'khanh41020055@gmail.com';
  const subject = 'Hỗ trợ BizChat';
  
  Linking.openURL(`mailto:${email}?subject=${encodeURIComponent(subject)}`)
    .catch(() => {
      Linking.openURL(
        `https://mail.google.com/mail/?view=cm&to=${email}&su=${encodeURIComponent(subject)}`
      );
    });
};

  const handleOpenLink = (url: string, title: string) => {
    Linking.openURL(url).catch(() => {
      Alert.alert('Lỗi', `Không thể mở ${title}`);
    });
  };

  return (
    <>
    <Stack.Screen options={{ headerShown: false }} />
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.borderColor }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Trợ giúp</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* ── FAQ ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="help-circle-outline" size={20} color={colors.tint} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Câu hỏi thường gặp</Text>
          </View>

          {FAQ_LIST.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.faqItem, { borderColor: colors.borderColor, backgroundColor: colors.backgroundElement }]}
              onPress={() => toggleFAQ(index)}
              activeOpacity={0.7}
            >
              <View style={styles.faqQuestion}>
                <Text style={[styles.faqQuestionText, { color: colors.text }]} numberOfLines={expandedIndex === index ? undefined : 2}>
                  {item.q}
                </Text>
                <Ionicons
                  name={expandedIndex === index ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={colors.textSecondary}
                />
              </View>
              {expandedIndex === index && (
                <Text style={[styles.faqAnswer, { color: colors.textSecondary, borderTopColor: colors.borderColor }]}>
                  {item.a}
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Liên hệ & Links ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="information-circle-outline" size={20} color={colors.tint} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Liên hệ & Thông tin</Text>
          </View>

          {/* Email hỗ trợ */}
          <TouchableOpacity
            style={[styles.linkItem, { borderBottomColor: colors.borderColor, backgroundColor: colors.backgroundElement }]}
            onPress={handleEmailSupport}
            activeOpacity={0.7}
          >
            <View style={[styles.linkIcon, { backgroundColor: colors.tint + '15' }]}>
              <Ionicons name="mail-outline" size={20} color={colors.tint} />
            </View>
            <View style={styles.linkContent}>
              <Text style={[styles.linkTitle, { color: colors.text }]}>Email hỗ trợ</Text>
              <Text style={[styles.linkSub, { color: colors.textSecondary }]}>support@bizchat.app</Text>
            </View>
            <Ionicons name="open-outline" size={18} color={colors.textSecondary} />
          </TouchableOpacity>

          {/* Điều khoản sử dụng */}
          <TouchableOpacity
            style={[styles.linkItem, { borderBottomColor: colors.borderColor, backgroundColor: colors.backgroundElement }]}
            onPress={() => handleOpenLink('https://sites.google.com/view/bizchat/trang-ch%E1%BB%A7', 'Điều khoản sử dụng')}
            activeOpacity={0.7}
          >
            <View style={[styles.linkIcon, { backgroundColor: '#FF980015' }]}>
              <Ionicons name="document-text-outline" size={20} color="#FF9800" />
            </View>
            <View style={styles.linkContent}>
              <Text style={[styles.linkTitle, { color: colors.text }]}>Điều khoản sử dụng</Text>
              <Text style={[styles.linkSub, { color: colors.textSecondary }]}>bizchat.app/terms</Text>
            </View>
            <Ionicons name="open-outline" size={18} color={colors.textSecondary} />
          </TouchableOpacity>

          {/* Chính sách bảo mật */}
          <TouchableOpacity
            style={[styles.linkItem, { borderBottomColor: 'transparent', backgroundColor: colors.backgroundElement }]}
            onPress={() => handleOpenLink('https://sites.google.com/view/bizchat/trang-ch%E1%BB%A7', 'Chính sách bảo mật')}
            activeOpacity={0.7}
          >
            <View style={[styles.linkIcon, { backgroundColor: '#4CAF5015' }]}>
              <Ionicons name="shield-checkmark-outline" size={20} color="#4CAF50" />
            </View>
            <View style={styles.linkContent}>
              <Text style={[styles.linkTitle, { color: colors.text }]}>Chính sách bảo mật</Text>
              <Text style={[styles.linkSub, { color: colors.textSecondary }]}>bizchat.app/privacy</Text>
            </View>
            <Ionicons name="open-outline" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* ── Phiên bản ── */}
        <View style={[styles.versionBox, { backgroundColor: colors.backgroundElement }]}>
          <Image 
            source={require('@/assets/images/icon-bizchat.png')} 
            style={{ width: 64, height: 64, borderRadius: 14 }}
            />
          <Text style={[styles.appName, { color: colors.text }]}>BizChat</Text>
          <Text style={[styles.versionText, { color: colors.textSecondary }]}>Phiên bản 1.0.0</Text>
          <Text style={[styles.copyright, { color: colors.textSecondary }]}>© 2026 BizChat. All rights reserved.</Text>
        </View>

      </ScrollView>
    </SafeAreaView>
    </>
  );
};

export default HelpScreen;

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 17, fontWeight: '700' },

  section: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700' },

  // FAQ
  faqItem: {
    borderRadius: 12, borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 8, overflow: 'hidden',
  },
  faqQuestion: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 14, gap: 12,
  },
  faqQuestionText: { flex: 1, fontSize: 14, fontWeight: '500', lineHeight: 20 },
  faqAnswer: {
    fontSize: 14, lineHeight: 22, paddingHorizontal: 14, paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },

  // Links
  linkItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRadius: 0,
  },
  linkIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  linkContent: { flex: 1 },
  linkTitle: { fontSize: 15, fontWeight: '500', marginBottom: 2 },
  linkSub: { fontSize: 12 },

  // Version
  versionBox: {
    margin: 16, borderRadius: 16,
    padding: 24, alignItems: 'center', gap: 6,
  },
  appName: { fontSize: 18, fontWeight: '700', marginTop: 4 },
  versionText: { fontSize: 13 },
  copyright: { fontSize: 11, marginTop: 4 },
});