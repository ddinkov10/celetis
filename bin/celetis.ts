import { main } from '../engine/launcher.ts';

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
