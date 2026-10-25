import { dirname } from 'node:path';

if (import.meta.main) console.log(dirname(import.meta.dir));
