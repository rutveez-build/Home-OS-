// Brand is configurable via env so a fork can rebrand without touching
// components. Override BRAND_NAME, BRAND_TAGLINE, etc. in .env.local.

export const brand = {
  name: process.env.BRAND_NAME ?? "Home OS",
  tagline: process.env.BRAND_TAGLINE ?? "Never wonder what's for dinner again.",
  city: process.env.BRAND_CITY ?? "Bangalore",
  languages: process.env.BRAND_LANGUAGES ?? "English, हिन्दी, ಕನ್ನಡ",
};
