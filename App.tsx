import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Text, View } from 'react-native';
import { getDb } from './src/db/client';
import { PrinterProvider } from './src/printer/PrinterContext';
import { LanguageProvider } from './src/i18n';
import RootNavigator from './src/navigation/RootNavigator';
import { LoadingScreen } from './src/components/ui';
import { colors } from './src/theme';

const queryClient = new QueryClient();

export default function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDb()
      .then(() => setReady(true))
      .catch((err) => setError(String(err?.message ?? err)));
  }, []);

  if (error) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.bg }}>
        <Text style={{ color: colors.danger, fontWeight: '700', marginBottom: 8 }}>Could not open the database</Text>
        <Text style={{ color: colors.inkSoft, textAlign: 'center' }}>{error}</Text>
      </View>
    );
  }

  if (!ready) return <LoadingScreen />;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <PrinterProvider>
            <NavigationContainer>
              <RootNavigator />
              <StatusBar style="dark" />
            </NavigationContainer>
          </PrinterProvider>
        </LanguageProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
