import { API_BASE } from '@/constants/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { io, Socket } from 'socket.io-client';

class SocketService {
  private socket: Socket | null = null;
  private readyCallbacks: (() => void)[] = [];
  private isAuthenticated = false;

  connect() {
    if (this.socket?.connected) return; // tránh connect 2 lần

    this.socket = io(API_BASE, {
      transports: ['websocket'],
      autoConnect: true,
    });

    this.socket.on('connect', () => {
      console.log('✅ Socket connected:', this.socket?.id);
      this.authenticate();
    });

    this.socket.on('auth_success', () => {
      console.log('✅ Socket auth_success — chạy', this.readyCallbacks.length, 'callbacks');
      this.isAuthenticated = true;
      this.readyCallbacks.forEach(cb => cb());
      this.readyCallbacks = [];
    });

    this.socket.on('disconnect', () => {
      console.log('❌ Socket disconnected');
      this.isAuthenticated = false;
    });

    this.socket.on('auth_error', (err: any) => {
      console.error('❌ Socket auth error:', err);
    });
  }

  async authenticate() {
    const token = await AsyncStorage.getItem('userToken');
    if (token && this.socket) {
      console.log('🔐 Emitting authenticate...');
      this.socket.emit('authenticate', token);
    } else {
      console.log('⚠️ No token found, skip authenticate');
    }
  }

  // Gọi callback khi socket đã authenticate xong
  onReady(callback: () => void) {
    if (this.isAuthenticated && this.socket?.connected) {
      callback();
    } else {
      this.readyCallbacks.push(callback);
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isAuthenticated = false;
      this.readyCallbacks = [];
    }
  }

  getSocket() {
    return this.socket;
  }
}

export default new SocketService();