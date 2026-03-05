import localforage from 'localforage';

export interface LocationRecord {
    id: string;
    name: string; // Explicit name/address assigned to the image
    lat: number | null;
    lng: number | null;
    imageThumbnail: string; // Base64 snapshot
    featureVector: number[]; // From tfjs extraction
    additionalImages?: { id: string; image: string; features: number[] }[]; // Multiple angles/views to improve recognition
    notes?: string;
    neighborhood?: string;
    city?: string;
    createdAt: number;
}

const db = localforage.createInstance({
    name: 'RouteImageApp',
    storeName: 'locationRecords',
});

// For active scanned session: keep a list of detected markers
const sessionDb = localforage.createInstance({
    name: 'RouteImageApp',
    storeName: 'activeRoute',
});

export const getRecords = async (): Promise<LocationRecord[]> => {
    const records: LocationRecord[] = [];
    await db.iterate((value: LocationRecord) => {
        records.push(value);
    });
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
    const record: LocationRecord = {
        id,
        name,
        lat,
        lng,
        imageThumbnail,
        featureVector,
        notes: optionalFields?.notes,
        neighborhood: optionalFields?.neighborhood,
        city: optionalFields?.city,
        createdAt: Date.now(),
    };
    await db.setItem(id, record);
    return record;
};

export const deleteRecord = async (id: string): Promise<void> => {
    await db.removeItem(id);
};

export const updateRecord = async (id: string, updates: Partial<LocationRecord>): Promise<LocationRecord | null> => {
    const record = await db.getItem<LocationRecord>(id);
    if (!record) return null;
    const updatedRecord = { ...record, ...updates };
    await db.setItem(id, updatedRecord);
    return updatedRecord;
};

export interface RoutePoint {
    id: string; // Links to the matching LocationRecord id
    name: string;
    lat: number;
    lng: number;
    scannedAt: number;
}

export const getActiveRoute = async (): Promise<RoutePoint[]> => {
    const route = await sessionDb.getItem<RoutePoint[]>('route') || [];
    return route;
};

export const addPointToActiveRoute = async (point: RoutePoint): Promise<RoutePoint[]> => {
    const route = await getActiveRoute();

    // Prevent duplicate consecutive scans
    if (route.length > 0 && route[route.length - 1].id === point.id) {
        return route;
    }

    const newRoute = [...route, point];
    await sessionDb.setItem('route', newRoute);
    return newRoute;
};

export const clearActiveRoute = async (): Promise<void> => {
    await sessionDb.removeItem('route');
};

export const updateActiveRoute = async (points: RoutePoint[]): Promise<void> => {
    await sessionDb.setItem('route', points);
};

export const importRecords = async (records: LocationRecord[]) => {
    for (const record of records) {
        await db.setItem(record.id, record);
    }
};
