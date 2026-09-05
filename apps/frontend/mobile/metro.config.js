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

// Web and mobile intentionally use different React versions. Resolve renderer
// singletons from this app even when a shared dependency has another peer copy.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (/^(react|react-dom)(\/|$)/.test(moduleName)) {
    return context.resolveRequest(
      { ...context, originModulePath: path.join(projectRoot, 'package.json') },
      moduleName,
      platform
    );
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
