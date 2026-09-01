import React, { useState } from 'react';
import { View, Text, StyleSheet, Platform, TouchableOpacity } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator, type NativeStackScreenProps } from '@react-navigation/native-stack';
import { createBottomTabNavigator, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { pixelColors } from '../theme/colors';
import { HomeScreen } from '../screens/HomeScreen';
import { ChatScreen } from '../screens/ChatScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { BookOpen, Sparkles, SlidersHorizontal } from 'lucide-react-native';

export type RootStackParamList = {
  Onboarding: undefined;
  Main: undefined;
};

export type MainTabParamList = {
  Shelf: undefined;
  Study: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

const CustomTabBar: React.FC<BottomTabBarProps> = ({ state, descriptors, navigation }) => {
  return (
    <View style={styles.tabBarContainer}>
      {state.routes.map((route, index: number) => {
        const { options } = descriptors[route.key];
        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        const renderTabIcon = () => {
          const color = isFocused ? pixelColors.pxBrass : pixelColors.pxMuted;
          const size = 20;
          switch (route.name) {
            case 'Shelf':
              return <BookOpen size={size} color={color} />;
            case 'Study':
              return <Sparkles size={size} color={color} />;
            case 'Settings':
              return <SlidersHorizontal size={size} color={color} />;
            default:
              return null;
          }
        };

        return (
          <TouchableOpacity
            key={route.key}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            testID={`tab-${route.name.toLowerCase()}`}
            onPress={onPress}
            style={[styles.tabButton, isFocused && styles.tabButtonActive]}
          >
            {isFocused && <View style={styles.activeTabGlow} />}
            {renderTabIcon()}
            <Text
              style={[
                styles.tabLabel,
                { color: isFocused ? pixelColors.pxBrass : pixelColors.pxMuted },
                isFocused && styles.tabLabelActive,
              ]}
            >
              {route.name.toUpperCase()}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const MainTabs: React.FC = () => {
  return (
    <Tab.Navigator
      tabBar={(props: BottomTabBarProps) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen name="Shelf" component={HomeScreen} />
      <Tab.Screen name="Study" component={ChatScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
};

export interface RootNavigatorProps {
  initialRouteName?: keyof RootStackParamList;
}

export const RootNavigator: React.FC<RootNavigatorProps> = ({
  initialRouteName = 'Main',
}) => {
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(
    initialRouteName === 'Main'
  );

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'fade',
        }}
        initialRouteName={hasCompletedOnboarding ? 'Main' : 'Onboarding'}
      >
        <Stack.Screen name="Onboarding">
          {(props: NativeStackScreenProps<RootStackParamList, 'Onboarding'>) => (
            <OnboardingScreen
              {...props}
              onComplete={() => {
                setHasCompletedOnboarding(true);
                props.navigation.navigate('Main');
              }}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="Main" component={MainTabs} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  tabBarContainer: {
    flexDirection: 'row',
    backgroundColor: pixelColors.pxVoid,
    borderTopWidth: 2,
    borderTopColor: pixelColors.pxBorder,
    height: Platform.OS === 'android' ? 64 : 80,
    paddingBottom: Platform.OS === 'android' ? 6 : 22,
    paddingTop: 6,
    elevation: 8,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    position: 'relative',
  },
  tabButtonActive: {
    backgroundColor: 'rgba(227, 176, 75, 0.06)',
  },
  activeTabGlow: {
    position: 'absolute',
    top: 0,
    left: '25%',
    right: '25%',
    height: 2,
    backgroundColor: pixelColors.pxBrass,
  },
  tabLabel: {
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginTop: 4,
  },
  tabLabelActive: {
    fontWeight: '800',
  },
});
