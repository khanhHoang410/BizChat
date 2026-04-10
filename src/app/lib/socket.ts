import { API_BASE } from '@/constants/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { io, Socket } from 'socket.io-client';

class SocketService {
  private socket: Socket | null = null;

  connect() {
    this.socket = io(API_BASE, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 12,
      reconnectionDelay: 1500,
    });

    this.socket.on('connect', () => {
      console.log('✅ Socket connected');
      void this.authenticate();
    });

    this.socket.io.on('reconnect', () => {
      void this.authenticate();
    });

    this.socket.on('disconnect', () => {
      console.log('❌ Socket disconnected');
    });
  }

  async authenticate() {
    const token = await AsyncStorage.getItem('userToken');
    if (token && this.socket) {
      this.socket.emit('authenticate', token);
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  getSocket() {
    return this.socket;
  }
}

export default new SocketService();