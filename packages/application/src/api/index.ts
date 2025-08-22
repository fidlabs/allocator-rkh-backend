import * as dotenv from 'dotenv';
import 'reflect-metadata';
import '@src/api/http/controllers/index.js';
import '@src/api/http/controllers/admin.controller';

import { Application, json, urlencoded } from 'express';

import config from '@src/config';
import { TYPES } from '@src/types';
import { initialize } from '@src/startup';
import { IEventBus, Logger } from '@filecoin-plus/core';
import { InversifyExpressServer } from 'inversify-express-utils';
import { errorHandler } from './http/middlewares/error-handler';
import { corsMiddleware } from './http/middlewares/cors-middleware';
import { Db } from 'mongodb';
import { subscribeRefreshMetaAllocator } from '@src/application/use-cases/refresh-ma-datacap/subscribe-refresh-ma.service';
import { subscribeApplicationSubmissions } from '@src/application/use-cases/create-application/subscribe-application-submissions.service';
import { subscribeApplicationEdits } from '@src/application/use-cases/edit-application/subscribe-application-edits.service';
import { subscribeGovernanceReviews } from '@src/application/use-cases/submit-governance-review/subscribe-governance-reviews.service';
import { subscribeDatacapAllocations } from '@src/application/use-cases/update-datacap-allocation/subscribe-datacap-allocations.service';
import { subscribeRKHApprovals } from '@src/application/use-cases/update-rkh-approvals/subscribe-rkh-approvals.service';
import { subscribeMetaAllocatorApprovals } from '@src/application/use-cases/update-ma-approvals/subscribe-ma-approvals.service';
import { subscribeMetaAllocatorAllowances } from '@src/application/use-cases/refresh-application/subscribe-refresh-ma.service';

dotenv.config();

async function main() {
  // Initialize the container
  const container = await initialize();

  // Get the logger from the container
  const logger = container.get<Logger>(TYPES.Logger);

  // Initialize and configure the API server
  const server = new InversifyExpressServer(container);
  server.setConfig((app: Application) => {
    app.use(corsMiddleware);
    app.use(urlencoded({ extended: true }));
    app.use(json());

    // Add raw body parsing for RPC endpoint
    app.use('/api/v1/rpc', (req, res, next) => {
      const contentType = req.headers['content-type'] || '';

      if (contentType.includes('text/plain')) {
        // For text/plain, we need to get the raw body
        let rawData = '';
        req.setEncoding('utf8');

        req.on('data', chunk => {
          rawData += chunk;
        });

        req.on('end', () => {
          try {
            console.log('Raw text/plain body:', rawData);
            req.body = JSON.parse(rawData);
            next();
          } catch (error) {
            console.error('Failed to parse text/plain as JSON:', error);
            res.status(400).json({
              jsonrpc: '2.0',
              id: 1,
              error: {
                code: -32700,
                message: 'Parse error: Invalid JSON in text/plain body',
              },
            });
          }
        });
      } else {
        // For application/json, use the default parsed body
        next();
      }
    });

    // Add simple RPC proxy route that doesn't require Inversify
    app.post('/api/v1/rpc', async (req, res) => {
      try {
        console.log('RPC Proxy Request Headers:', req.headers);
        console.log('RPC Proxy Request Body:', req.body);
        console.log('RPC Proxy Request Body Type:', typeof req.body);

        const { method, params, id = 1, jsonrpc = '2.0' } = req.body;

        console.log('Parsed method:', method);
        console.log('Parsed params:', params);
        console.log('Parsed id:', id);
        console.log('Parsed jsonrpc:', jsonrpc);

        if (!method) {
          res.status(400).json({
            jsonrpc,
            id,
            error: {
              code: -32600,
              message: 'Invalid Request: method is required',
            },
          });
          return;
        }

        // Get the target RPC URL from environment or config
        const targetRpcUrl = process.env.LOTUS_RPC_URL || 'https://api.node.glif.io/rpc/v1';
        const rpcToken = process.env.LOTUS_AUTH_TOKEN;

        // Prepare headers for the Lotus RPC call
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };

        if (rpcToken) {
          headers['Authorization'] = `Bearer ${rpcToken}`;
        }

        // Forward the RPC request to the Lotus node
        const lotusResponse = await fetch(targetRpcUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            jsonrpc,
            id,
            method,
            params: params || [],
          }),
        });

        if (!lotusResponse.ok) {
          logger.error('Lotus RPC request failed', {
            status: lotusResponse.status,
            statusText: lotusResponse.statusText,
            method,
            params,
          });

          res.status(lotusResponse.status).json({
            jsonrpc,
            id,
            error: {
              code: -32603,
              message: `Internal error: ${lotusResponse.statusText}`,
            },
          });
          return;
        }

        const lotusData = await lotusResponse.json();

        // Forward the response back to the client
        res.json(lotusData);
      } catch (error) {
        logger.error('RPC proxy error', { error });

        res.status(500).json({
          jsonrpc: '2.0',
          id: req.body?.id || 1,
          error: {
            code: -32603,
            message: 'Internal error: RPC proxy failed',
          },
        });
      }
    });

    // Add health check route
    app.get('/api/v1/rpc/health', (req, res) => {
      res.json({ status: 'healthy', service: 'rpc-proxy' });
    });
  });
  server.setErrorConfig((app: Application) => {
    app.use(errorHandler);
  });

  // Delete de db documents for applications
  const db = container.get<Db>(TYPES.Db);
  // await db.collection('applicationDetails').deleteMany({})
  // await db.collection('datacap-allocator-events').deleteMany({})
  await db.collection('applicationDetails').createIndex({ applicationId: 1 }, { unique: true });

  // Bind the API server to the container
  const apiServer = server.build();
  container.bind<Application>(TYPES.ApiServer).toConstantValue(apiServer);

  // Initialize RabbitMQ as subscribe to events
  const eventBus = container.get<IEventBus>(TYPES.EventBus);
  try {
    // TODO: needed for RabbitMQ await eventBus.init();
    await eventBus.subscribeEvents();
    logger.info('Event bus initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize event bus ', { error });
    process.exit(1);
  }

  // Start worker services
  await subscribeApplicationSubmissions(container);
  await subscribeApplicationEdits(container);
  await subscribeGovernanceReviews(container);
  await subscribeRKHApprovals(container);
  await subscribeDatacapAllocations(container);
  await subscribeMetaAllocatorApprovals(container);
  await subscribeRefreshMetaAllocator(container);
  await subscribeMetaAllocatorAllowances(container);

  // Start the API server
  apiServer.listen({ host: '0.0.0.0', port: config.API_PORT });
  console.log('The application has initialised on the port %s', config.API_PORT);
}

main().catch(error => {
  console.error('Unhandled error while starting the application:', error);
  process.exit(1);
});
