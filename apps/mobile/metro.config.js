const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
// This app lives in a monorepo (apps/mobile) and consumes the sibling
// @isthisvalid/core workspace package — without an explicit watchFolders
// entry for the repo root, Metro won't notice edits to packages/core/src/*
// and the dev client will keep serving stale bundles until restarted.
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

module.exports = config;
