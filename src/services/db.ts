import { supabase } from './supabase';
import type { LocationPoint } from '../App';

export const getActiveRoute = async (): Promise<LocationPoint[]> => {
    const { data, error } = await supabase
        .from('active_route')
        .select('*')
        .order('scanned_at', { ascending: true });

    if (error) {
        console.error('Error fetching route:', error);
        return [];
    }

    return (data || []).map(item => ({
        id: item.id,
        name: item.name,
        address: '', // We might need to store address in active_route or join with location_records
        lat: item.lat,
        lng: item.lng,
        neighborhood: item.neighborhood || '',
        city: item.city || '',
        notes: item.notes || '',
        status: item.is_delivered ? 'delivered' : 'pending',
        createdAt: new Date(item.scanned_at).getTime()
    }));
};

export const saveToActiveRoute = async (point: Omit<LocationPoint, 'id' | 'status' | 'createdAt'>) => {
    const { data, error } = await supabase
        .from('active_route')
        .insert([{
            name: point.name,
            lat: point.lat,
            lng: point.lng,
            notes: point.notes,
            neighborhood: point.neighborhood,
            city: point.city,
            is_delivered: false
        }])
        .select()
        .single();

    if (error) throw error;
    return data;
};

export const updatePointStatus = async (id: string, isDelivered: boolean) => {
    const { error } = await supabase
        .from('active_route')
        .update({ is_delivered: isDelivered })
        .eq('id', id);

    if (error) throw error;
};

export const clearActiveRoute = async () => {
    const { error } = await supabase
        .from('active_route')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (error) throw error;
};

export const deletePoint = async (id: string) => {
    const { error } = await supabase
        .from('active_route')
        .delete()
        .eq('id', id);

    if (error) throw error;
};
