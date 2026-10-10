import React, { type ComponentProps } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { colors } from '../theme';
import { useI18n } from '../i18n';
import BillingScreen from '../screens/BillingScreen';
import ProductsScreen from '../screens/ProductsScreen';
import CategoriesScreen from '../screens/CategoriesScreen';
import PartiesScreen from '../screens/PartiesScreen';
import StockScreen from '../screens/StockScreen';
import ReportsScreen from '../screens/ReportsScreen';
import SettingsScreen from '../screens/SettingsScreen';

export type RootTabParamList = {
  Billing: undefined;
  Products: undefined;
  Categories: undefined;
  Parties: undefined;
  Stock: undefined;
  Reports: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

type IconName = ComponentProps<typeof Ionicons>['name'];

// [active, inactive] icon per tab.
const TAB_ICONS: Record<keyof RootTabParamList, [IconName, IconName]> = {
  Billing: ['receipt', 'receipt-outline'],
  Products: ['cube', 'cube-outline'],
  Categories: ['grid', 'grid-outline'],
  Parties: ['people', 'people-outline'],
  Stock: ['layers', 'layers-outline'],
  Reports: ['calculator', 'calculator-outline'],
  Settings: ['settings', 'settings-outline'],
};

export default function RootNavigator() {
  const { t } = useI18n();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        // The tab bar already names each screen (icon + label), so the header's height goes to content instead.
        headerShown: false,
        tabBarIcon: ({ color, size, focused }) => (
          <Ionicons name={TAB_ICONS[route.name][focused ? 0 : 1]} color={color} size={size} />
        ),
        headerStyle: { backgroundColor: colors.surface },
        headerTitleStyle: { color: colors.ink, fontWeight: '700' },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.inkFaint,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
      })}
    >
      <Tab.Screen name="Billing" component={BillingScreen} options={{ title: t('common.tabBilling') }} />
      <Tab.Screen name="Products" component={ProductsScreen} options={{ title: t('common.tabProducts') }} />
      <Tab.Screen name="Categories" component={CategoriesScreen} options={{ title: t('common.tabCategories') }} />
      <Tab.Screen name="Parties" component={PartiesScreen} options={{ title: t('common.tabParties') }} />
      <Tab.Screen name="Stock" component={StockScreen} options={{ title: t('common.tabStock') }} />
      <Tab.Screen name="Reports" component={ReportsScreen} options={{ title: t('common.tabReports') }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: t('common.tabSettings') }} />
    </Tab.Navigator>
  );
}
