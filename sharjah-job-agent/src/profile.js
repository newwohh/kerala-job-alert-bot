import fs from 'node:fs';
import path from 'node:path';
const profilePath = path.resolve('data/profile.json');
export const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
