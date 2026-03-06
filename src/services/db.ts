import localforage from 'localforage';
import { supabase } from './supabase';

export interface LocationRecord {
    id: string;
    name: string;
    lat: number | null;
    lng: number | null;
    imageThumbnail: string;
    featureVector: number[];
    additionalImages?: { id: string; image: string; features: number[] }[];
    notes?: string;
    neighborhood?: string;
    city?: string;
    createdAt: number;
}

export interface RoutePoint {
    id: string;
    name: string;
    lat: number | null;
    lng: number | null;
    scannedAt: number;
    notes?: string;
    isDelivered?: boolean;
    neighborhood?: string;
    city?: string;
}

export interface AppSettings {
    personalData: {
        name: string;
        email: string;
        phone: string;
        vehicle: string;
        avatar?: string;
    };
    notifications: {
        push: boolean;
        haptic: boolean;
        sound: boolean;
    };
    mapPreferences: {
        darkMode: boolean;
        showTraffic: boolean;
        autoCenter: boolean;
    };
    subscriptionPlan: 'free' | 'pro' | 'enterprise';
}

const defaultSettings: AppSettings = {
    personalData: {
        name: '',
        email: '',
        phone: '',
        vehicle: '',
        avatar: ''
    },
    notifications: {
        push: true,
        haptic: true,
        sound: true
    },
    mapPreferences: {
        darkMode: true,
        showTraffic: false,
        autoCenter: true
    },
    subscriptionPlan: 'free'
};

// --- SYNC HELPERS (OFFLINE FIRST) ---

export const getRecords = async (): Promise<LocationRecord[]> => {
    const store = localforage.createInstance({ name: 'RouteImageApp', storeName: 'locationRecords' });
    const records: LocationRecord[] = [];

    // 1. Sempre carregar local primeiro para tempo de resposta zero e funcionamento offline
    await store.iterate((val: LocationRecord) => { records.push(val); });

    // 2. Tentar sincronizar do servidor no background e atualizar banco local
    if (navigator.onLine) {
        setTimeout(async () => {
            try {
                const { data, error } = await supabase.from('location_records').select('*').order('created_at', { ascending: false });
                if (!error && data) {
                    for (const r of data) {
                        const rec = {
                            id: r.id,
                            name: r.name,
                            lat: r.lat,
                            lng: r.lng,
                            imageThumbnail: r.image_thumbnail,
                            featureVector: r.feature_vector,
                            notes: r.notes,
                            neighborhood: r.neighborhood,
                            city: r.city,
                            createdAt: new Date(r.created_at).getTime()
                        };
                        await store.setItem(rec.id, rec);
                    }
                }
            } catch (e) { console.warn('Background sync falhou', e); }
        }, 100);
    }

    return records.sort((a, b) => b.createdAt - a.createdAt);
};

export const saveRecord = async (
    name: string,
    lat: number | null,
    lng: number | null,
    imageThumbnail: string,
    featureVector: number[],
    optionalFields?: { notes?: string, neighborhood?: string, city?: string }
): Promise<LocationRecord> => {
    const id = crypto.randomUUID();
    const localRecord: LocationRecord = {
        id,
        name,
        lat,
        lng,
        imageThumbnail,
        featureVector,
        notes: optionalFields?.notes,
        neighborhood: optionalFields?.neighborhood,
        city: optionalFields?.city,
        createdAt: Date.now()
    };

    // Salvar localmente instantaneamente (Garante backup local no aparelho)
    const store = localforage.createInstance({ name: 'RouteImageApp', storeName: 'locationRecords' });
    await store.setItem(id, localRecord);

    // Backup remoto quando houver internet
    setTimeout(async () => {
        if (navigator.onLine) {
            try {
                await supabase.from('location_records').insert({
                    id,
                    name,
                    lat,
                    lng,
                    image_thumbnail: imageThumbnail,
                    feature_vector: featureVector,
                    notes: optionalFields?.notes,
                    neighborhood: optionalFields?.neighborhood,
                    city: optionalFields?.city
                });
            } catch (e) {
                console.warn('Falha no backup remoto', e);
            }
        }
    }, 100);

    return localRecord;
};

export const deleteRecord = async (id: string): Promise<void> => {
    const store = localforage.createInstance({ name: 'RouteImageApp', storeName: 'locationRecords' });
    await store.removeItem(id);

    setTimeout(async () => {
        if (navigator.onLine) {
            try {
                await supabase.from('location_records').delete().eq('id', id);
            } catch (e) { }
        }
    }, 100);
};

