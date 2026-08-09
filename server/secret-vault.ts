import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { EncryptedSecret } from './provider-domain';

export class SecretVault {
  private keyPromise?: Promise<Buffer>;

  constructor(private readonly keyPath = resolve('var/data/.provider-key')) {}

  async encrypt(value: string): Promise<EncryptedSecret> {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', await this.getKey(), iv);
    const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return { iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64') };
  }

  async decrypt(secret: EncryptedSecret | undefined): Promise<string> {
    if (!secret) return '';
    const decipher = createDecipheriv('aes-256-gcm', await this.getKey(), Buffer.from(secret.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(secret.tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(secret.data, 'base64')), decipher.final()]).toString('utf8');
  }

  private getKey(): Promise<Buffer> {
    this.keyPromise ??= this.loadOrCreateKey();
    return this.keyPromise;
  }

  private async loadOrCreateKey(): Promise<Buffer> {
    try { return Buffer.from((await readFile(this.keyPath, 'utf8')).trim(), 'base64'); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      const key = randomBytes(32);
      await mkdir(dirname(this.keyPath), { recursive: true });
      await writeFile(this.keyPath, key.toString('base64'), { encoding: 'utf8', mode: 0o600 });
      await chmod(this.keyPath, 0o600).catch(() => undefined);
      return key;
    }
  }
}
