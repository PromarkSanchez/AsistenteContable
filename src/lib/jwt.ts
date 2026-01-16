import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '30m';
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

// Convierte string de tiempo a segundos
function parseTimeToSeconds(time: string): number {
  const match = time.match(/^(\d+)([smhd])$/);
  if (!match) return 30 * 60; // default 30 minutos

  const value = parseInt(match[1]);
  const unit = match[2];

  switch (unit) {
    case 's':
      return value;
    case 'm':
      return value * 60;
    case 'h':
      return value * 60 * 60;
    case 'd':
      return value * 24 * 60 * 60;
    default:
      return 30 * 60;
  }
}

export interface TokenPayload extends JWTPayload {
  sub: string; // user id
  email: string;
  type: 'access' | 'refresh';
}

// Crear Access Token
export async function createAccessToken(userId: string, email: string): Promise<string> {
  const secret = new TextEncoder().encode(JWT_SECRET);
  const expiresIn = parseTimeToSeconds(JWT_EXPIRES_IN);

  const token = await new SignJWT({
    sub: userId,
    email,
    type: 'access',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${expiresIn}s`)
    .sign(secret);

  return token;
}

// Crear Refresh Token
export async function createRefreshToken(userId: string, email: string): Promise<string> {
  const secret = new TextEncoder().encode(JWT_SECRET);
  const expiresIn = parseTimeToSeconds(REFRESH_TOKEN_EXPIRES_IN);

  const token = await new SignJWT({
    sub: userId,
    email,
    type: 'refresh',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${expiresIn}s`)
    .sign(secret);

  return token;
}

// Crear ambos tokens
export async function createTokens(userId: string, email: string) {
  const [accessToken, refreshToken] = await Promise.all([
    createAccessToken(userId, email),
    createRefreshToken(userId, email),
  ]);

  return {
    accessToken,
    refreshToken,
    tokenType: 'bearer',
  };
}

// Verificar token
export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    return payload as TokenPayload;
  } catch {
    return null;
  }
}

// Verificar y decodificar access token
export async function verifyAccessToken(token: string): Promise<TokenPayload | null> {
  const payload = await verifyToken(token);
  if (!payload || payload.type !== 'access') {
    return null;
  }
  return payload;
}

// Verificar y decodificar refresh token
export async function verifyRefreshToken(token: string): Promise<TokenPayload | null> {
  const payload = await verifyToken(token);
  if (!payload || payload.type !== 'refresh') {
    return null;
  }
  return payload;
}

// Extraer token del header Authorization
export function extractTokenFromHeader(authHeader: string | null): string | null {
  if (!authHeader) return null;

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return null;
  }

  return parts[1];
}
