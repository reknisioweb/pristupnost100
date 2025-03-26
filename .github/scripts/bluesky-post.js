// Předpoklad: Používá se Node.js prostředí
// Instalace potřebných knihoven: axios a atproto (npm install axios @atproto/api)

import fs from 'fs/promises'; // není aktuálně využito, ale může sloužit pro budoucí rozšíření
import axios from 'axios'; // pro HTTP požadavky
import { BskyAgent } from '@atproto/api'; // oficiální knihovna pro Bluesky API

// URL ke generovanému JSON souboru s obsahem příspěvku
const JSON_URL = 'https://pristupnost100.netlify.app/recent.json';

// Přihlašovací údaje jsou načítány z prostředí (secrets v GitHub Actions)
const BLUESKY_IDENTIFIER = process.env.BLUESKY_IDENTIFIER; // např. user.bsky.social
const BLUESKY_PASSWORD = process.env.BLUESKY_PASSWORD;

/**
 * Zkrátí řetězec na maximální počet grafémů (uživatelsky viditelných znaků),
 * přičemž ukončí výstup vždy na konci celého slova. Pokud dojde ke zkrácení,
 * výsledek je zakončen výpustkem '…'.
 *
 * @param {string} text - Vstupní text ke zkrácení.
 * @param {number} [max=300] - Maximální počet grafémů.
 * @returns {string} Zkrácený text vhodný pro zveřejnění.
 */
function truncateToMaxGraphemes(text, max = 300) {
  const segmenter = new Intl.Segmenter('cs', { granularity: 'grapheme' });
  const graphemes = [...segmenter.segment(text)];

  if (graphemes.length <= max) {
    return text; // text se vejde, není třeba upravovat
  }

  // Zkrácení na max. délku –1 kvůli výpustku
  const truncated = graphemes.slice(0, max - 1).map(s => s.segment).join('');

  // Najdeme poslední mezeru a text zkrátíme na celé slovo
  const lastSpace = truncated.lastIndexOf(' ');

  if (lastSpace === -1) {
    return truncated + '…'; // pokud není mezera, přidáme výpustek rovnou
  }

  return truncated.slice(0, lastSpace) + '…';
}

/**
 * Hlavní asynchronní funkce, která:
 * 1. Načte obsah recent.json z Netlify
 * 2. Vytvoří text příspěvku dle šablony
 * 3. Přihlásí se do služby Bluesky pomocí API klienta
 * 4. Ověří délku textu a případně ho zkrátí
 * 5. Odesílá příspěvek přes API
 *
 * @returns {Promise<void>} Vrací promisu, která se vyřeší po dokončení procesu nebo selhání.
 */
const run = async () => {
  try {
    // 1. Načti recent.json z Netlify
    const response = await axios.get(JSON_URL);
    const { tip, link, countdown } = response.data;

    // 2. Sestav text příspěvku podle šablony
    const rawText = `#Přístupnost100: ${tip}\n\n${link}\n\n${countdown}`;
    const postText = truncateToMaxGraphemes(rawText, 300);

    // 3. Přihlas se do Bluesky pomocí API agenta
    const agent = new BskyAgent({ service: 'https://bsky.social' });
    await agent.login({ identifier: BLUESKY_IDENTIFIER, password: BLUESKY_PASSWORD });

    // 4. Odeslání příspěvku
    await agent.post({ text: postText });

    console.log('Příspěvek byl úspěšně publikován.');
  } catch (error) {
    // Vypiš detail chyby, pokud dojde k selhání (např. chybné přihlášení, timeout apod.)
    console.error('Chyba při publikování:', error.response?.data || error.message || error);
  }
};

// Spuštění skriptu
run();