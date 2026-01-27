// import AsyncStorage from '@react-native-async-storage/async-storage';
import Pusher, { Channel } from 'pusher-js/react-native';

let client: Pusher | null = null;
let currentToken: string | null = null;

const PUSHER_KEY = process.env.EXPO_PUBLIC_PUSHER_KEY ?? '';
const PUSHER_CLUSTER = process.env.EXPO_PUBLIC_PUSHER_CLUSTER ?? 'mt1';
const WS_HOST = process.env.EXPO_PUBLIC_PUSHER_HOST ?? '';
const WS_PORT = Number(process.env.EXPO_PUBLIC_PUSHER_PORT ?? '443');
const USE_TLS = (process.env.EXPO_PUBLIC_PUSHER_TLS ?? 'true') === 'true';

const apiBase = (() => {
  const raw = process.env.EXPO_PUBLIC_API_URL ?? '';
  return raw.replace(/\/api\/?$/, '');
})();

async function buildClient(token: string) {
  if (!token) {
    throw new Error('Missing auth token for realtime communication');
  }

  if (client && currentToken === token) {
    return client;
  }

  if (client) {
    client.disconnect();
  }

  client = new Pusher(PUSHER_KEY, {
    cluster: PUSHER_CLUSTER,
    wsHost: WS_HOST,
    wsPort: WS_PORT,
    forceTLS: USE_TLS,
    enabledTransports: USE_TLS ? ['ws', 'wss'] : ['ws'],
    authEndpoint: `${apiBase}/broadcasting/auth`,
    auth: {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    },
    activityTimeout: 30000, // Detect dead connection faster (30s)
    pongTimeout: 10000,     // Wait 10s for pong
  });

  currentToken = token;
  return client;
}

export async function getPusherClient(token: string): Promise<Pusher> {
  return buildClient(token);
}

export function unsubscribeChannel(channel?: Channel | null) {
  if (channel && client) {
    channel.unbind_all();
    client.unsubscribe(channel.name);
  }
}

export function disconnectPusher() {
  if (client) {
    client.disconnect();
    client = null;
    currentToken = null;
  }
}

