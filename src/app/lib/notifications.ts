// import * as Device from 'expo-device';
// import * as Notifications from 'expo-notifications';
// import { Platform } from 'react-native';

// // Cấu hình hiển thị notification khi app đang mở
// Notifications.setNotificationHandler({
//   handleNotification: async () => ({
//     shouldShowBanner: true,
//     shouldShowList: true,
//     shouldPlaySound: true,
//     shouldSetBadge: true,
//   }),
// });

// export const registerPushToken = async (): Promise<string | null> => {
//   // Chỉ hoạt động trên thiết bị thật
//   if (!Device.isDevice) {
//     console.log('Push notification chỉ hoạt động trên thiết bị thật');
//     return null;
//   }

//   // Xin quyền
//   const { status: existingStatus } = await Notifications.getPermissionsAsync();
//   let finalStatus = existingStatus;

//   if (existingStatus !== 'granted') {
//     const { status } = await Notifications.requestPermissionsAsync();
//     finalStatus = status;
//   }

//   if (finalStatus !== 'granted') {
//     console.log('Không được cấp quyền notification');
//     return null;
//   }

//   // Lấy token
//   const token = (await Notifications.getExpoPushTokenAsync({
//     projectId: 'your-project-id', // ← thay bằng EAS project ID của bạn
//   })).data;

//   // Android cần notification channel
//   if (Platform.OS === 'android') {
//     await Notifications.setNotificationChannelAsync('messages', {
//       name: 'Tin nhắn',
//       importance: Notifications.AndroidImportance.MAX,
//       vibrationPattern: [0, 250, 250, 250],
//       lightColor: '#FF231F7C',
//       sound: 'default',
//     });
//   }

//   return token;
// };