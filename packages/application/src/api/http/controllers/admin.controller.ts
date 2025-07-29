import { Request, Response } from 'express';
import { inject } from 'inversify';
import { controller, httpPost, request, response } from 'inversify-express-utils';
import { Db } from 'mongodb';

import { TYPES } from '@src/types';
import { ok, unauthorized, internalServerError } from '@src/api/http/processors/response';
import { Logger } from '@filecoin-plus/core';
import config from '@src/config';

@controller('/api/v1/admin')
export class AdminController {
  constructor(
    @inject(TYPES.Db) private readonly db: Db,
    @inject(TYPES.Logger) private readonly logger: Logger,
  ) {}

  @httpPost('/reset-database')
  async resetDatabase(@request() req: Request, @response() res: Response) {
    const apiKey = req.headers['x-api-key'];
    const expectedApiKey = config.ADMIN_API_KEY;

    if (!apiKey || apiKey !== expectedApiKey) {
      return res.status(401).json(unauthorized('Invalid API key'));
    }

    try {
      const collections = await this.db.listCollections().toArray();

      for (const collection of collections) {
        await this.db.collection(collection.name).drop();
      }
      this.logger.info('All database collections have been dropped');
      return res.json(ok('Database reset successful', {}));
    } catch (error) {
      this.logger.error('Error resetting database:', error);
      return res.status(500).json(internalServerError('Failed to reset database'));
    }
  }
}
