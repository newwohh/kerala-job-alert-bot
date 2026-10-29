import fs from 'node:fs';
import path from 'node:path';

let loadedProfile;

if (process.env.APPLICANT_PROFILE) {
  try {
    loadedProfile = typeof process.env.APPLICANT_PROFILE === 'string'
      ? JSON.parse(process.env.APPLICANT_PROFILE)
      : process.env.APPLICANT_PROFILE;
  } catch (e) {
    console.warn('Could not parse APPLICANT_PROFILE from env:', e.message);
  }
}

if (!loadedProfile) {
  const profilePath = path.resolve('data/profile.json');
  if (fs.existsSync(profilePath)) {
    try {
      loadedProfile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
    } catch (e) {
      console.warn('Could not read profile.json:', e.message);
    }
  }
}

export const profile = loadedProfile || {};
