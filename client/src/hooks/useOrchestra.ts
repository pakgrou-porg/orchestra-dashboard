import { useEffect, useState, useCallback } from 'react';
import { supabase, Dataset, HardwareProfile, ConductorProfile } from '@/lib/supabase';

export type OrchestraData = {
  datasets: Dataset[];
  hardware: HardwareProfile[];
  conductors: ConductorProfile[];
  loading: boolean;
  error: string | null;
  lastRefresh: Date | null;
  refresh: () => void;
};

export function useOrchestra(): OrchestraData {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [hardware, setHardware] = useState<HardwareProfile[]>([]);
  const [conductors, setConductors] = useState<ConductorProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dsRes, hwRes, condRes] = await Promise.all([
        supabase.from('datasets').select('*').order('created_at', { ascending: false }),
        supabase.from('hardware_profiles').select('*').order('name'),
        supabase.from('conductor_profiles').select('*').order('name'),
      ]);

      if (dsRes.error) throw new Error(`Datasets: ${dsRes.error.message}`);
      if (hwRes.error) throw new Error(`Hardware: ${hwRes.error.message}`);
      if (condRes.error) throw new Error(`Conductors: ${condRes.error.message}`);

      setDatasets(dsRes.data || []);
      setHardware(hwRes.data || []);
      setConductors(condRes.data || []);
      setLastRefresh(new Date());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchAll, 60000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  return { datasets, hardware, conductors, loading, error, lastRefresh, refresh: fetchAll };
}
