/**
 * Stub cho web: Metro vẫn có thể resolve file .native (expo-router),
 * nên alias module react-native-agora → file này khi platform === 'web'.
 */
import React from 'react';
import { View } from 'react-native';

export const ChannelProfileType = { ChannelProfileLiveBroadcasting: 1 };
export const ClientRoleType = { ClientRoleBroadcaster: 1 };
export const RenderModeType = { RenderModeFit: 0 };

function createNoopEngine() {
  return {
    initialize: async () => {},
    setClientRole: async () => {},
    enableVideo: async () => {},
    registerEventHandler: () => {},
    joinChannel: async () => {},
    leaveChannel: async () => {},
    release: () => {},
    muteLocalAudioStream: async () => {},
    setEnableSpeakerphone: async () => {},
    switchCamera: async () => {},
  };
}

export function createAgoraRtcEngine() {
  return createNoopEngine();
}

export function RtcSurfaceView() {
  return React.createElement(View, { style: { flex: 0, width: 0, height: 0, overflow: 'hidden' } });
}

export default createAgoraRtcEngine;
