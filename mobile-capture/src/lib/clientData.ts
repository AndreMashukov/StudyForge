import * as Crypto from 'expo-crypto';
import { configureClientData } from '@studyforge/client-data/clientDb';
import { db } from './firebase';

// Side-effect module imported first by the root layout. React Native has no
// crypto.subtle, so learned-vocabulary ids hash through expo-crypto.
configureClientData({
  db,
  sha256Hex: (value) =>
    Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value),
});
