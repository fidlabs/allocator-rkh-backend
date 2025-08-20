import 'reflect-metadata';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { Application, json, urlencoded } from 'express';
import { InversifyExpressServer } from 'inversify-express-utils';
import '@src/api/http/controllers/meta-allocator.controller';
import * as dotenv from 'dotenv';
import { TestContainerBuilder } from '@mocks/builders';

process.env.NODE_ENV = 'test';
dotenv.config({ path: '.env.test' });

describe('GET /api/v1/ma', () => {
  let app: Application;

  beforeAll(async () => {
    const testBuilder = new TestContainerBuilder();
    const testSetup = testBuilder.withLogger().withRepositories().withServices().build();

    const server = new InversifyExpressServer(testSetup.container);
    server.setConfig((app: Application) => {
      app.use(urlencoded({ extended: true }));
      app.use(json());
    });

    app = server.build();
    app.listen();
  });

  it('should return meta-allocator addresses', async () => {
    const response = await request(app).get('/api/v1/ma');

    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual({
      status: '200',
      message: 'MetaAllocator addresses retrieved successfully',
      data: [
        {
          name: 'MDMA',
          ethAddress: '0xB6F5d279AEad97dFA45209F3E53969c2EF43C21d',
          filAddress: 'f410fw325e6novwl57jcsbhz6koljylxuhqq5jnp5ftq',
          ethSafeAddress: '0x2e25A2f6bC2C0b7669DFB25180Ed57e07dAabe9e',
          filSafeAddress: 'f410ffys2f5v4fqfxm2o7wjiyb3kx4b62vpu66gmu7ia',
          signers: [
            '0x6D16eAf8Ad9dA277Cb33C53528fb977ab93D5A2e',
            '0x106A371ab66ACA71753757eBD9Bb0a323e055229',
            '0xDABAe878B6D1045a9417Eaf2cc4280Dbc510f3f6',
          ],
        },
        {
          name: 'ODMA',
          ethAddress: '0xE896C15F5120A07C2481e0fcf3d008E1C9E76C1f',
          filAddress: 'f410f5clmcx2recqhyjeb4d6phuai4he6o3a77guvfny',
          ethSafeAddress: '0xfeaCBca666CA237F01F0B192fB9F43D61F32F41a',
          filSafeAddress: 'f410f72wlzjtgzirx6apqwgjpxh2d2yptf5a2f6ns7gi',
          signers: [
            '0x7285B7D3248fde1cCF9E087993fdfC79EC54b54a',
            '0xDABAe878B6D1045a9417Eaf2cc4280Dbc510f3f6',
          ],
        },
      ],
    });
  });
});
