// Předpoklad: Používá se Node.js prostředí
// Instalace potřebných knihoven: axios a atproto (npm install axios @atproto/api)

import fs from 'fs/promises'; // není aktuálně využito, ale může sloužit pro budoucí rozšíření
import axios from 'axios'; // pro HTTP požadavky
import pkg from '@atproto/api'; // CommonJS import pro Bluesky API knihovnu
const { BskyAgent, RichText } = pkg;

// URL ke generovanému JSON souboru s obsahem příspěvku
const JSON_URL = 'https://pristupnost100.netlify.app/recent.json';

// Přihlašovací údaje jsou načítány z prostředí (secrets v GitHub Actions)
const BLUESKY_IDENTIFIER = process.env.BLUESKY_IDENTIFIER; // např. user.bsky.social
const BLUESKY_PASSWORD = process.env.BLUESKY_PASSWORD;

/**
 * Zkrátí řetězec na maximální počet grafémů (uživatelsky viditelných znaků),
 * přičemž ukončí výstup vždy na konci celého slova. Pokud dojde ke zkrácení,
 * výsledek je zakončen výpustkem '…'.
 * Pokud je `preserve` nastaven, zaručí, že daný podřetězec zůstane celý nebo bude odstraněn.
 *
 * @param {string} text - Vstupní text ke zkrácení.
 * @param {number} [max=300] - Maximální počet grafémů.
 * @param {string[]} [preserve=[]] - Pole řetězců, které musí zůstat celé nebo být vynechány.
 * @returns {string} Zkrácený text vhodný pro zveřejnění.
 */
function truncateToMaxGraphemes(text, max = 300, preserve = []) {
  const segmenter = new Intl.Segmenter('cs', { granularity: 'grapheme' });
  const graphemes = [...segmenter.segment(text)];

  if (graphemes.length <= max) {
    return text;
  }

  let truncated = graphemes.slice(0, max - 1).map(s => s.segment).join('');
  let lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace === -1) lastSpace = max - 1;
  truncated = truncated.slice(0, lastSpace) + '…';

  for (const phrase of preserve) {
    if (truncated.includes(phrase)) continue;
    if (text.includes(phrase)) {
      truncated = truncated.replace(phrase, '');
    }
  }

  return truncated;
}

/**
 * Spočítá počet bajtů v UTF-8 řetězci.
 * @param {string} str - Řetězec.
 * @returns {number} Počet bajtů.
 */
function byteLength(str) {
  return Buffer.byteLength(str, 'utf8');
}

/**
 * Hlavní asynchronní funkce, která:
 * 1. Načte obsah recent.json z Netlify
 * 2. Vytvoří text příspěvku dle šablony
 * 3. Přihlásí se do služby Bluesky pomocí API klienta
 * 4. Ověří délku textu a případně ho zkrátí
 * 5. Odesílá příspěvek přes API včetně deklarace hashtagu a odkazu
 *
 * @returns {Promise<void>} Vrací promisu, která se vyřeší po dokončení procesu nebo selhání.
 */
const run = async () => {
  try {
    const response = await axios.get(JSON_URL);
    const { tip, link, countdown } = response.data;

    const rawText = `#Přístupnost100: ${tip}\n\n${link}\n\n${countdown}`;
    const postText = truncateToMaxGraphemes(rawText, 300, [link]);

    const agent = new BskyAgent({ service: 'https://bsky.social' });
    await agent.login({ identifier: BLUESKY_IDENTIFIER, password: BLUESKY_PASSWORD });

    const rt = new RichText({ text: postText });
    await rt.detectFacets();

    await agent.post({ text: rt.text, facets: rt.facets });

    console.log('Příspěvek byl úspěšně publikován.');
  } catch (error) {
    console.error('Chyba při publikování:', error.response?.data || error.message || error);
  }
};

run();
