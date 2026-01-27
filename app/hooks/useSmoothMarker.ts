import { useEffect, useRef } from 'react';
import { useSharedValue, withTiming, Easing } from 'react-native-reanimated';

export type LatLng = { latitude: number; longitude: number };

export function useSmoothMarker(targetPos: LatLng | null, duration: number = 2000) {
    const lat = useSharedValue(targetPos?.latitude ?? 0);
    const lng = useSharedValue(targetPos?.longitude ?? 0);

    const lastTarget = useRef<LatLng | null>(null);

    useEffect(() => {
        if (targetPos && (targetPos.latitude !== lastTarget.current?.latitude || targetPos.longitude !== lastTarget.current?.longitude)) {
            lat.value = withTiming(targetPos.latitude, {
                duration: duration,
                easing: Easing.linear,
            });
            lng.value = withTiming(targetPos.longitude, {
                duration: duration,
                easing: Easing.linear,
            });
            lastTarget.current = targetPos;
        }
    }, [targetPos, duration]);

    return { lat, lng };
}
