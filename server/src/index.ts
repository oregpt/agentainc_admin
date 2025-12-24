import { loadConfig } from './config/appConfig';
import { createHttpApp } from './http/app';

const config = loadConfig();
const app = createHttpApp();

app.listen(config.port, () => {
  console.log(`Agent-in-a-Box server listening on port ${config.port}`);
});
