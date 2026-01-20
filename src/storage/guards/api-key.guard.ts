import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);

  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];
    const clientIp = request.ip || request.connection?.remoteAddress || 'unknown';
    const userAgent = request.headers['user-agent'] || 'unknown';

    if (!apiKey) {
      this.logger.warn(`🚫 Auth failed: No API key provided | IP: ${clientIp} | UA: ${userAgent}`);
      throw new UnauthorizedException('API key is required');
    }

    const validKeys = [
      this.configService.get<string>('API_KEY_MAIN'),
      this.configService.get<string>('API_KEY_SECONDARY'),
    ].filter(Boolean) as string[];

    // Comparación constant-time para prevenir timing attacks
    const isValid = validKeys.some(validKey => this.secureCompare(apiKey, validKey));

    if (!isValid) {
      this.logger.warn(`🚫 Auth failed: Invalid API key | IP: ${clientIp} | UA: ${userAgent} | Key prefix: ${apiKey.substring(0, 8)}...`);
      throw new UnauthorizedException('Invalid API key');
    }

    return true;
  }

  /**
   * Comparación constant-time para prevenir timing attacks.
   * Siempre toma el mismo tiempo independientemente de dónde falle.
   */
  private secureCompare(provided: string, valid: string): boolean {
    if (typeof provided !== 'string' || typeof valid !== 'string') {
      return false;
    }

    // Padding para igualar longitudes (evita leak de longitud)
    const maxLen = Math.max(provided.length, valid.length);
    const paddedProvided = provided.padEnd(maxLen, '\0');
    const paddedValid = valid.padEnd(maxLen, '\0');

    try {
      return crypto.timingSafeEqual(
        Buffer.from(paddedProvided, 'utf8'),
        Buffer.from(paddedValid, 'utf8')
      );
    } catch {
      return false;
    }
  }
}
