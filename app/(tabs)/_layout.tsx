import React from 'react'
import { Tabs } from 'expo-router'
import { Entypo, MaterialIcons } from '@expo/vector-icons';
import { PRIMARY_BG } from '@/constants/color';

const activeColor = PRIMARY_BG

export default function TabLayout() {
    return (
        <Tabs screenOptions={{
            headerShown: false
        }}>
            <Tabs.Screen name="home" options={{
                tabBarIcon: ({ focused, color, size }) => (
                    <Entypo
                        name="home"
                        size={focused ? size + 4 : size}
                        color={focused ? activeColor : color}
                    />
                )
            }} />

            <Tabs.Screen name="upload" options={{
                tabBarIcon: ({ focused, color, size }) => (
                    <Entypo
                        name="upload"
                        size={focused ? size + 4 : size}
                        color={focused ? activeColor : color}
                    />
                )
            }} />
            <Tabs.Screen name="leaderboard" options={{
                tabBarIcon: ({ focused, color, size }) => (
                    <MaterialIcons
                        name="leaderboard"
                        size={focused ? size + 4 : size}
                        color={focused ? activeColor : color}
                    />
                )
            }} />
            <Tabs.Screen name="profile" options={{
                tabBarIcon: ({ focused, color, size }) => (
                    <MaterialIcons
                        name="person"
                        size={focused ? size + 4 : size}
                        color={focused ? activeColor : color}
                    />
                )
            }} />
        </Tabs>
    )
}
