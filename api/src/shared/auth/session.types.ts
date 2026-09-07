export interface AuthUserPayload {
  sub: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  iat?: number;
  exp?: number;
}
