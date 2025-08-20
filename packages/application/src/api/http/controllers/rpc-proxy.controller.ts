import { Request, Response } from 'express';
import { controller, httpPost, httpGet } from 'inversify-express-utils';
import { inject } from 'inversify';
import { TYPES } from '@src/types';
import { Logger } from '@filecoin-plus/core';

interface RpcRequest {
  method: string;
  params: any[];
  id?: string | number;
  jsonrpc?: string;
}

@controller('/api/v1/rpc')
export class RpcProxyController {
  constructor(
    @inject(TYPES.Logger) private readonly logger: Logger
  ) {}

  @httpPost('/')
  async proxyRpcRequest(req: Request, res: Response): Promise<void> {
    try {
      const { method, params, id = 1, jsonrpc = '2.0' }: RpcRequest = req.body;
      
      if (!method) {
        res.status(400).json({
          jsonrpc,
          id,
          error: {
            code: -32600,
            message: 'Invalid Request: method is required'
          }
        });
        return;
      }

      // Get the target RPC URL from environment or config
      const targetRpcUrl = process.env.LOTUS_RPC_URL || 'https://api.node.glif.io/rpc/v1';
      const rpcToken = process.env.LOTUS_RPC_TOKEN;

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
          params: params || []
        })
      });

      if (!lotusResponse.ok) {
        this.logger.error('Lotus RPC request failed', {
          status: lotusResponse.status,
          statusText: lotusResponse.statusText,
          method,
          params
        });

        res.status(lotusResponse.status).json({
          jsonrpc,
          id,
          error: {
            code: -32603,
            message: `Internal error: ${lotusResponse.statusText}`
          }
        });
        return;
      }

      const lotusData = await lotusResponse.json();
      
      // Forward the response back to the client
      res.json(lotusData);

    } catch (error) {
      this.logger.error('RPC proxy error', { error });
      
      res.status(500).json({
        jsonrpc: '2.0',
        id: req.body?.id || 1,
        error: {
          code: -32603,
          message: 'Internal error: RPC proxy failed'
        }
      });
    }
  }

  @httpGet('/health')
  async healthCheck(req: Request, res: Response): Promise<void> {
    res.json({ status: 'healthy', service: 'rpc-proxy' });
  }
}
