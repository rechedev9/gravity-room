/**
 * Source entrypoint for the generated Vercel serverless function.
 *
 * Keep this file independent from `api/index.ts`: the latter is a committed,
 * generated artifact so Vercel can deploy one self-contained catch-all function.
 */
import { buildAppOptions } from './app-config';
import { createApp } from './create-app';
import { createNodeGateway } from './lib/node-gateway';

const app = createApp(buildAppOptions());

export default createNodeGateway((request) => app.fetch(request));
