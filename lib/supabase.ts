import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kzbzyfdvncufrmcavtlx.supabase.co';
const supabaseAnonKey = 'sb_publishable_8sWeaRcc2HhZ4y1RhVqE2Q_nmGKtbsN';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
