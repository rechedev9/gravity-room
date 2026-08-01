const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Monorepo: project root is the mobile package; watch the workspace so
// workspace:* packages (@gzclp/*) resolve and HMR correctly.
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

module.exports = config;
