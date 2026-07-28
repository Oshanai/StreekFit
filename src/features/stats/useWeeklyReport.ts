/**
 * Shows the weekly report exactly once per week: on the first open after
 * Monday 00:00 local (TZ §17.1). The shown-marker is the current week's
 * Monday key; it is written only after a successful fetch, so an offline
 * Monday morning just retries on the next open.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import { fetchWeeklyReport, type WeeklyReport } from './api';
import { localDateKey, mondayOf } from './period';

const STORAGE_KEY = 'streekfit.weeklyReport.shownFor';

export function useWeeklyReport(): {
  report: WeeklyReport | null;
  visible: boolean;
  close: () => void;
} {
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const thisMonday = mondayOf(localDateKey(new Date()));
      const shownFor = await AsyncStorage.getItem(STORAGE_KEY);
      if (shownFor === thisMonday) return;
      const fresh = await fetchWeeklyReport();
      await AsyncStorage.setItem(STORAGE_KEY, thisMonday);
      if (alive && fresh != null) {
        setReport(fresh);
        setVisible(true);
      }
    })().catch(() => {
      // Offline — leave the marker unset and try again next open.
    });
    return () => {
      alive = false;
    };
  }, []);

  return { report, visible, close: () => setVisible(false) };
}
