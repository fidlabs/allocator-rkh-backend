import cors, { CorsOptions } from 'cors';

const whitelist = [
  'http://localhost:3000',
  'https://localhost:3000',
  'https://allocator-rkh-backend-utcn6.ondigitalocean.app', //Prod
  'https://allocator-rkh-testenv-8dphx.ondigitalocean.app', //QA
  'https://apply.allocator.tech',
];

const corsOptions: CorsOptions = {
  origin: function (origin: any, callback: any) {
    if (whitelist.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      console.error('CORS error: Not allowed by CORS for %s', origin);
      callback(new Error('Not allowed by CORS for %s', origin));
    }
  },
};

export const corsMiddleware = cors(corsOptions);
