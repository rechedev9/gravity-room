const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Monorepo: project root is the mobile package; watch the workspace so
// workspace:* packages (@gzclp/*) resolve and HMR correctly.
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.assetExts.push('wasm');
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Shared ESM packages use NodeNext-compatible `.js` specifiers in their
// TypeScript sources. Node resolves those specifiers after compilation, while
// Metro reads the workspace sources directly and otherwise looks only for a
// physical `.js` file. Prefer the exact target, then retry the same relative
// path through Metro's platform-aware extension resolver.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  try {
    return context.resolveRequest(context, moduleName, platform);
  } catch (error) {
    if (moduleName.startsWith('.') && moduleName.endsWith('.js')) {
      return context.resolveRequest(context, moduleName.slice(0, -3), platform);
    }

    throw error;
  }
};

module.exports = config;