export const updateRecord = async (id: string, updates: Partial<LocationRecord>): Promise<LocationRecord | null> => {
    const store = localforage.createInstance({ name: 'RouteImageApp', storeName: 'locationRecords' });
    const current = await store.getItem<LocationRecord>(id);
    if (!current) return null;

    const updated = { ...current, ...updates };
    await store.setItem(id, updated);

    setTimeout(async () => {
        if (navigator.onLine) {
            const sbUpdates: any = {};
            if (updates.name !== undefined) sbUpdates.name = updates.name;
            if (updates.lat !== undefined) sbUpdates.lat = updates.lat;
            if (updates.lng !== undefined) sbUpdates.lng = updates.lng;
            if (updates.notes !== undefined) sbUpdates.notes = updates.notes;
            if (updates.neighborhood !== undefined) sbUpdates.neighborhood = updates.neighborhood;
            if (updates.city !== undefined) sbUpdates.city = updates.city;

            try {
                await supabase.from('location_records').update(sbUpdates).eq('id', id);
            } catch (e) { }
        }
    }, 100);

    return updated;
};

// --- ROUTE SESSION ---

export const getActiveRoute = async (): Promise<RoutePoint[]> => {
    // Prioritize localforage as it is the primary write target in updateActiveRoute
    try {
        const localData = await localforage.createInstance({ name: 'RouteImageApp', storeName: 'activeRoute' }).getItem<RoutePoint[]>('route');
        if (localData && localData.length > 0) {
            return localData;
        }
    } catch (err) {
        console.warn('Failed to read route from localforage:', err);
    }

    // Fallback to Supabase if localforage is empty
    try {
        const { data, error } = await supabase.from('active_route').select('*').order('scanned_at', { ascending: true });
        if (!error && data && data.length > 0) {
            const mapped = data.map(r => ({
                id: r.id,
                name: r.name,
                lat: r.lat,
                lng: r.lng,
                scannedAt: new Date(r.scanned_at).getTime(),
                notes: r.notes,
                isDelivered: r.is_delivered,
                neighborhood: r.neighborhood,
                city: r.city
            }));
            // Also save to localforage for next time
            try {
                await localforage.createInstance({ name: 'RouteImageApp', storeName: 'activeRoute' }).setItem('route', mapped);
            } catch { /* ignore */ }
            return mapped;
        }
    } catch (err) {
        console.warn('Failed to read route from Supabase:', err);
    }

    return [];
};


export const addPointToActiveRoute = async (point: RoutePoint): Promise<RoutePoint[]> => {
    await supabase.from('active_route').insert({
        name: point.name,
        lat: point.lat,
        lng: point.lng,
        notes: point.notes,
        neighborhood: point.neighborhood,
        city: point.city,
        external_record_id: point.id === 'current' ? null : point.id
    });
    return await getActiveRoute();
};

export const updateActiveRoute = async (points: RoutePoint[]): Promise<void> => {
    // Sempre salvar localmente primeiro para garantir funcionamento offline
    try {
        await localforage.createInstance({ name: 'RouteImageApp', storeName: 'activeRoute' }).setItem('route', points);
    } catch (err) {
        console.error('Falha ao salvar rota localmente:', err);
    }

    // Tentar sincronizar com Supabase
    try {
        // Limpar rota anterior
        await supabase.from('active_route').delete().neq('id', '00000000-0000-0000-0000-000000000000');

        const insertData = points.filter(p => p.id !== 'current').map(p => ({
            name: p.name,
            lat: p.lat,
            lng: p.lng,
            notes: p.notes,
            neighborhood: p.neighborhood,
            city: p.city,
            is_delivered: p.isDelivered || false,
            scanned_at: new Date(p.scannedAt || Date.now()).toISOString(),
            external_record_id: p.id
        }));

        if (insertData.length > 0) {
            const { error: insertError } = await supabase.from('active_route').insert(insertData);
            if (insertError) throw insertError;
        }
    } catch (err) {
        console.warn('Supabase sync failed for active_route, using local storage only', err);
    }
};

export const clearActiveRoute = async (): Promise<void> => {
    await supabase.from('active_route').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await localforage.createInstance({ name: 'RouteImageApp', storeName: 'activeRoute' }).removeItem('route');
};

