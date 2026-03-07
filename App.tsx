// ─── EstimateOS Root App ──────────────────────────────────────────────────────
// Wires NavigationContainer → auth gate → onboarding gate → main tab navigator.
//
// Flow:
//   Launch → AuthProvider resolves Firebase user
//     ├─ No user   → AuthStack (LoginScreen)
//     └─ User      → isOnboardingComplete()?
//                    ├─ No  → OnboardingScreen (modal-style, full screen)
//                    └─ Yes → MainTabs
//                              ├─ Dashboard  (OperationsDashboardScreen)
//                              ├─ Estimates  (EstimateListScreen stub → NewEstimate)
//                              ├─ Customers  (CustomerListScreen)
//                              └─ Settings   (SettingsScreen)
//
// All screens in the app stack are registered in AppStack so any screen can
// navigate to any other screen regardless of which tab spawned it.

import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View, StatusBar, Platform } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from './src/estimateOS/auth/AuthContext';
import { LoginScreen } from './src/estimateOS/auth/LoginScreen';
import {
  OnboardingScreen,
  isOnboardingComplete,
  OnboardingData,
} from './src/estimateOS/screens/OnboardingScreen';

import { OperationsDashboardScreen } from './src/estimateOS/screens/OperationsDashboardScreen';
import { NewEstimateScreen }         from './src/estimateOS/screens/NewEstimateScreen';
import { EstimateDetailScreen }      from './src/estimateOS/screens/EstimateDetailScreen';
import { ReviewSendScreen }          from './src/estimateOS/screens/ReviewSendScreen';
import { AiSiteAnalysisScreen }      from './src/estimateOS/screens/AiSiteAnalysisScreen';
import { CustomerListScreen }        from './src/estimateOS/screens/CustomerListScreen';
import { CustomerDetailScreen }      from './src/estimateOS/screens/CustomerDetailScreen';
import { InvoiceScreen }             from './src/estimateOS/screens/InvoiceScreen';
import { SettingsScreen }            from './src/estimateOS/screens/SettingsScreen';
import { PricingRulesScreen }        from './src/estimateOS/screens/PricingRulesScreen';
import { CommTemplatesScreen }       from './src/estimateOS/screens/CommTemplatesScreen';
import { IntakeScreen }              from './src/estimateOS/screens/IntakeScreen';
import { EstimateListScreen }        from './src/estimateOS/screens/EstimateListScreen';

import { T } from './src/estimateOS/theme';

// ─── Navigation theme ─────────────────────────────────────────────────────────

const NAV_THEME = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    background:   T.bg,
    card:         T.surface,
    text:         T.text,
    border:       T.border,
    primary:      T.accent,
    notification: T.accent,
  },
};

// ─── Navigators ───────────────────────────────────────────────────────────────

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

const SCREEN_OPTIONS = {
  headerStyle:           { backgroundColor: T.surface },
  headerTintColor:       T.text,
  headerTitleStyle:      { fontWeight: '700' as const, fontSize: 17, color: T.text },
  headerShadowVisible:   false,
  contentStyle:          { backgroundColor: T.bg },
};

// ─── Dashboard tab stack ──────────────────────────────────────────────────────
// Intake and detail screens nest under Dashboard so navigation flows naturally.

function DashboardStack() {
  return (
    <Stack.Navigator screenOptions={SCREEN_OPTIONS}>
      <Stack.Screen
        name="Dashboard"
        component={OperationsDashboardScreen}
        options={{ title: 'Operations', headerShown: true }}
      />
      <Stack.Screen name="Intake"    component={IntakeScreen}    options={{ title: 'New Lead'      }} />
    </Stack.Navigator>
  );
}

// ─── Estimates tab stack ──────────────────────────────────────────────────────

function EstimatesStack() {
  return (
    <Stack.Navigator screenOptions={SCREEN_OPTIONS}>
      <Stack.Screen
        name="EstimateList"
        component={EstimateListScreen}
        options={{ title: 'Estimates' }}
      />
      <Stack.Screen name="NewEstimate"       component={NewEstimateScreen}       options={{ title: 'New Estimate'  }} />
      <Stack.Screen name="EstimateDetail"    component={EstimateDetailScreen}    options={{ title: 'Estimate'      }} />
      <Stack.Screen name="ReviewSend"        component={ReviewSendScreen}        options={{ title: 'Review & Send' }} />
      <Stack.Screen name="AiSiteAnalysis"    component={AiSiteAnalysisScreen}    options={{ title: 'AI Analysis'   }} />
      <Stack.Screen name="Invoice"           component={InvoiceScreen}           options={{ title: 'Invoice'       }} />
    </Stack.Navigator>
  );
}

// ─── Customers tab stack ──────────────────────────────────────────────────────

function CustomersStack() {
  return (
    <Stack.Navigator screenOptions={SCREEN_OPTIONS}>
      <Stack.Screen
        name="CustomerList"
        component={CustomerListScreen}
        options={{ title: 'Customers' }}
      />
      <Stack.Screen name="CustomerDetail" component={CustomerDetailScreen} options={{ title: 'Customer'  }} />
      <Stack.Screen name="EstimateDetail" component={EstimateDetailScreen} options={{ title: 'Estimate'  }} />
      <Stack.Screen name="Invoice"        component={InvoiceScreen}        options={{ title: 'Invoice'   }} />
      <Stack.Screen name="ReviewSend"     component={ReviewSendScreen}     options={{ title: 'Review & Send' }} />
    </Stack.Navigator>
  );
}

