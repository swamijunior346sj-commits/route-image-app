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
}

const defaultSettings: AppSettings = {
    personalData: {
        name: '',
        email: '',
        phone: '',
        vehicle: ''
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
    }
};

// --- SYNC HELPERS ---

export const getRecords = async (): Promise<LocationRecord[]> => {
    try {
        const { data, error } = await supabase
            .from('location_records')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        return (data || []).map(r => ({
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
        }));
    } catch (err) {
        console.error('Supabase fetch failed, falling back to local storage', err);
        const records: LocationRecord[] = [];
        await localforage.createInstance({ name: 'RouteImageApp', storeName: 'locationRecords' })
            .iterate((val: LocationRecord) => { records.push(val); });
        return records.sort((a, b) => b.createdAt - a.createdAt);
    }
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
    const recordData = {
        id,
        name,
        lat,
        lng,
        image_thumbnail: imageThumbnail,
        feature_vector: featureVector,
        notes: optionalFields?.notes,
        neighborhood: optionalFields?.neighborhood,
        city: optionalFields?.city
    };

    const { data, error } = await supabase.from('location_records').insert(recordData).select().single();
    if (error) {
        console.warn('Supabase save failed, saving locally', error);
        const localRecord = { ...recordData, imageThumbnail, featureVector, createdAt: Date.now() };
        await localforage.createInstance({ name: 'RouteImageApp', storeName: 'locationRecords' }).setItem(id, localRecord);
        return localRecord as any;
    }

    return {
        ...recordData,
        imageThumbnail,
        featureVector,
        createdAt: new Date(data.created_at).getTime()
    } as LocationRecord;
};

export const deleteRecord = async (id: string): Promise<void> => {
    await supabase.from('location_records').delete().eq('id', id);
    await localforage.createInstance({ name: 'RouteImageApp', storeName: 'locationRecords' }).removeItem(id);
};

export const updateRecord = async (id: string, updates: Partial<LocationRecord>): Promise<LocationRecord | null> => {
    const sbUpdates: any = {};
    if (updates.name) sbUpdates.name = updates.name;
    if (updates.lat !== undefined) sbUpdates.lat = updates.lat;
    if (updates.lng !== undefined) sbUpdates.lng = updates.lng;
    if (updates.notes !== undefined) sbUpdates.notes = updates.notes;
    if (updates.neighborhood !== undefined) sbUpdates.neighborhood = updates.neighborhood;
    if (updates.city !== undefined) sbUpdates.city = updates.city;

    const { data, error } = await supabase.from('location_records').update(sbUpdates).eq('id', id).select().single();
    if (error) return null;
    return data as any;
};

// --- ROUTE SESSION ---

export const getActiveRoute = async (): Promise<RoutePoint[]> => {
    const { data, error } = await supabase.from('active_route').select('*').order('scanned_at', { ascending: true });
    if (error || !data) {
        return await localforage.createInstance({ name: 'RouteImageApp', storeName: 'activeRoute' }).getItem<RoutePoint[]>('route') || [];
    }
    return data.map(r => ({
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
    // Para simplificar, limpamos a rota anterior e inserimos a nova configuração completa
    // Isso garante que a ordem e novos pontos sejam preservados.
    try {
        await supabase.from('active_route').delete().neq('id', '00000000-0000-0000-0000-000000000000');

        const insertData = points.filter(p => p.id !== 'current').map(p => ({
            name: p.name,
            lat: p.lat,
            lng: p.lng,
            notes: p.notes,
            neighborhood: p.neighborhood,
            city: p.city,
            is_delivered: p.isDelivered || false,
            scanned_at: new Date(p.scannedAt || Date.now()).toISOString()
        }));

        if (insertData.length > 0) {
            await supabase.from('active_route').insert(insertData);
        }

        // Também salvamos localmente para redundância
        await localforage.createInstance({ name: 'RouteImageApp', storeName: 'activeRoute' }).setItem('route', points);
    } catch (err) {
        console.error('Falha ao atualizar rota ativa:', err);
    }
};

export const clearActiveRoute = async (): Promise<void> => {
    await supabase.from('active_route').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await localforage.createInstance({ name: 'RouteImageApp', storeName: 'activeRoute' }).removeItem('route');
};

// --- SETTINGS ---

export const getSettings = async (): Promise<AppSettings> => {
    const { data, error } = await supabase.from('app_settings').select('*').single();
    if (error || !data) return defaultSettings;
    return {
        personalData: data.personal_data,
        notifications: data.notifications,
        mapPreferences: data.map_preferences
    };
};

export const updateSettings = async (updates: Partial<AppSettings>): Promise<AppSettings> => {
    const current = await getSettings();
    const updated = { ...current, ...updates };
    await supabase.from('app_settings').update({
        personal_data: updated.personalData,
        notifications: updated.notifications,
        map_preferences: updated.mapPreferences
    }).eq('id', '00000000-0000-0000-0000-000000000000');
    return updated;
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