// --- DAILY ROUTE (Rota do Dia) ---

const dailyRouteStore = localforage.createInstance({ name: 'RouteImageApp', storeName: 'dailyRoute' });

export const getDailyRoute = async (): Promise<RoutePoint[]> => {
    return await dailyRouteStore.getItem<RoutePoint[]>('points') || [];
};

export const addToDailyRoute = async (point: RoutePoint): Promise<RoutePoint[]> => {
    const current = await getDailyRoute();
    // Avoid duplicates
    if (current.some(p => p.id === point.id)) return current;
    const updated = [...current, point];
    await dailyRouteStore.setItem('points', updated);
    return updated;
};

export const updateDailyRoute = async (points: RoutePoint[]): Promise<void> => {
    await dailyRouteStore.setItem('points', points);
};

export const removeFromDailyRoute = async (id: string): Promise<RoutePoint[]> => {
    const current = await getDailyRoute();
    const updated = current.filter(p => p.id !== id);
    await dailyRouteStore.setItem('points', updated);
    return updated;
};

export const clearDailyRoute = async (): Promise<void> => {
    await dailyRouteStore.removeItem('points');
};

// --- SETTINGS ---

export const getSettings = async (): Promise<AppSettings> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return defaultSettings;

    const [settingsRes, profileRes] = await Promise.all([
        supabase.from('app_settings').select('*').eq('id', session.user.id).single(),
        supabase.from('profiles').select('subscription_plan').eq('id', session.user.id).single()
    ]);

    const data = settingsRes.data;
    const profile = profileRes.data;

    if (!profile) {
        // Create initial profile if missing
        await supabase.from('profiles').insert({
            id: session.user.id,
            subscription_plan: 'free',
            daily_scan_count: 0
        });
    }

    if (!data) {
        console.log("📝 Gerando configurações iniciais para usuário...");
        // Create initial settings if missing
        const newSettings = {
            id: session.user.id,
            personal_data: {
                name: session.user.user_metadata?.full_name || 'Usuário',
                email: session.user.email || '',
                phone: '',
                vehicle: ''
            },
            notifications: defaultSettings.notifications,
            map_preferences: defaultSettings.mapPreferences
        };
        await supabase.from('app_settings').insert(newSettings);
        return { ...defaultSettings, subscriptionPlan: (profile?.subscription_plan as any) || 'free' };
    }

    return {
        personalData: data.personal_data,
        notifications: data.notifications,
        mapPreferences: data.map_preferences,
        subscriptionPlan: (profile?.subscription_plan as any) || 'free'
    };
};

export const updateSettings = async (updates: Partial<AppSettings>): Promise<AppSettings> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return defaultSettings;

    const current = await getSettings();
    const updated = { ...current, ...updates };

    await supabase.from('app_settings').update({
        personal_data: updated.personalData,
        notifications: updated.notifications,
        map_preferences: updated.mapPreferences
    }).eq('id', session.user.id);

    return updated;
};

export const checkAndUpdateUsage = async (): Promise<{ allowed: boolean; remaining: number }> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { allowed: false, remaining: 0 };

    const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

    if (error || !profile) return { allowed: false, remaining: 0 };

    if (profile.subscription_plan !== 'free') {
        return { allowed: true, remaining: 999 };
    }

    // Reset counter if it's a new day
    const lastReset = new Date(profile.last_scan_reset);
    const now = new Date();
    const isNewDay = now.toDateString() !== lastReset.toDateString();

    let currentCount = isNewDay ? 0 : profile.daily_scan_count;
    const limit = 5;

    if (currentCount >= limit) {
        return { allowed: false, remaining: 0 };
    }

    // Increment count
    const nextCount = currentCount + 1;
    await supabase
        .from('profiles')
        .update({
            daily_scan_count: nextCount,
            last_scan_reset: now.toISOString()
        })
        .eq('id', session.user.id);

    return { allowed: true, remaining: limit - nextCount };
};

export const importRecords = async (records: LocationRecord[]) => {
    const sbRecords = records.map(r => ({
        id: r.id,
        name: r.name,
        lat: r.lat,
        lng: r.lng,
        image_thumbnail: r.imageThumbnail,
        feature_vector: r.featureVector,
        notes: r.notes,
        neighborhood: r.neighborhood,
        city: r.city
    }));
    await supabase.from('location_records').upsert(sbRecords);
};
