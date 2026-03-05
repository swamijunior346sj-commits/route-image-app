import { getRecords, importRecords as processImportDB } from './db';
import type { LocationRecord } from './db';
import { saveAs } from 'file-saver';


export const exportRecords = async () => {
    const records = await getRecords();
    if (!records.length) return;

    const jsonStr = JSON.stringify(records, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    saveAs(blob, `roteamento_app_backup_${Date.now()}.json`);
};

export const importRecords = async (file: File) => {
    return new Promise<void>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const text = event.target?.result as string;

                let records: LocationRecord[] = [];

                if (file.name.endsWith('.json')) {
                    records = JSON.parse(text) as LocationRecord[];
                } else if (file.name.endsWith('.csv')) {
                    // Future CSV Support
                    alert('CSV import is not fully implemented for binary feature vectors. Using JSON instead.');
                    reject('Unsupported format');
                    return;
                }

                // Add validations if necessary
                if (!Array.isArray(records)) {
                    throw new Error('Formato inválido.');
                }

                await processImportDB(records);
                resolve();
            } catch (err) {
                console.error(err);
                reject(err);
            }
        };
        reader.onerror = (err) => reject(err);
        reader.readAsText(file);
    });
};
