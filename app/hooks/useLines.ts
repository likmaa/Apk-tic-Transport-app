import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Stop = {
  id: number;
  code: string;
  name: string;
  lat: number | null;
  lng: number | null;
};

export type LineStop = {
  id: number;
  code: string;
  name: string;
  pivot: { position: number };
};

export type Line = {
  id: number;
  code: string;
  name: string;
  stops: LineStop[];
};

export function useLines() {
  const [stops, setStops] = useState<Stop[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [loading, setLoading] = useState(true);
  const API_URL = process.env.EXPO_PUBLIC_API_URL;

  useEffect(() => {
    const load = async () => {
      try {
        if (!API_URL) return;
        const token = await AsyncStorage.getItem('authToken');
        if (!token) return;

        const [stopsRes, linesRes] = await Promise.all([
          fetch(`${API_URL}/passenger/stops`, {
            headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_URL}/passenger/lines`, {
            headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
          }),
        ]);

        if (stopsRes.ok) {
          const s = await stopsRes.json();
          const stopsArray = Array.isArray(s) ? s : (s && Array.isArray(s.stops) ? s.stops : (s && Array.isArray(s.data) ? s.data : []));
          setStops(stopsArray);
        }

        if (linesRes.ok) {
          const l = await linesRes.json();
          const linesArray = Array.isArray(l) ? l : (l && Array.isArray(l.lines) ? l.lines : (l && Array.isArray(l.data) ? l.data : []));
          setLines(linesArray);
        }
      } catch (e) {
        console.error('Error fetching lines/stops:', e);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [API_URL]);

  return { stops, lines, loading };
}
