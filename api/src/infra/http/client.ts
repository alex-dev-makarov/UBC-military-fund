import type { Request } from 'express';

export function clientIp(req: Request, behindCloudflare: boolean): string | undefined {
  if (behindCloudflare) {
    const header = req.headers['cf-connecting-ip'];
    const value = Array.isArray(header) ? header[0] : header;
    if (value) return value;
  }
  return req.socket.remoteAddress ?? undefined;
}

export function describeClient(userAgent: string | undefined): string {
  const ua = userAgent ?? '';
  const browser = /Telegram/i.test(ua)
    ? 'Telegram'
    : /Edg\//.test(ua)
      ? 'Edge'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Chrome\//.test(ua)
          ? 'Chrome'
          : /Safari\//.test(ua)
            ? 'Safari'
            : 'браузер';
  const os = /iPhone|iPad/.test(ua)
    ? 'iPhone'
    : /Android/.test(ua)
      ? 'Android'
      : /Mac OS X/.test(ua)
        ? 'Mac'
        : /Windows/.test(ua)
          ? 'Windows'
          : /Linux/.test(ua)
            ? 'Linux'
            : 'невідомий пристрій';
  return `${browser} · ${os}`;
}