// ─── Settings tab stack ───────────────────────────────────────────────────────

function SettingsStack() {
  return (
    <Stack.Navigator screenOptions={SCREEN_OPTIONS}>
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: 'Settings' }}
      />
      <Stack.Screen name="CommTemplates" component={CommTemplatesScreen} options={{ title: 'Message Templates' }} />
      <Stack.Screen name="PricingRules"  component={PricingRulesScreen}  options={{ title: 'Pricing Rules'     }} />
    </Stack.Navigator>
  );
}

// ─── Bottom tab icons (text-based — no icon library needed) ──────────────────

function tabIcon(label: string, focused: boolean): string {
  const icons: Record<string, [string, string]> = {
    DashboardTab:  ['⬡', '⬡'],  // replace with expo-vector-icons if desired
    EstimatesTab:  ['📋', '📋'],
    CustomersTab:  ['👥', '👥'],
    SettingsTab:   ['⚙️', '⚙️'],
  };
  return (icons[label] ?? ['•', '●'])[focused ? 1 : 0];
}

// ─── Main tab navigator ───────────────────────────────────────────────────────

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: T.surface,
          borderTopColor:  T.border,
          borderTopWidth:  1,
          paddingBottom:   Platform.OS === 'ios' ? 4 : 8,
          height:          Platform.OS === 'ios' ? 84 : 64,
        },
        tabBarActiveTintColor:   T.accent,
        tabBarInactiveTintColor: T.sub,
        tabBarLabelStyle:        { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ focused }) => null,
      })}
    >
      <Tab.Screen name="DashboardTab"  component={DashboardStack}  options={{ title: 'Dashboard'  }} />
      <Tab.Screen name="EstimatesTab"  component={EstimatesStack}  options={{ title: 'Estimates'  }} />
      <Tab.Screen name="CustomersTab"  component={CustomersStack}  options={{ title: 'Customers'  }} />
      <Tab.Screen name="SettingsTab"   component={SettingsStack}   options={{ title: 'Settings'   }} />
    </Tab.Navigator>
  );
}

// ─── Root navigator — handles cross-tab deep links ────────────────────────────
// Screens accessible from ANY tab (e.g. EstimateDetail from Dashboard) are
// registered here at the root level so they can be pushed from any context.

function RootStack() {
  return (
    <Stack.Navigator screenOptions={{ ...SCREEN_OPTIONS, presentation: 'card' }}>
      <Stack.Screen name="MainTabs"      component={MainTabs}          options={{ headerShown: false }} />
      {/* Cross-tab screens — navigable from any tab context */}
      <Stack.Screen name="EstimateDetail"    component={EstimateDetailScreen}    options={{ title: 'Estimate'        }} />
      <Stack.Screen name="ReviewSend"        component={ReviewSendScreen}        options={{ title: 'Review & Send'   }} />
      <Stack.Screen name="Invoice"           component={InvoiceScreen}           options={{ title: 'Invoice'         }} />
      <Stack.Screen name="CustomerDetail"    component={CustomerDetailScreen}    options={{ title: 'Customer'        }} />
      <Stack.Screen name="NewEstimate"       component={NewEstimateScreen}       options={{ title: 'Estimate'        }} />
      <Stack.Screen name="AiSiteAnalysis"    component={AiSiteAnalysisScreen}    options={{ title: 'AI Analysis'     }} />
      <Stack.Screen name="Intake"            component={IntakeScreen}            options={{ title: 'New Lead'        }} />
      <Stack.Screen name="CommTemplates"     component={CommTemplatesScreen}     options={{ title: 'Templates'       }} />
      <Stack.Screen name="PricingRules"      component={PricingRulesScreen}      options={{ title: 'Pricing Rules'   }} />
    </Stack.Navigator>
  );
}

// ─── Auth stack ───────────────────────────────────────────────────────────────

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
    </Stack.Navigator>
  );
}

// ─── App gates: auth → onboarding → main ─────────────────────────────────────

function AppGate() {
  const { user, loading } = useAuth();
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);

  // Check onboarding once auth resolves
  useEffect(() => {
    if (!user) { setOnboardingDone(null); return; }
    isOnboardingComplete().then(done => setOnboardingDone(done));
  }, [user]);

  // Waiting for Firebase auth state to resolve
  if (loading || (user && onboardingDone === null)) {
    return (
      <View style={{ flex: 1, backgroundColor: T.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={T.accent} size="large" />
      </View>
    );
  }

  // Not signed in → login
  if (!user) return <AuthStack />;

  // Signed in but onboarding not complete
  if (!onboardingDone) {
    return (
      <OnboardingScreen
        onComplete={(_data: OnboardingData) => setOnboardingDone(true)}
      />
    );
  }

  // Fully ready
  return <RootStack />;
}

// ─── Root export ──────────────────────────────────────────────────────────────

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar barStyle="light-content" backgroundColor={T.bg} />
        <NavigationContainer theme={NAV_THEME}>
          <AppGate />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
