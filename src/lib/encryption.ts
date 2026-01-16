import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-encryption-key-change-in-production';

// Derivar clave de 32 bytes usando SHA256 (compatible con Python Fernet)
function deriveKey(secret: string): Buffer {
  return createHash('sha256').update(secret).digest();
}

/**
 * Servicio de encriptación usando AES-256-CBC
 * Compatible con el sistema Python existente
 */
export class EncryptionService {
  private key: Buffer;

  constructor(secretKey?: string) {
    this.key = deriveKey(secretKey || ENCRYPTION_KEY);
  }

  /**
   * Encripta un texto plano
   * @param plainText - Texto a encriptar
   * @returns Texto encriptado en formato "iv:encrypted" (base64)
   */
  encrypt(plainText: string): string {
    if (!plainText) return '';

    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-cbc', this.key, iv);

    let encrypted = cipher.update(plainText, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    return `${iv.toString('base64')}:${encrypted}`;
  }

  /**
   * Desencripta un texto encriptado
   * @param encryptedText - Texto encriptado en formato "iv:encrypted"
   * @returns Texto plano
   */
  decrypt(encryptedText: string): string {
    if (!encryptedText) return '';

    try {
      const [ivBase64, encrypted] = encryptedText.split(':');
      if (!ivBase64 || !encrypted) return '';

      const iv = Buffer.from(ivBase64, 'base64');
      const decipher = createDecipheriv('aes-256-cbc', this.key, iv);

      let decrypted = decipher.update(encrypted, 'base64', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch {
      return '';
    }
  }

  /**
   * Encripta solo si el valor es proporcionado
   */
  encryptIfProvided(value: string | null | undefined): string | null {
    if (!value) return null;
    return this.encrypt(value);
  }

  /**
   * Desencripta solo si el valor es proporcionado
   */
  decryptIfProvided(value: string | null | undefined): string | null {
    if (!value) return null;
    return this.decrypt(value);
  }

  /**
   * Enmascara un valor sensible
   * @param value - Valor a enmascarar
   * @param visibleChars - Número de caracteres visibles al final
   * @returns Valor enmascarado
   */
  static maskValue(value: string, visibleChars: number = 4): string {
    if (!value) return '';
    if (value.length <= visibleChars) {
      return '*'.repeat(value.length);
    }
    return '*'.repeat(value.length - visibleChars) + value.slice(-visibleChars);
  }
}

// Instancia global del servicio de encriptación
export const encryptionService = new EncryptionService();

// Funciones de conveniencia
export function encrypt(plainText: string): string {
  return encryptionService.encrypt(plainText);
}

export function decrypt(encryptedText: string): string {
  return encryptionService.decrypt(encryptedText);
}

export function maskValue(value: string, visibleChars?: number): string {
  return EncryptionService.maskValue(value, visibleChars);
}
