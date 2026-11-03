import type { Config } from "jest";

const config: Config = {
    preset: "ts-jest",
    testEnvironment: "node",
    roots: ["<rootDir>/__tests__/unit", "<rootDir>/__tests__/integration"],
    resolver: "<rootDir>/jest.resolver.js",
    testPathIgnorePatterns: ["/node_modules/", "__tests__/component/"],
    clearMocks: true,
};

export default config;