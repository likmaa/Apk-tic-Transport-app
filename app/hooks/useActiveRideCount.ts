import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export function useActiveRideCount() {
    const [count, setCount] = useState<number>(0);
    const API_URL: string | undefined = process.env.EXPO_PUBLIC_API_URL;

    useEffect(() => {
        let interval: any;

        const loadActiveCount = async () => {
            try {
                if (!API_URL) return;

                const token = await AsyncStorage.getItem('authToken');
                if (!token) return;

                const res = await fetch(`${API_URL}/passenger/rides/active-count`, {
                    headers: {
                        Accept: 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                });

                if (res.ok) {
                    const json = await res.json().catch(() => null);
                    if (json && typeof json.count === 'number') {
                        setCount(json.count);
                    }
                }
            } catch (err) {
                console.warn("Error fetching active ride count:", err);
            }
        };

        loadActiveCount();
        // Poll every 30 seconds for simplicity, or we could rely on Pusher
        interval = setInterval(loadActiveCount, 30000);

        return () => clearInterval(interval);
    }, [API_URL]);

    return count;
}
