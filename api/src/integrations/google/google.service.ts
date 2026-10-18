import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ValidatedEnv } from '../../shared/config/env.types';

const SHEET_HEADER = [
  'Витрата', 'Дата', 'Ціна ГРН', 'Доставка', 'Комісія', 'Чи є чек ?', 'Загальна сумма',
  'Кому', 'Категорія', 'Опис', 'Примітка', 'Чеки', 'Фото звіт', 'ID',
];
const LAST_COLUMN = 'N';
const ID_COLUMN = 'N';
const FOLDER = 'application/vnd.google-apps.folder';

type Cell = string | number;

@Injectable()
export class GoogleService {
  private token: { value: string; expiresAt: number } | null = null;
  private sheetTitle: string | null = null;
  private readonly yearFolders = new Map<string, string>();

  constructor(private readonly config: ConfigService<ValidatedEnv, true>) {}

  get enabled(): boolean {
    return this.settings !== null;
  }

  private get settings() {
    return this.config.get('GOOGLE', { infer: true });
  }

  async syncRow(id: number, values: Cell[]): Promise<void> {
    const range = await this.range(await this.findRow(id));
    if (range) {
      await this.sheets('PUT', `/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`, { values: [values] });
    } else {
      const title = await this.title();
      await this.sheets(
        'POST',
        `/values/${encodeURIComponent(`'${title}'!A:${LAST_COLUMN}`)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
        { values: [values] },
      );
    }
  }

  async deleteRow(id: number): Promise<void> {
    const row = await this.findRow(id);
    if (!row) return;
    await this.sheets('POST', ':batchUpdate', {
      requests: [
        {
          deleteDimension: {
            range: { sheetId: this.settings!.sheetGid, dimension: 'ROWS', startIndex: row - 1, endIndex: row },
          },
        },
      ],
    });
  }

  async ensureHeader(): Promise<void> {
    const title = await this.title();
    const range = `'${title}'!A1:${LAST_COLUMN}1`;
    const current = (await this.sheets('GET', `/values/${encodeURIComponent(range)}`)) as { values?: string[][] };
    const row = current.values?.[0] ?? [];
    if (SHEET_HEADER.every((name, i) => (row[i] ?? '').trim() === name || (i < 7 && row[i]))) return;
    const header = SHEET_HEADER.map((name, i) => (i < 7 && row[i] ? row[i] : name));
    await this.sheets('PUT', `/values/${encodeURIComponent(range)}?valueInputOption=RAW`, { values: [header] });
  }

  async upload(kind: 'receipt' | 'photo', year: string, name: string, mime: string, data: Buffer): Promise<string> {
    const root = kind === 'receipt' ? this.settings!.receiptsFolderId : this.settings!.photosFolderId;
    const folder = await this.yearFolder(root, year);
    const boundary = `ubc${Date.now()}`;
    const meta = JSON.stringify({ name, parents: [folder] });
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Type: ${mime}\r\n\r\n`),
      data,
      Buffer.from(`\r\n--${boundary}--`),
    ]);
    const file = (await this.call(
      'POST',
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink',
      body,
      `multipart/related; boundary=${boundary}`,
    )) as { webViewLink: string };
    return file.webViewLink;
  }

  async trash(url: string): Promise<void> {
    const id = /\/d\/([\w-]+)/.exec(url)?.[1] ?? new URL(url).searchParams.get('id');
    if (!id) throw new Error(`not a Drive file link: ${url}`);
    await this.call(
      'PATCH',
      `https://www.googleapis.com/drive/v3/files/${id}?supportsAllDrives=true`,
      JSON.stringify({ trashed: true }),
      'application/json',
    );
  }

  private async yearFolder(root: string, year: string): Promise<string> {
    const key = `${root}/${year}`;
    const cached = this.yearFolders.get(key);
    if (cached) return cached;
    const q = encodeURIComponent(`'${root}' in parents and mimeType='${FOLDER}' and trashed=false`);
    const list = (await this.call(
      'GET',
      `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&supportsAllDrives=true&includeItemsFromAllDrives=true`,
    )) as { files: Array<{ id: string; name: string }> };
    let id = list.files.find((f) => f.name.includes(year))?.id;
    if (!id) {
      const created = (await this.call(
        'POST',
        'https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id',
        JSON.stringify({ name: `січень-грудень (${year})`, mimeType: FOLDER, parents: [root] }),
        'application/json',
      )) as { id: string };
      id = created.id;
    }
    this.yearFolders.set(key, id);
    return id;
  }

  private async findRow(id: number): Promise<number | null> {
    const title = await this.title();
    const range = `'${title}'!${ID_COLUMN}:${ID_COLUMN}`;
    const data = (await this.sheets('GET', `/values/${encodeURIComponent(range)}`)) as { values?: string[][] };
    const index = (data.values ?? []).findIndex((row, i) => i > 0 && row[0] === String(id));
    return index > 0 ? index + 1 : null;
  }

  private async range(row: number | null): Promise<string | null> {
    return row ? `'${await this.title()}'!A${row}:${LAST_COLUMN}${row}` : null;
  }

  private async title(): Promise<string> {
    if (this.sheetTitle) return this.sheetTitle;
    const data = (await this.sheets('GET', '?fields=sheets.properties(sheetId,title)')) as {
      sheets: Array<{ properties: { sheetId: number; title: string } }>;
    };
    const sheet = data.sheets.find((s) => s.properties.sheetId === this.settings!.sheetGid);
    if (!sheet) throw new Error(`Google Sheet tab gid=${this.settings!.sheetGid} not found`);
    this.sheetTitle = sheet.properties.title;
    return this.sheetTitle;
  }

  private sheets(method: string, path: string, body?: unknown): Promise<unknown> {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${this.settings!.sheetId}${path}`;
    return this.call(method, url, body === undefined ? undefined : JSON.stringify(body), 'application/json');
  }

  private async call(method: string, url: string, body?: string | Buffer, type?: string): Promise<unknown> {
    if (!this.settings) throw new Error('Google is not configured');
    const response = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${await this.accessToken()}`, ...(type ? { 'Content-Type': type } : {}) },
      body: typeof body === 'string' || body === undefined ? body : new Uint8Array(body),
      signal: AbortSignal.timeout(30_000),
    });
    const data = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
    if (!response.ok) throw new Error(`Google ${response.status}: ${data.error?.message ?? 'request failed'}`);
    return data;
  }

  private async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now() + 60_000) return this.token.value;
    const s = this.settings!;
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: s.clientId,
        client_secret: s.clientSecret,
        refresh_token: s.refreshToken,
        grant_type: 'refresh_token',
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const data = (await response.json()) as { access_token?: string; expires_in?: number; error_description?: string };
    if (!data.access_token) throw new Error(`Google auth failed: ${data.error_description ?? response.status}`);
    this.token = { value: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 };
    return this.token.value;
  }
}
