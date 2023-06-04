import type { Config } from 'jest';
import * as fs from 'fs';
import { MergeObjects } from './src/lib/utils';
import { PORT } from './src/proto/constant';

export type TestConfig = {
	client: Partial<{
		host: string,
		port: number,
		username: string,
		password: string,
		request_timeout: number
	}>
};

const DefaultConfig: TestConfig = {
	client: {
		host: "127.0.0.1",
		port: PORT,
		username: "guest",
		password: "guest",
		request_timeout: 200
	}
};

export default async(): Promise<Config> =>{
	let local = {} as TestConfig;
	if (fs.existsSync(__dirname + '/src/test/local-config.ts')) {
		const _local = await import('./src/test/local-config');
		local = _local.default;
	}
	const config: Config = {
		"roots": [
			"<rootDir>/src/test"
		],
		"testMatch": [
			"**/test.ts"
		],
		"transform": {
			"^.+\\.(ts|tsx)$": "ts-jest"
		},
		moduleDirectories: [
			"node_modules",
			"src",
			"src/lib",
			"src/proto"
		],
		// moduleNameMapper: {
		// 	"lib/(.*)": "<rootDir>/src/lib/$1",
		// 	"proto/(.*)": "<rootDir>/src/proto/$1"
		// },
		globals: {
			__CFG__: MergeObjects(DefaultConfig, local)
		}
	};
	return config;
};
