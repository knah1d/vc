import * as SecureStore from 'expo-secure-store';

// Keystore-backed (Android) / Keychain-backed (iOS) storage — never AsyncStorage
// for the auth token, since AsyncStorage is plaintext on disk.
const TOKEN_KEY = 'hush_auth_token';
const USER_KEY = 'hush_auth_user';
const DEVICE_TOKEN_KEY = 'hush_device_token';

export interface StoredUser {
  id: string;
  email: string;
  displayName: string;
}

export const storage = {
  getToken: () => SecureStore.getItemAsync(TOKEN_KEY),
  setToken: (token: string) => SecureStore.setItemAsync(TOKEN_KEY, token),
  clearToken: () => SecureStore.deleteItemAsync(TOKEN_KEY),

  async getUser(): Promise<StoredUser | null> {
    const raw = await SecureStore.getItemAsync(USER_KEY);
    return raw ? (JSON.parse(raw) as StoredUser) : null;
  },
  setUser: (user: StoredUser) => SecureStore.setItemAsync(USER_KEY, JSON.stringify(user)),
  clearUser: () => SecureStore.deleteItemAsync(USER_KEY),

  getDeviceToken: () => SecureStore.getItemAsync(DEVICE_TOKEN_KEY),
  setDeviceToken: (token: string) => SecureStore.setItemAsync(DEVICE_TOKEN_KEY, token),
  clearDeviceToken: () => SecureStore.deleteItemAsync(DEVICE_TOKEN_KEY),
};
