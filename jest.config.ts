import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  moduleNameMapper: {
    // Map @/* imports to src/* for the test runner
    "^@/(.*)$": "<rootDir>/src/$1",
    // Resolve the shared workspace package straight to its source, bypassing
    // the npm-workspace symlink (avoids resolver/transformIgnorePatterns
    // edge cases with symlinked node_modules entries).
    "^@isthisvalid/core/(.*)$": "<rootDir>/packages/core/src/$1.ts",
  },
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: { jsx: "react-jsx" } }],
  },
  testMatch: ["**/__tests__/**/*.test.ts", "**/__tests__/**/*.test.tsx"],
  testPathIgnorePatterns: ["/node_modules/", "/.claude/worktrees/"],
  clearMocks: true,
};

export default config;
