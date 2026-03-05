import { getRecords, saveRecord } from './db';
import type { LocationRecord } from './db';
import { saveAs } from 'file-saver';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────

const timestamp = () => new Date().toISOString().slice(0, 10).replace(/-/g, '');
const filename = (ext: string) => `meus_enderecos_${timestamp()}.${ext}`;

/** Maps a LocationRecord to a flat object for tabular exports */
const toRow = (r: LocationRecord) => ({
    Nome: r.name || '',
    Bairro: r.neighborhood || '',
    Cidade: r.city || '',
    Latitude: r.lat ?? '',
    Longitude: r.lng ?? '',
    Notas: r.notes || '',
    Criado_em: r.createdAt ? new Date(r.createdAt).toLocaleString('pt-BR') : '',
});

// ────────────────────────────────────────
// EXPORT
// ────────────────────────────────────────

export const exportAsJSON = async () => {
    const records = await getRecords();
    if (!records.length) throw new Error('Nenhum endereço cadastrado para exportar.');
    const blob = new Blob([JSON.stringify(records, null, 2)], { type: 'application/json' });
    saveAs(blob, filename('json'));
};

export const exportAsCSV = async () => {
    const records = await getRecords();
    if (!records.length) throw new Error('Nenhum endereço cadastrado para exportar.');
    const rows = records.map(toRow);
    const csv = Papa.unparse(rows, { delimiter: ';', header: true });
    // Add BOM for Excel UTF-8 compatibility
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, filename('csv'));
};

export const exportAsXLS = async () => {
    const records = await getRecords();
    if (!records.length) throw new Error('Nenhum endereço cadastrado para exportar.');

    const rows = records.map(toRow);
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);

    // Column widths
    ws['!cols'] = [
        { wch: 35 }, // Nome
        { wch: 20 }, // Bairro
        { wch: 20 }, // Cidade
        { wch: 14 }, // Latitude
        { wch: 14 }, // Longitude
        { wch: 40 }, // Notas
        { wch: 22 }, // Criado_em
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Meus Endereços');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, filename('xlsx'));
};

export const exportAsPDF = async () => {
    const records = await getRecords();
    if (!records.length) throw new Error('Nenhum endereço cadastrado para exportar.');

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    // Header background
    doc.setFillColor(10, 10, 15);
    doc.rect(0, 0, 297, 297, 'F');

    // Title
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('MEUS ENDEREÇOS', 14, 18);

    // Subtitle
    doc.setFontSize(8);
    doc.setTextColor(100, 130, 255);
    doc.text(`SCANNER VISÃO  ·  Exportado em ${new Date().toLocaleString('pt-BR')}  ·  ${records.length} registros`, 14, 25);

    // Table body
    const rows = records.map((r, i) => [
        i + 1,
        r.name,
        r.neighborhood || '—',
        r.city || '—',
        r.lat?.toFixed(6) ?? '—',
        r.lng?.toFixed(6) ?? '—',
        r.notes || '—',
    ]);

    autoTable(doc, {
        startY: 30,
        head: [['#', 'Nome / Endereço', 'Bairro', 'Cidade', 'Latitude', 'Longitude', 'Notas']],
        body: rows,
        theme: 'grid',
        styles: {
            font: 'helvetica',
            fontSize: 8,
            textColor: [220, 220, 230],
            fillColor: [14, 14, 20],
            lineColor: [40, 40, 60],
            lineWidth: 0.3,
        },
        headStyles: {
            fillColor: [30, 60, 180],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 8,
        },
        alternateRowStyles: {
            fillColor: [20, 20, 30],
        },
        columnStyles: {
            0: { halign: 'center', cellWidth: 10 },
            1: { cellWidth: 65 },
            2: { cellWidth: 35 },
            3: { cellWidth: 35 },
            4: { cellWidth: 28 },
            5: { cellWidth: 28 },
            6: { cellWidth: 62 },
        },
    });

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(60, 60, 90);
        doc.text(`Página ${i} de ${pageCount} · Scanner Visão`, 14, doc.internal.pageSize.height - 6);
    }

    doc.save(filename('pdf'));
};

// ────────────────────────────────────────
// IMPORT
// ────────────────────────────────────────

/** Import from JSON backup (full records with feature vectors) */
export const importFromJSON = async (file: File): Promise<number> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = JSON.parse(e.target?.result as string) as LocationRecord[];
                if (!Array.isArray(data)) throw new Error('Formato inválido.');
                for (const rec of data) {
                    await saveRecord(
                        rec.name,
                        rec.lat ?? null,
                        rec.lng ?? null,
                        rec.imageThumbnail ?? '',
                        rec.featureVector ?? [],
                        { notes: rec.notes, neighborhood: rec.neighborhood, city: rec.city }
                    );
                }
                resolve(data.length);
            } catch (err) { reject(err); }
        };
        reader.onerror = reject;
        reader.readAsText(file);
    });
};

/** Import from CSV - reads columns: Nome, Bairro, Cidade, Latitude, Longitude, Notas */
export const importFromCSV = async (file: File): Promise<number> => {
    return new Promise((resolve, reject) => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            delimiter: '',       // auto-detect , or ;
            complete: async (results) => {
                try {
                    const rows = results.data as Record<string, string>[];
                    let count = 0;
                    for (const row of rows) {
                        const name = row['Nome'] || row['name'] || row['Endereço'] || row['endereco'] || '';
                        if (!name.trim()) continue;
                        await saveRecord(
                            name.trim(),
                            parseFloat(row['Latitude'] || row['lat'] || '') || null,
                            parseFloat(row['Longitude'] || row['lng'] || '') || null,
                            '',
                            [],
                            {
                                neighborhood: row['Bairro'] || row['bairro'] || '',
                                city: row['Cidade'] || row['cidade'] || '',
                                notes: row['Notas'] || row['notes'] || '',
                            }
                        );
                        count++;
                    }
                    resolve(count);
                } catch (err) { reject(err); }
            },
            error: reject,
        });
    });
};

/** Import from XLSX/XLS */
export const importFromXLS = async (file: File): Promise<number> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const wb = XLSX.read(data, { type: 'array' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws);
                let count = 0;
                for (const row of rows) {
                    const name = row['Nome'] || row['name'] || row['Endereço'] || '';
                    if (!name.toString().trim()) continue;
                    await saveRecord(
                        name.toString().trim(),
                        parseFloat(row['Latitude']?.toString() || '') || null,
                        parseFloat(row['Longitude']?.toString() || '') || null,
                        '',
                        [],
                        {
                            neighborhood: (row['Bairro'] || '').toString(),
                            city: (row['Cidade'] || '').toString(),
                            notes: (row['Notas'] || '').toString(),
                        }
                    );
                    count++;
                }
                resolve(count);
            } catch (err) { reject(err); }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
};

// ────────────────────────────────────────
// LEGACY COMPATIBILITY (used by RecordsView)
// ────────────────────────────────────────
export const exportRecords = exportAsJSON;

export const importRecords = async (file: File): Promise<void> => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'json') await importFromJSON(file);
    else if (ext === 'csv') await importFromCSV(file);
    else if (ext === 'xlsx' || ext === 'xls') await importFromXLS(file);
    else throw new Error(`Formato não suportado: .${ext}`);
};
