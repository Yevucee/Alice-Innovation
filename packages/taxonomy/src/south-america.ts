/** Default geography when catalogue pages omit explicit country tags. */
export const SOUTH_AMERICA_SOURCE_GEO_DEFAULTS: Record<string, { countryName?: string; continentName: string }> = {
  "fapesp-pipe": { countryName: "Brazil", continentName: "South America" },
  "uc-chile-technologies": { countryName: "Chile", continentName: "South America" },
  "premios-verdes-500": { continentName: "South America" },
  "gridx-portfolio": { continentName: "South America" },
  "unc-oferta-tecnologica": { countryName: "Argentina", continentName: "South America" },
  "cuech-red-proyectos": { countryName: "Chile", continentName: "South America" },
  "usp-vitrine-portfolio": { countryName: "Brazil", continentName: "South America" },
};
