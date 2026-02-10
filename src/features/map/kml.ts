import type { Bagup } from '../tally_session/types';

export const generateBagupsKML = (bagups: Bagup[], sessionName: string): string => {
  let kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${sessionName}</name>
`;

  bagups.forEach((bagup) => {
    if (typeof bagup.lat === 'number' && typeof bagup.lng === 'number') {
      const date = new Date(bagup.created_at).toLocaleString();
      const speciesList = Object.entries(bagup.counts)
        .map(([code, count]) => `${code}: ${count}`)
        .join('\n');

      // Escape special characters for XML
      const description = `Time: ${date}\nSpecies:\n${speciesList}`;
      const escapedDescription = description
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')
        .replace(/\n/g, '&#xA;');

      kml += `    <Placemark>
      <name>${sessionName}</name>
      <description>${escapedDescription}</description>
      <Point>
        <coordinates>${bagup.lng},${bagup.lat},0</coordinates>
      </Point>
    </Placemark>
`;
    }
  });

  kml += `  </Document>
</kml>`;

  return kml;
};
