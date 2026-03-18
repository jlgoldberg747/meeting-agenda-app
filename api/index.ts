import 'dotenv/config';
import { buildApp } from '../backend/src/app';
import { IncomingMessage, ServerResponse } from 'http';

const app = buildApp();

let isReady = false;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (!isReady) {
    await app.ready();
    isReady = true;
  }
  app.server.emit('request', req, res);
}
