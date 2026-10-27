import * as SecureStore from 'expo-secure-store';
// ASCII encoding makes the chunk limit a byte limit even for Unicode metadata.
export const secureStorage = {
  async getItem(key: string) {
    const count = Number(await SecureStore.getItemAsync(`${key}.count`));
    if (!count) return null;
    const parts = await Promise.all(
      Array.from({ length: count }, (_, i) => SecureStore.getItemAsync(`${key}.${i}`)),
    );
    if (parts.some((p) => p === null)) return null;
    try {
      return decodeURIComponent(parts.join(''));
    } catch {
      return null;
    }
  },
  async setItem(key: string, value: string) {
    await secureStorage.removeItem(key);
    const chunks = encodeURIComponent(value).match(/.{1,1500}/g) ?? [];
    await Promise.all(chunks.map((v, i) => SecureStore.setItemAsync(`${key}.${i}`, v)));
    await SecureStore.setItemAsync(`${key}.count`, String(chunks.length));
  },
  async removeItem(key: string) {
    const count = Number(await SecureStore.getItemAsync(`${key}.count`));
    await Promise.all(
      Array.from({ length: count }, (_, i) => SecureStore.deleteItemAsync(`${key}.${i}`)),
    );
    await SecureStore.deleteItemAsync(`${key}.count`);
  },
};
