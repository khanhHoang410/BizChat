import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import socketService from '../lib/socket';

const profile = () => {
  const handleLogout = async () => {
  await AsyncStorage.removeItem('userToken');
  socketService.disconnect(); // <-- Ngắt socket
  // router.replace('app/(tabs)/login');
};
  return (
    <View>
      <Text>profile</Text>
    </View>
  )
}

export default profile

const styles = StyleSheet.create({})