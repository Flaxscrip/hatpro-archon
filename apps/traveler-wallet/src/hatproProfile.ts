// Minimal HATPro profile model for the demo builder (subset of the published schema).

export interface HatproProfile {
  identity: { displayName: string; preferredLanguage: string };
  communication: { preferredChannel: string; contactTimePreference: string };
  foodAndBeverage: { dietaryRestrictions: string[]; allergies: string[]; cuisinePreferences: string[] };
  stayPreferences: { roomFloor: string; bedType: string; quietRoom: boolean };
  activities: { interests: string[] };
  provenance: string;
}

export const emptyProfile: HatproProfile = {
  identity: { displayName: '', preferredLanguage: 'en' },
  communication: { preferredChannel: 'app', contactTimePreference: '' },
  foodAndBeverage: { dietaryRestrictions: [], allergies: [], cuisinePreferences: [] },
  stayPreferences: { roomFloor: 'no-preference', bedType: '', quietRoom: false },
  activities: { interests: [] },
  provenance: 'self-asserted',
};

// Pre-filled sample matching the provisioned Avery profile, for a one-click demo.
export const sampleProfile: HatproProfile = {
  identity: { displayName: 'Avery', preferredLanguage: 'en' },
  communication: { preferredChannel: 'app', contactTimePreference: 'evenings' },
  foodAndBeverage: { dietaryRestrictions: ['vegetarian'], allergies: ['peanuts'], cuisinePreferences: ['japanese', 'mediterranean'] },
  stayPreferences: { roomFloor: 'high', bedType: 'king', quietRoom: true },
  activities: { interests: ['hiking', 'scuba', 'live-music'] },
  provenance: 'self-asserted',
};

export const csv = (a: string[]) => a.join(', ');
export const parseCsv = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);
