import 'dotenv/config';
import { buildApp } from './app';

const app = buildApp();
const port = parseInt(process.env.PORT || '3001', 10);

app.listen({ port, host: '0.0.0.0' }, (err, address) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  app.log.info(`Backend running at ${address}`);
});
