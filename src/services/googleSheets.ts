import { BillboardSite } from '../types';

export const DEFAULT_SPREADSHEET_ID = '1ZRHVQ0IBSJ8C3L86IFXDH8DYGVFYFYAHCNM9B_TPYEK';
export const STORAGE_KEY_SPREADSHEET_ID = 'bto_custom_spreadsheet_id';

export interface SheetFetchResult {
  sites: Record<string, BillboardSite>;
  rowCount: number;
  sheetTitle: string;
  tabName: string;
  syncedAt: string;
  columnsDetected: {
    siteNoCol: string;
    locationCol: string;
    sizeCol: string;
    formatCol: string;
    visualCol: string;
  };
  sampleSites: BillboardSite[];
}

export interface SheetDiagnosticResult {
  accessible: boolean;
  status: number;
  message: string;
  spreadsheetId: string;
  spreadsheetTitle?: string;
  tabs?: string[];
  mode: 'oauth' | 'public' | 'failed';
  sampleRowCount?: number;
}

/**
 * Extract clean spreadsheet ID from full URL or return ID directly
 */
export function extractSpreadsheetId(input: string): string {
  if (!input) return DEFAULT_SPREADSHEET_ID;
  const trimmed = input.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return trimmed;
}

/**
 * Test accessibility and inspect metadata of a Google Spreadsheet
 */
