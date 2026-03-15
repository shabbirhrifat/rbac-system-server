import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const PASSWORD_KEY_LENGTH = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const hash = (await scrypt(password, salt, PASSWORD_KEY_LENGTH)) as Buffer;
  return `${salt}:${hash.toString('hex')}`;
}

export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  const [salt, currentHash] = storedHash.split(':');

  if (!salt || !currentHash) {
    return false;
  }

  const derivedHash = (await scrypt(
    password,
    salt,
    PASSWORD_KEY_LENGTH,
  )) as Buffer;
  const currentHashBuffer = Buffer.from(currentHash, 'hex');

  if (derivedHash.length !== currentHashBuffer.length) {
    return false;
  }

  return timingSafeEqual(derivedHash, currentHashBuffer);
}