export async function testSpreadsheetHealth(
  accessToken: string | null,
  rawIdOrUrl: string = DEFAULT_SPREADSHEET_ID
): Promise<SheetDiagnosticResult> {
  const spreadsheetId = extractSpreadsheetId(rawIdOrUrl);

  // If user has OAuth access token, test via Google Sheets v4 API
  if (accessToken) {
    try {
      const res = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=properties.title,sheets.properties.title,sheets.properties.gridProperties`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json'
          }
        }
      );

      if (res.ok) {
        const data = await res.json();
        const title = data.properties?.title || 'Google Sheet';
        const tabNames = (data.sheets || []).map((s: any) => s.properties?.title || 'Sheet1');
        return {
          accessible: true,
          status: 200,
          message: `Berjaya disambung ke fail "${title}". ${tabNames.length} tab dijumpai: [${tabNames.join(', ')}]`,
          spreadsheetId,
          spreadsheetTitle: title,
          tabs: tabNames,
          mode: 'oauth'
        };
      }

      if (res.status === 404) {
        return {
          accessible: false,
          status: 404,
          message: `Fail Google Sheets (ID: ${spreadsheetId}) tidak wujud di Google Drive (HTTP 404 Not Found). Sila imbas Google Drive anda untuk mencari fail sebenar 'Inventory_2026.gsheet'.`,
          spreadsheetId,
          mode: 'failed'
        };
      }

      if (res.status === 403) {
        return {
          accessible: false,
          status: 403,
          message: `Akses ditolak (HTTP 403 Forbidden). Akaun Google anda tidak mempunyai kebenaran untuk membuka fail ini. Sila pastikan fail dikongsi (Shared with Viewer/Editor).`,
          spreadsheetId,
          mode: 'failed'
        };
      }

      const err = await res.json().catch(() => ({}));
      return {
        accessible: false,
        status: res.status,
        message: err.error?.message || `Ralat API (${res.statusText})`,
        spreadsheetId,
        mode: 'failed'
      };
    } catch (e: any) {
      // Continue to public check
    }
  }

  // Attempt public CSV check
  try {
    const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv`;
    const res = await fetch(csvUrl, { method: 'HEAD' });

    if (res.ok) {
      return {
        accessible: true,
        status: 200,
        message: 'Google Sheet awam boleh diakses tanpa log masuk Google.',
        spreadsheetId,
        mode: 'public'
      };
    }

    if (res.status === 404) {
      return {
        accessible: false,
        status: 404,
        message: `Fail Google Sheets tidak dijumpai (HTTP 404). ID "${spreadsheetId}" tidak wujud di pelayan Google.`,
        spreadsheetId,
        mode: 'failed'
      };
    }
  } catch (err) {
    // Network or CORS error
  }

  return {
    accessible: false,
    status: 404,
    message: accessToken
      ? `Fail Google Sheets (ID: ${spreadsheetId}) tidak dapat dijumpai di Google Drive. Sila gunakan fungsi imbasan Drive untuk memilih fail 'Inventory_2026'.`
      : `Sila log masuk dengan akaun Google anda untuk menyegerakkan fail 'Inventory_2026.gsheet' dari Google Drive anda.`,
    spreadsheetId,
    mode: 'failed'
  };
}

/**
 * Fetch and parse billboard inventory directly from Google Sheets API or Public CSV
 */
export async function fetchInventoryFromGoogleSheets(
  accessToken: string | null,
  rawIdOrUrl: string = DEFAULT_SPREADSHEET_ID
): Promise<SheetFetchResult> {
  const spreadsheetId = extractSpreadsheetId(rawIdOrUrl);

  // Mode 1: Authenticated Google Sheets v4 API
  if (accessToken) {
    // 1. First get metadata about the spreadsheet (sheet tabs and title)
    let sheetTitle = 'Inventory_2026';
    let targetTab = '';

    try {
      const metaRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=properties.title,sheets.properties.title`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json'
          }
        }
      );

      if (metaRes.ok) {
        const meta = await metaRes.json();
        sheetTitle = meta.properties?.title || 'Inventory_2026';
        const sheetsList: string[] = (meta.sheets || []).map((s: any) => s.properties?.title || '');
        
        // Find best tab: matching inventory / inventori / master / 2026 / sites
        const matchingTab = sheetsList.find((name) => {
          const l = name.toLowerCase();
          return l.includes('inventor') || l.includes('master') || l.includes('2026') || l.includes('site') || l.includes('billboard');
        });

        targetTab = matchingTab || sheetsList[0] || '';
      }
    } catch (e) {
      console.warn('Could not read sheets metadata, using default range:', e);
    }

    // 2. Fetch sheet values
    const rangeParam = targetTab ? `'${targetTab}'!A1:Z1000` : 'A1:Z1000';
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(rangeParam)}`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json'
      }
    });

    if (res.ok) {
      const data = await res.json();
      const rows: string[][] = data.values || [];
      if (rows.length > 0) {
        return parseRowsToSites(rows, sheetTitle, targetTab || 'Default');
      } else {
        throw new Error(`Fail Google Sheet '${sheetTitle}' tidak mengandungi sebarang baris data.`);
      }
    } else {
      const errorData = await res.json().catch(() => ({}));
      const errMsg = errorData.error?.message || `Google Sheets API (HTTP ${res.status}): ${res.statusText}`;
      if (res.status === 404) {
        throw new Error(`Fail Google Sheets (ID: ${spreadsheetId}) tidak dijumpai di Google Drive. Sila pastikan fail wujud atau pilih fail dari Google Drive anda.`);
      }
      throw new Error(errMsg);
    }
  }

  // Mode 2: Public CSV format fallback
  try {
    const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv`;
    const res = await fetch(csvUrl);

    if (res.ok) {
      const text = await res.text();
      const rows = text
        .split('\n')
        .map((line) => line.split(',').map((cell) => cell.replace(/^"|"$/g, '').trim()))
        .filter((row) => row.length > 0 && row.some((c) => c !== ''));

      if (rows.length > 0) {
        return parseRowsToSites(rows, 'Inventori_Public', 'CSV');
      }
    }
  } catch (e) {
    // CSV fallback failed
  }

  throw new Error(`Tidak dapat membuka fail Google Sheet (ID: ${spreadsheetId}). Sila log masuk dengan Google untuk membaca fail 'Inventory_2026.gsheet' peribadi anda.`);
}

/**
 * Intelligent parser that identifies header row in first 5 rows and maps columns flexibly
 */
function parseRowsToSites(rows: string[][], sheetTitle: string, tabName: string): SheetFetchResult {
  if (!rows || rows.length === 0) {
    throw new Error('Google Sheet kosong tanpa baris.');
  }

  // Search first 5 rows to identify the real header row
  let headerRowIdx = 0;
  let maxScore = -1;
  let bestColumns = {
    siteNoIdx: 0,
    locationIdx: 1,
    sizeIdx: 2,
    formatIdx: 3,
    visualIdx: 4
  };

  const maxRowsToScan = Math.min(rows.length, 5);

  for (let r = 0; r < maxRowsToScan; r++) {
    const row = rows[r];
    if (!row || row.length < 2) continue;

    const lowerHeaders = row.map((c) => String(c || '').trim().toLowerCase());

    const siteNoIdx = lowerHeaders.findIndex(
      (h) =>
        h.includes('siteno') ||
        h.includes('site no') ||
        h.includes('site id') ||
        h.includes('site_no') ||
        h.includes('kod tapak') ||
        h.includes('no tapak') ||
        h.includes('billboard id') ||
        h === 'site' ||
        h === 'id' ||
        h === 'kod' ||
        h === 'code' ||
        h === 'no.' ||
        h === 'no'
    );

    const locationIdx = lowerHeaders.findIndex(
      (h) =>
        h.includes('location') ||
        h.includes('lokasi') ||
        h.includes('address') ||
        h.includes('alamat') ||
        h.includes('highway') ||
        h.includes('lebuhraya') ||
        h.includes('site location')
    );

    const sizeIdx = lowerHeaders.findIndex(
      (h) =>
        h.includes('size') ||
        h.includes('saiz') ||
        h.includes('dimension') ||
        h.includes('dimensi') ||
        h.includes('ukuran') ||
        h.includes('measurement')
    );

    const formatIdx = lowerHeaders.findIndex(
      (h) =>
        h.includes('format') ||
        h.includes('structure') ||
        h.includes('struktur') ||
        h.includes('type') ||
        h.includes('jenis') ||
        h.includes('media')
    );

    const visualIdx = lowerHeaders.findIndex(
      (h) =>
        h.includes('visual') ||
        h.includes('campaign') ||
        h.includes('kempen') ||
        h.includes('advertiser') ||
        h.includes('client') ||
        h.includes('iklan') ||
        h.includes('brand')
    );

    let score = 0;
    if (siteNoIdx !== -1) score += 3;
    if (locationIdx !== -1) score += 2;
    if (sizeIdx !== -1) score += 2;
    if (formatIdx !== -1) score += 1;
    if (visualIdx !== -1) score += 1;

    if (score > maxScore) {
      maxScore = score;
      headerRowIdx = r;
      bestColumns = {
        siteNoIdx: siteNoIdx !== -1 ? siteNoIdx : 0,
        locationIdx: locationIdx !== -1 ? locationIdx : 1,
        sizeIdx: sizeIdx !== -1 ? sizeIdx : 2,
        formatIdx: formatIdx !== -1 ? formatIdx : 3,
        visualIdx: visualIdx !== -1 ? visualIdx : 4
      };
    }
  }

  const { siteNoIdx, locationIdx, sizeIdx, formatIdx, visualIdx } = bestColumns;
  const headerRow = rows[headerRowIdx] || [];

  const columnsDetected = {
    siteNoCol: String(headerRow[siteNoIdx] || `Col ${siteNoIdx + 1}`),
    locationCol: String(headerRow[locationIdx] || `Col ${locationIdx + 1}`),
    sizeCol: String(headerRow[sizeIdx] || `Col ${sizeIdx + 1}`),
    formatCol: String(headerRow[formatIdx] || `Col ${formatIdx + 1}`),
    visualCol: String(headerRow[visualIdx] || `Col ${visualIdx + 1}`)
  };

  const parsedSites: Record<string, BillboardSite> = {};
  const sampleList: BillboardSite[] = [];

  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const rawVal = row[siteNoIdx];
    if (!rawVal) continue;

    const rawSiteNo = String(rawVal).trim().toUpperCase();
    if (!rawSiteNo || rawSiteNo.length < 2) continue;
    // Skip if it looks like a repeating header
    if (rawSiteNo === 'SITENO' || rawSiteNo === 'SITE NO' || rawSiteNo === 'SITE') continue;

    const location = (row[locationIdx] && String(row[locationIdx]).trim()) || 'Lebuhraya Persekutuan';
    const size = (row[sizeIdx] && String(row[sizeIdx]).trim()) || "60' (H) x 40' (W)";
    const format = (row[formatIdx] && String(row[formatIdx]).trim()) || 'Unipole Spectacular';
    const visual = (row[visualIdx] && String(row[visualIdx]).trim()) || 'Kempen Semasa 2026';

    const siteObj: BillboardSite = {
      siteNo: rawSiteNo,
      location,
      size,
      format,
      defaultVisual: visual,
      seqCount: 1
    };

    parsedSites[rawSiteNo] = siteObj;

    if (sampleList.length < 5) {
      sampleList.push(siteObj);
    }
  }

  const rowCount = Object.keys(parsedSites).length;

  return {
    sites: parsedSites,
    rowCount,
    sheetTitle,
    tabName,
    syncedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    columnsDetected,
    sampleSites: sampleList
  };
}
