import tooltipCss from './widget.css?inline';

type TooltipStatus = 'hidden' | 'loading' | 'ready' | 'error';
type AudioPhase = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

interface ParsedCitation {
  chapter: number;
  verse: number;
  verseKey: string;
}

interface CitationMatch extends ParsedCitation {
  start: number;
  end: number;
  displayText: string;
}

interface VerseData {
  verseKey: string;
  arabicText: string | null;
  translationText: string | null;
  translationSource: string | null;
  audioUrl: string | null;
  notes: string[];
}

interface TooltipViewState {
  status: TooltipStatus;
  verseKey: string | null;
  triggerLabel: string;
  data: VerseData | null;
  errorMessage: string | null;
}

interface PrimaryVerseApiResponse {
  verse?: {
    verse_key?: string;
    text_uthmani?: string | null;
    audio?: {
      url?: string | null;
    } | null;
    translations?: Array<{
      text?: string | null;
      resource_name?: string | null;
    }> | null;
  };
}

interface TranslationApiResponse {
  translations?: Array<{
    text?: string | null;
  }>;
  meta?: {
    translation_name?: string | null;
    author_name?: string | null;
  };
}

type TriggerElement = HTMLSpanElement & {
  dataset: DOMStringMap & {
    chapter: string;
    verse: string;
    verseKey: string;
  };
};

declare global {
  interface Window {
    __QRL_DISABLE_AUTO_INIT__?: boolean;
    __QRL_WIDGET_INITIALIZED__?: boolean;
  }
}

const TRIGGER_ATTR = 'data-qrl-ref';
const TOOLTIP_HOST_ATTR = 'data-qrl-tooltip-host';
const TOOLTIP_PANEL_ATTR = 'data-qrl-panel';
const AUDIO_BUTTON_ATTR = 'data-qrl-action';
const TRIGGER_CLASS = 'quran-ref-linker';
const TRIGGER_SELECTOR = `[${TRIGGER_ATTR}="true"]`;
const ELIGIBLE_SELECTOR = 'p, li, span, div';
const EXCLUDED_ANCESTOR_SELECTOR = [
  TRIGGER_SELECTOR,
  `[${TOOLTIP_HOST_ATTR}]`,
  'a',
  'button',
  'input',
  'textarea',
  'select',
  'option',
  'code',
  'pre',
  'script',
  'style',
  'noscript',
  'audio',
  'video',
  'svg',
  '[contenteditable]',
].join(', ');
const OPEN_DELAY_MS = 300;
const CLOSE_DELAY_MS = 110;
const TOOLTIP_MARGIN_PX = 8;
const TOOLTIP_GAP_PX = 10;
const PRIMARY_API_BASE = 'https://api.quran.com/api/v4';
const AUDIO_CDN_BASE = 'https://verses.quran.com/';

const SURAH_NAMES = [
  'Al-Fatihah',
  'Al-Baqarah',
  "Ali 'Imran",
  'An-Nisa',
  "Al-Ma'idah",
  "Al-An'am",
  "Al-A'raf",
  'Al-Anfal',
  'At-Tawbah',
  'Yunus',
  'Hud',
  'Yusuf',
  "Ar-Ra'd",
  'Ibrahim',
  'Al-Hijr',
  'An-Nahl',
  'Al-Isra',
  'Al-Kahf',
  'Maryam',
  'Taha',
  'Al-Anbiya',
  'Al-Hajj',
  "Al-Mu'minun",
  'An-Nur',
  'Al-Furqan',
  "Ash-Shu'ara",
  'An-Naml',
  'Al-Qasas',
  "Al-'Ankabut",
  'Ar-Rum',
  'Luqman',
  'As-Sajdah',
  'Al-Ahzab',
  'Saba',
  'Fatir',
  'Ya-Sin',
  'As-Saffat',
  'Sad',
  'Az-Zumar',
  'Ghafir',
  'Fussilat',
  'Ash-Shuraa',
  'Az-Zukhruf',
  'Ad-Dukhan',
  'Al-Jathiyah',
  'Al-Ahqaf',
  'Muhammad',
  'Al-Fath',
  'Al-Hujurat',
  'Qaf',
  'Adh-Dhariyat',
  'At-Tur',
  'An-Najm',
  'Al-Qamar',
  'Ar-Rahman',
  "Al-Waqi'ah",
  'Al-Hadid',
  'Al-Mujadila',
  'Al-Hashr',
  'Al-Mumtahanah',
  'As-Saff',
  "Al-Jumu'ah",
  'Al-Munafiqun',
  'At-Taghabun',
  'At-Talaq',
  'At-Tahrim',
  'Al-Mulk',
  'Al-Qalam',
  'Al-Haqqah',
  "Al-Ma'arij",
  'Nuh',
  'Al-Jinn',
  'Al-Muzzammil',
  'Al-Muddaththir',
  'Al-Qiyamah',
  'Al-Insan',
  'Al-Mursalat',
  'An-Naba',
  "An-Nazi'at",
  'Abasa',
  'At-Takwir',
  'Al-Infitar',
  'Al-Mutaffifin',
  'Al-Inshiqaq',
  'Al-Buruj',
  'At-Tariq',
  "Al-A'la",
  'Al-Ghashiyah',
  'Al-Fajr',
  'Al-Balad',
  'Ash-Shams',
  'Al-Layl',
  'Ad-Duha',
  'Ash-Sharh',
  'At-Tin',
  "Al-'Alaq",
  'Al-Qadr',
  'Al-Bayyinah',
  'Az-Zalzalah',
  'Al-Adiyat',
  "Al-Qari'ah",
  'At-Takathur',
  'Al-Asr',
  'Al-Humazah',
  'Al-Fil',
  'Quraysh',
  "Al-Ma'un",
  'Al-Kawthar',
  'Al-Kafirun',
  'An-Nasr',
  'Al-Masad',
  'Al-Ikhlas',
  'Al-Falaq',
  'An-Nas',
] as const;

const SURAH_ALIASES: Record<number, string[]> = {
  1: ['Fatihah', 'Fatiha', 'The Opening'],
  2: ['Baqarah', 'The Cow'],
  3: ['Aal Imran', 'Ali Imran', 'Family of Imran'],
  4: ['Nisa', 'Women'],
  5: ['Maidah', 'Table Spread'],
  6: ['Anam', 'Cattle'],
  7: ['Araf', 'The Heights'],
  8: ['Anfal', 'Spoils of War'],
  9: ['Tawbah', 'Taubah', 'Baraah'],
  13: ['Raad', 'Thunder'],
  17: ['Isra', 'Bani Israil'],
  20: ['Ta Ha'],
  21: ['Anbiya', 'Prophets'],
  23: ['Muminun', 'Believers'],
  24: ['Nur', 'Light'],
  26: ['Shuara', 'Poets'],
  27: ['Naml', 'Ant'],
  29: ['Ankabut', 'Spider'],
  30: ['Rum', 'Romans'],
  32: ['Sajdah', 'Prostration'],
  33: ['Ahzab', 'Confederates'],
  36: ['Yasin', 'Ya Sin'],
  37: ['Saffat'],
  39: ['Zumar', 'Groups'],
  40: ['Mumin', 'The Forgiver'],
  42: ['Shura'],
  43: ['Zukhruf'],
  44: ['Dukhan', 'Smoke'],
  45: ['Jathiyah', 'Crouching'],
  46: ['Ahqaf'],
  48: ['Fath', 'Victory'],
  49: ['Hujurat', 'Rooms'],
  51: ['Dhariyat', 'Zariyat'],
  52: ['Tur', 'Mount'],
  53: ['Najm', 'Star'],
  54: ['Qamar', 'Moon'],
  55: ['Rahman', 'The Most Merciful'],
  56: ['Waqiah'],
  57: ['Hadid', 'Iron'],
  58: ['Mujadalah', 'Mujadila'],
  59: ['Hashr', 'Exile'],
  60: ['Mumtahina', 'Mumtahanah'],
  61: ['Saff'],
  62: ['Jumuah', 'Friday'],
  63: ['Munafiqun', 'Hypocrites'],
  64: ['Taghabun'],
  65: ['Talaq', 'Divorce'],
  66: ['Tahrim'],
  67: ['Mulk', 'Dominion'],
  68: ['Qalam', 'The Pen', 'Nun'],
  69: ['Haqqah', 'The Reality'],
  70: ['Maarij', 'Ascension'],
  72: ['Jinn'],
  73: ['Muzammil'],
  74: ['Mudaththir', 'Muddathir'],
  75: ['Qiyama', 'Qiyamah'],
  76: ['Insan', 'Dahr', 'Man'],
  77: ['Mursalat'],
  78: ['Naba', 'Nabaa'],
  79: ['Naziat', 'Naziat'],
  81: ['Takwir'],
  82: ['Infitar'],
  83: ['Mutaffifin'],
  84: ['Inshiqaq'],
  85: ['Buruj'],
  86: ['Tariq', 'Tarik'],
  87: ['Ala'],
  88: ['Ghashiya', 'Ghashiyah'],
  89: ['Fajr', 'Dawn'],
  91: ['Shams', 'Sun'],
  92: ['Layl', 'Night'],
  93: ['Duha', 'Morning Brightness'],
  94: ['Sharh', 'Inshirah'],
  95: ['Tin', 'Fig'],
  96: ['Alaq', 'Iqra'],
  97: ['Qadr'],
  98: ['Bayyinah', 'Clear Proof'],
  99: ['Zalzalah', 'Zilzal'],
  100: ['Adiyat', 'Coursers'],
  101: ['Qariah', 'Calamity'],
  102: ['Takasur', 'Takathur'],
  103: ['Asr', 'Time'],
  104: ['Humaza', 'Humazah'],
  105: ['Fil', 'Feel', 'Elephant'],
  107: ['Maun', 'Small Kindnesses'],
  109: ['Kafiroon', 'Kafirun', 'Disbelievers'],
  110: ['Nasr', 'Divine Support'],
  111: ['Masad', 'Lahab'],
  112: ['Ikhlas', 'Sincerity'],
  113: ['Falaq', 'Daybreak'],
  114: ['Nas', 'Mankind'],
};

const SURAH_LOOKUP = buildSurahLookup();
const BRACKETED_REFERENCE_REGEX = /\[[^[\]]+?\]/g;
const PREFIXED_REFERENCE_REGEX =
  /\b(?:Qur'?an\s+\d{1,3}\s*:\s*\d{1,3}|Surah\s+[A-Za-z][A-Za-z' -]{0,80}?\s+\d{1,3}\s*:\s*\d{1,3})\b/gi;

const verseCache = new Map<string, Promise<VerseData>>();

let mutationObserver: MutationObserver | null = null;
let tooltipHost: HTMLDivElement | null = null;
let tooltipRoot: ShadowRoot | null = null;
let tooltipMount: HTMLDivElement | null = null;
let activeTrigger: TriggerElement | null = null;
let hoveredTrigger: TriggerElement | null = null;
let pointerInsideTooltip = false;
let focusInsideTooltip = false;
let lastTooltipInteractionAt = 0;
let hoverOpenTimer: number | null = null;
let closeTimer: number | null = null;
let pendingMutationNodes = new Set<Node>();
let mutationScanFrame: number | null = null;
let currentOpenRequestId = 0;
let tooltipViewState: TooltipViewState = {
  status: 'hidden',
  verseKey: null,
  triggerLabel: '',
  data: null,
  errorMessage: null,
};
let sharedAudio: HTMLAudioElement | null = null;
let audioState: { verseKey: string | null; phase: AudioPhase; errorMessage: string | null } = {
  verseKey: null,
  phase: 'idle',
  errorMessage: null,
};

const PLAY_ICON = `
  <svg aria-hidden="true" viewBox="0 0 24 24" class="h-4 w-4 fill-current">
    <path d="M8 5.14v13.72c0 .76.83 1.24 1.5.86l10.2-5.86a1 1 0 0 0 0-1.72L9.5 4.28A1 1 0 0 0 8 5.14Z"></path>
  </svg>
`;

const PAUSE_ICON = `
  <svg aria-hidden="true" viewBox="0 0 24 24" class="h-4 w-4 fill-current">
    <path d="M7 5a1 1 0 0 1 1 1v12a1 1 0 1 1-2 0V6a1 1 0 0 1 1-1Zm10 0a1 1 0 0 1 1 1v12a1 1 0 1 1-2 0V6a1 1 0 0 1 1-1Z"></path>
  </svg>
`;

function buildSurahLookup(): Map<string, number> {
  const lookup = new Map<string, number>();

  SURAH_NAMES.forEach((name, index) => {
    const number = index + 1;
    const names = [name, ...(SURAH_ALIASES[number] ?? [])];

    names.forEach((value) => {
      lookup.set(normalizeSurahName(value), number);
    });
  });

  return lookup;
}

function normalizeSurahName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\bsurah\b/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

function normalizeWithArticleFallback(name: string): string[] {
  const normalized = normalizeSurahName(name);
  const withoutArticle = normalized.replace(/^(?:al|an|ar|as|at|ad|az|ash|adh)(?=[a-z0-9]{2,})/, '');
  return withoutArticle && withoutArticle !== normalized ? [normalized, withoutArticle] : [normalized];
}

function resolveSurahNumber(name: string): number | null {
  for (const candidate of normalizeWithArticleFallback(name)) {
    const found = SURAH_LOOKUP.get(candidate);

    if (found) {
      return found;
    }
  }

  return null;
}

function clearHoverOpenTimer(): void {
  if (hoverOpenTimer !== null) {
    window.clearTimeout(hoverOpenTimer);
    hoverOpenTimer = null;
  }
}

function clearCloseTimer(): void {
  if (closeTimer !== null) {
    window.clearTimeout(closeTimer);
    closeTimer = null;
  }
}

function isCoarsePointerDevice(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(pointer: coarse)').matches
    : false;
}

function createTriggerElement(match: CitationMatch): TriggerElement {
  const trigger = document.createElement('span') as TriggerElement;
  trigger.className = TRIGGER_CLASS;
  trigger.setAttribute(TRIGGER_ATTR, 'true');
  trigger.dataset.chapter = String(match.chapter);
  trigger.dataset.verse = String(match.verse);
  trigger.dataset.verseKey = match.verseKey;
  trigger.tabIndex = 0;
  trigger.setAttribute('role', 'button');
  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-label', `Open Quran verse ${match.verseKey}`);
  trigger.textContent = match.displayText;
  trigger.style.cursor = 'pointer';
  trigger.style.borderBottom = '1px dotted rgba(71, 85, 105, 0.72)';
  trigger.style.textDecoration = 'none';
  trigger.style.textUnderlineOffset = '0.18em';
  trigger.style.color = 'inherit';

  return trigger;
}

function parseCitationText(text: string, allowBareNumeric: boolean): ParsedCitation | null {
  const trimmed = text.trim();
  const surahMatch = trimmed.match(/^Surah\s+(.+?)\s+(\d{1,3})\s*:\s*(\d{1,3})$/i);

  if (surahMatch) {
    const surahName = surahMatch[1];
    const chapterText = surahMatch[2];
    const verseText = surahMatch[3];

    if (!surahName || !chapterText || !verseText) {
      return null;
    }

    const resolvedChapter = resolveSurahNumber(surahName);
    const chapter = Number.parseInt(chapterText, 10);
    const verse = Number.parseInt(verseText, 10);

    if (!resolvedChapter || resolvedChapter !== chapter || !isValidVerseReference(chapter, verse)) {
      return null;
    }

    return {
      chapter,
      verse,
      verseKey: `${chapter}:${verse}`,
    };
  }

  const numericMatch = trimmed.match(/^(?:Qur'?an\s+)?(\d{1,3})\s*:\s*(\d{1,3})$/i);

  if (!numericMatch) {
    return null;
  }

  if (!allowBareNumeric && !/^Qur'?an/i.test(trimmed)) {
    return null;
  }

  const chapterText = numericMatch[1];
  const verseText = numericMatch[2];

  if (!chapterText || !verseText) {
    return null;
  }

  const chapter = Number.parseInt(chapterText, 10);
  const verse = Number.parseInt(verseText, 10);

  if (!isValidVerseReference(chapter, verse)) {
    return null;
  }

  return {
    chapter,
    verse,
    verseKey: `${chapter}:${verse}`,
  };
}

function isValidVerseReference(chapter: number, verse: number): boolean {
  return Number.isInteger(chapter) && Number.isInteger(verse) && chapter >= 1 && chapter <= 114 && verse >= 1;
}

function rangesOverlap(candidate: CitationMatch, existingMatches: CitationMatch[]): boolean {
  return existingMatches.some((item) => candidate.start < item.end && candidate.end > item.start);
}

function collectCitationMatches(text: string): CitationMatch[] {
  const matches: CitationMatch[] = [];

  for (const bracketedMatch of text.matchAll(BRACKETED_REFERENCE_REGEX)) {
    const fullMatch = bracketedMatch[0];
    const start = bracketedMatch.index ?? -1;

    if (start < 0) {
      continue;
    }

    const parsed = parseCitationText(fullMatch.slice(1, -1), true);

    if (!parsed) {
      continue;
    }

    matches.push({
      ...parsed,
      start,
      end: start + fullMatch.length,
      displayText: fullMatch,
    });
  }

  for (const prefixedMatch of text.matchAll(PREFIXED_REFERENCE_REGEX)) {
    const fullMatch = prefixedMatch[0];
    const start = prefixedMatch.index ?? -1;

    if (start < 0) {
      continue;
    }

    const parsed = parseCitationText(fullMatch, false);

    if (!parsed) {
      continue;
    }

    const candidate: CitationMatch = {
      ...parsed,
      start,
      end: start + fullMatch.length,
      displayText: fullMatch,
    };

    if (!rangesOverlap(candidate, matches)) {
      matches.push(candidate);
    }
  }

  return matches.sort((left, right) => left.start - right.start);
}

function shouldProcessTextNode(textNode: Text): boolean {
  const rawText = textNode.textContent ?? '';

  if (!rawText.trim()) {
    return false;
  }

  if (!/[\[:]/.test(rawText) && !/\b(?:qur'?an|surah)\b/i.test(rawText)) {
    return false;
  }

  const parent = textNode.parentElement;

  if (!parent) {
    return false;
  }

  if (parent.closest(EXCLUDED_ANCESTOR_SELECTOR)) {
    return false;
  }

  return Boolean(parent.closest(ELIGIBLE_SELECTOR));
}

function replaceTextNodeWithMatches(textNode: Text, matches: CitationMatch[]): void {
  const sourceText = textNode.textContent ?? '';
  const fragment = document.createDocumentFragment();
  let cursor = 0;

  matches.forEach((match) => {
    if (match.start > cursor) {
      fragment.append(document.createTextNode(sourceText.slice(cursor, match.start)));
    }

    fragment.append(createTriggerElement(match));
    cursor = match.end;
  });

  if (cursor < sourceText.length) {
    fragment.append(document.createTextNode(sourceText.slice(cursor)));
  }

  textNode.replaceWith(fragment);
}

function scanRoot(root: Node): void {
  const textNodes: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => (shouldProcessTextNode(node as Text) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
  });

  let currentNode = walker.nextNode();

  while (currentNode) {
    textNodes.push(currentNode as Text);
    currentNode = walker.nextNode();
  }

  textNodes.forEach((textNode) => {
    const matches = collectCitationMatches(textNode.textContent ?? '');

    if (matches.length > 0) {
      replaceTextNodeWithMatches(textNode, matches);
    }
  });
}

function scheduleMutationScan(node: Node): void {
  pendingMutationNodes.add(node);

  if (mutationScanFrame !== null) {
    return;
  }

  mutationScanFrame = window.requestAnimationFrame(() => {
    const nodes = Array.from(pendingMutationNodes);
    pendingMutationNodes = new Set<Node>();
    mutationScanFrame = null;

    nodes.forEach((candidate) => {
      if (!candidate.isConnected) {
        return;
      }

      if (candidate.nodeType === Node.TEXT_NODE) {
        const parent = candidate.parentNode;

        if (parent) {
          scanRoot(parent);
        }

        return;
      }

      scanRoot(candidate);
    });

    if (activeTrigger && !activeTrigger.isConnected) {
      closeTooltip();
    }
  });
}

function observeDocumentMutations(): void {
  if (!document.body || mutationObserver) {
    return;
  }

  mutationObserver = new MutationObserver((records) => {
    records.forEach((record) => {
      record.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.TEXT_NODE) {
          scheduleMutationScan(node);
        }
      });
    });
  });

  mutationObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

function fetchJson<T>(url: string): Promise<T> {
  return fetch(url).then(async (response) => {
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    return (await response.json()) as T;
  });
}

function stripHtmlToPlainText(html: string | null | undefined): string | null {
  if (!html) {
    return null;
  }

  const parser = new DOMParser();
  const documentFragment = parser.parseFromString(`<div>${html}</div>`, 'text/html');
  documentFragment.querySelectorAll('sup').forEach((node) => node.remove());
  const text = documentFragment.body.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  return text || null;
}

function normalizeAudioUrl(audioUrl: string | null | undefined): string | null {
  if (!audioUrl) {
    return null;
  }

  if (/^https?:\/\//i.test(audioUrl)) {
    return audioUrl;
  }

  return new URL(audioUrl.replace(/^\/+/, ''), AUDIO_CDN_BASE).toString();
}

async function fetchFallbackTranslation(verseKey: string): Promise<{ text: string | null; source: string | null }> {
  const fallbackIds = [20, 85];

  for (const translationId of fallbackIds) {
    const response = await fetchJson<TranslationApiResponse>(
      `${PRIMARY_API_BASE}/quran/translations/${translationId}?verse_key=${encodeURIComponent(verseKey)}`,
    );
    const translation = stripHtmlToPlainText(response.translations?.[0]?.text);

    if (translation) {
      return {
        text: translation,
        source: response.meta?.translation_name ?? response.meta?.author_name ?? null,
      };
    }
  }

  return {
    text: null,
    source: null,
  };
}

async function fetchVerseData(verseKey: string): Promise<VerseData> {
  const response = await fetchJson<PrimaryVerseApiResponse>(
    `${PRIMARY_API_BASE}/verses/by_key/${encodeURIComponent(verseKey)}?translations=131&audio=7&fields=text_uthmani`,
  );
  const verse = response.verse;

  if (!verse) {
    throw new Error('Verse payload was missing from the Quran.com response.');
  }

  const notes: string[] = [];
  const verseTranslation = stripHtmlToPlainText(verse.translations?.[0]?.text);
  let translationText = verseTranslation;
  let translationSource = verse.translations?.[0]?.resource_name ?? null;

  if (!translationText) {
    const fallbackTranslation = await fetchFallbackTranslation(verseKey);
    translationText = fallbackTranslation.text;
    translationSource = fallbackTranslation.source;

    if (!translationText) {
      notes.push('English translation unavailable.');
    }
  }

  const audioUrl = normalizeAudioUrl(verse.audio?.url);

  if (!audioUrl) {
    notes.push('Audio unavailable.');
  }

  if (!verse.text_uthmani) {
    notes.push('Arabic text unavailable.');
  }

  return {
    verseKey: verse.verse_key ?? verseKey,
    arabicText: verse.text_uthmani ?? null,
    translationText,
    translationSource,
    audioUrl,
    notes,
  };
}

function getCachedVerseData(verseKey: string): Promise<VerseData> {
  const cached = verseCache.get(verseKey);

  if (cached) {
    return cached;
  }

  const request = fetchVerseData(verseKey).catch((error) => {
    verseCache.delete(verseKey);
    throw error;
  });

  verseCache.set(verseKey, request);
  return request;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getAudioButtonMarkup(verseData: VerseData | null): string {
  const isActiveAudio = Boolean(verseData && audioState.verseKey === verseData.verseKey);
  const canPlay = Boolean(verseData?.audioUrl);
  const isLoading = isActiveAudio && audioState.phase === 'loading';
  const isPlaying = isActiveAudio && audioState.phase === 'playing';
  const icon = isLoading
    ? '<span class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700"></span>'
    : isPlaying
      ? PAUSE_ICON
      : PLAY_ICON;

  return `
    <button
      type="button"
      ${canPlay ? '' : 'disabled'}
      ${canPlay ? `aria-label="${isPlaying ? 'Pause recitation' : 'Play recitation'}"` : 'aria-label="Audio unavailable"'}
      ${canPlay ? '' : 'aria-disabled="true"'}
      ${canPlay ? `${AUDIO_BUTTON_ATTR}="toggle-audio"` : ''}
      class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
    >
      ${icon}
    </button>
  `;
}

function createTooltipMarkup(state: TooltipViewState): string {
  if (state.status === 'hidden') {
    return '';
  }

  const frameClasses =
    'w-[min(22rem,calc(100vw-16px))] max-h-[calc(100vh-16px)] overflow-auto rounded-2xl border border-slate-200 bg-white/95 p-4 text-slate-800 shadow-2xl shadow-slate-900/10 backdrop-blur';
  const verseKey = escapeHtml(state.verseKey ?? '');

  if (state.status === 'loading') {
    return `
      <div ${TOOLTIP_PANEL_ATTR}="true" class="${frameClasses}">
        <div class="flex items-center justify-between gap-3">
          <div>
            <p class="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Quran ${verseKey}</p>
            <p class="mt-1 text-xs text-slate-500">Loading verse...</p>
          </div>
          <div class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700"></div>
        </div>
      </div>
    `;
  }

  if (state.status === 'error') {
    return `
      <div ${TOOLTIP_PANEL_ATTR}="true" class="${frameClasses}">
        <div class="flex items-center justify-between gap-3">
          <div>
            <p class="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Quran ${verseKey}</p>
            <p class="mt-1 text-xs text-slate-500">Unable to load this reference.</p>
          </div>
        </div>
        <p class="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm leading-6 text-rose-700">${escapeHtml(
          state.errorMessage ?? 'An unknown error occurred.',
        )}</p>
      </div>
    `;
  }

  const verseData = state.data;

  if (!verseData) {
    return '';
  }

  const translationMarkup = verseData.translationText
    ? `<p lang="en" class="mt-4 text-sm leading-6 text-slate-700">${escapeHtml(verseData.translationText)}</p>`
    : '<p class="mt-4 text-sm leading-6 text-slate-500">English translation unavailable.</p>';
  const sourceMarkup = verseData.translationSource
    ? `<p class="mt-1 text-xs text-slate-500">Translation: ${escapeHtml(verseData.translationSource)}</p>`
    : '<p class="mt-1 text-xs text-slate-500">Translation unavailable</p>';
  const notesMarkup =
    verseData.notes.length > 0
      ? `<p class="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-700">${escapeHtml(
          verseData.notes.join(' '),
        )}</p>`
      : '';

  return `
    <div ${TOOLTIP_PANEL_ATTR}="true" class="${frameClasses}">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Quran ${escapeHtml(
            verseData.verseKey,
          )}</p>
          ${sourceMarkup}
        </div>
        ${getAudioButtonMarkup(verseData)}
      </div>
      ${
        verseData.arabicText
          ? `<div class="mt-4 rounded-2xl bg-slate-50 px-4 py-3">
              <p dir="rtl" lang="ar" class="text-right text-[1.45rem] leading-10 text-slate-900">${escapeHtml(
                verseData.arabicText,
              )}</p>
            </div>`
          : ''
      }
      ${translationMarkup}
      ${notesMarkup}
    </div>
  `;
}

function getTooltipPanel(): HTMLDivElement | null {
  return tooltipRoot?.querySelector<HTMLDivElement>(`[${TOOLTIP_PANEL_ATTR}="true"]`) ?? null;
}

function markTooltipInteraction(): void {
  lastTooltipInteractionAt = Date.now();
}

function hadRecentTooltipInteraction(): boolean {
  return Date.now() - lastTooltipInteractionAt < 250;
}

function isNodeInsideTooltip(target: EventTarget | null): boolean {
  if (!tooltipHost || !(target instanceof Node)) {
    return false;
  }

  return target === tooltipHost || Boolean(tooltipRoot?.contains(target));
}

function isTooltipFocusActive(): boolean {
  return Boolean((tooltipHost && document.activeElement === tooltipHost) || tooltipRoot?.activeElement);
}

function ensureTooltipHost(): void {
  if (tooltipHost || !document.body) {
    return;
  }

  tooltipHost = document.createElement('div');
  tooltipHost.setAttribute(TOOLTIP_HOST_ATTR, 'true');
  tooltipHost.style.position = 'fixed';
  tooltipHost.style.top = '0';
  tooltipHost.style.left = '0';
  tooltipHost.style.zIndex = '2147483647';
  tooltipHost.style.display = 'none';
  tooltipHost.style.pointerEvents = 'none';
  tooltipHost.style.visibility = 'hidden';

  tooltipRoot = tooltipHost.attachShadow({ mode: 'open' });

  const styleElement = document.createElement('style');
  styleElement.textContent = tooltipCss;
  tooltipMount = document.createElement('div');
  tooltipRoot.append(styleElement, tooltipMount);
  tooltipRoot.addEventListener('click', handleTooltipClick);
  tooltipRoot.addEventListener('pointerdown', handleTooltipPointerDown);
  tooltipRoot.addEventListener('pointerover', handleTooltipPointerOver);
  tooltipRoot.addEventListener('pointerout', handleTooltipPointerOut);
  tooltipRoot.addEventListener('focusin', handleTooltipFocusIn);
  tooltipRoot.addEventListener('focusout', handleTooltipFocusOut);

  document.body.append(tooltipHost);
}

function renderTooltip(): void {
  if (!tooltipHost || !tooltipMount) {
    return;
  }

  if (tooltipViewState.status === 'hidden' || !activeTrigger) {
    tooltipMount.innerHTML = '';
    tooltipHost.style.display = 'none';
    tooltipHost.style.pointerEvents = 'none';
    tooltipHost.style.visibility = 'hidden';
    return;
  }

  tooltipMount.innerHTML = createTooltipMarkup(tooltipViewState);
  tooltipHost.style.display = 'block';
  tooltipHost.style.pointerEvents = 'auto';
  positionTooltip();
}

function positionTooltip(): void {
  if (!tooltipHost || !activeTrigger || tooltipViewState.status === 'hidden') {
    return;
  }

  const panel = getTooltipPanel();

  if (!panel) {
    return;
  }

  tooltipHost.style.visibility = 'hidden';
  tooltipHost.style.left = '0';
  tooltipHost.style.top = '0';

  const triggerRect = activeTrigger.getBoundingClientRect();
  const panelRect = panel.getBoundingClientRect();
  const centeredLeft = triggerRect.left + triggerRect.width / 2 - panelRect.width / 2;
  const maxLeft = Math.max(TOOLTIP_MARGIN_PX, window.innerWidth - panelRect.width - TOOLTIP_MARGIN_PX);
  const left = Math.min(Math.max(centeredLeft, TOOLTIP_MARGIN_PX), maxLeft);
  const preferredTop = triggerRect.top - panelRect.height - TOOLTIP_GAP_PX;
  const top =
    preferredTop >= TOOLTIP_MARGIN_PX
      ? preferredTop
      : Math.min(
          Math.max(triggerRect.bottom + TOOLTIP_GAP_PX, TOOLTIP_MARGIN_PX),
          Math.max(TOOLTIP_MARGIN_PX, window.innerHeight - panelRect.height - TOOLTIP_MARGIN_PX),
        );

  tooltipHost.style.left = `${Math.round(left)}px`;
  tooltipHost.style.top = `${Math.round(top)}px`;
  tooltipHost.style.visibility = 'visible';
}

function setTriggerExpanded(trigger: TriggerElement | null, expanded: boolean): void {
  if (trigger) {
    trigger.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  }
}

function updateTooltipState(nextState: Partial<TooltipViewState>): void {
  tooltipViewState = {
    ...tooltipViewState,
    ...nextState,
  };
  renderTooltip();
}

function getSharedAudio(): HTMLAudioElement {
  if (sharedAudio) {
    return sharedAudio;
  }

  sharedAudio = new Audio();
  sharedAudio.preload = 'none';
  sharedAudio.addEventListener('play', () => {
    if (audioState.verseKey) {
      audioState = {
        verseKey: audioState.verseKey,
        phase: 'playing',
        errorMessage: null,
      };
      renderTooltip();
    }
  });
  sharedAudio.addEventListener('pause', () => {
    if (audioState.verseKey) {
      audioState = {
        verseKey: audioState.verseKey,
        phase: 'paused',
        errorMessage: null,
      };
      renderTooltip();
    }
  });
  sharedAudio.addEventListener('ended', () => {
    if (sharedAudio) {
      sharedAudio.currentTime = 0;
    }

    audioState = {
      verseKey: audioState.verseKey,
      phase: 'paused',
      errorMessage: null,
    };
    renderTooltip();
  });
  sharedAudio.addEventListener('error', () => {
    audioState = {
      verseKey: audioState.verseKey,
      phase: 'error',
      errorMessage: 'Unable to play audio.',
    };
    renderTooltip();
  });

  return sharedAudio;
}

function stopAudio(reset: boolean): void {
  if (!sharedAudio) {
    audioState = {
      verseKey: null,
      phase: 'idle',
      errorMessage: null,
    };
    return;
  }

  sharedAudio.pause();

  if (reset) {
    try {
      sharedAudio.currentTime = 0;
    } catch {
      // Ignore reset failures from mocked audio instances.
    }
  }

  audioState = {
    verseKey: null,
    phase: 'idle',
    errorMessage: null,
  };
}

async function toggleAudioPlayback(): Promise<void> {
  const verseData = tooltipViewState.data;

  if (!verseData?.audioUrl) {
    return;
  }

  const audio = getSharedAudio();
  const isSameTrack = audioState.verseKey === verseData.verseKey && audio.src === verseData.audioUrl;

  if (isSameTrack && audioState.phase === 'playing') {
    audio.pause();
    return;
  }

  if (!isSameTrack) {
    audio.pause();
    audio.src = verseData.audioUrl;
    audio.load();
  }

  audioState = {
    verseKey: verseData.verseKey,
    phase: 'loading',
    errorMessage: null,
  };
  renderTooltip();

  try {
    await audio.play();
  } catch (error) {
    audioState = {
      verseKey: verseData.verseKey,
      phase: 'error',
      errorMessage: error instanceof Error ? error.message : 'Unable to play audio.',
    };
    renderTooltip();
  }
}

function handleTooltipClick(event: Event): void {
  markTooltipInteraction();
  clearCloseTimer();

  const target = event.target;

  if (!(target instanceof Element)) {
    return;
  }

  const actionButton = target.closest<HTMLButtonElement>(`[${AUDIO_BUTTON_ATTR}="toggle-audio"]`);

  if (!actionButton) {
    return;
  }

  void toggleAudioPlayback();
}

function handleTooltipPointerDown(): void {
  markTooltipInteraction();
  pointerInsideTooltip = true;
  focusInsideTooltip = true;
  clearCloseTimer();
}

function handleTooltipPointerOver(): void {
  markTooltipInteraction();
  pointerInsideTooltip = true;
  clearCloseTimer();
}

function handleTooltipPointerOut(event: Event): void {
  const relatedTarget = (event as PointerEvent).relatedTarget;

  if (relatedTarget instanceof Node && tooltipRoot?.contains(relatedTarget)) {
    return;
  }

  pointerInsideTooltip = false;

  if (!isActiveTriggerFocused() && hoveredTrigger !== activeTrigger) {
    scheduleClose();
  }
}

function handleTooltipFocusIn(): void {
  markTooltipInteraction();
  focusInsideTooltip = true;
  clearCloseTimer();
}

function handleTooltipFocusOut(): void {
  window.setTimeout(() => {
    focusInsideTooltip = isTooltipFocusActive();

    if (!hadRecentTooltipInteraction() && !focusInsideTooltip && !isActiveTriggerFocused() && hoveredTrigger !== activeTrigger) {
      closeTooltip();
    }
  }, 0);
}

function isEventInsideTooltip(event: Event): boolean {
  if (!tooltipHost) {
    return false;
  }

  return event.composedPath().includes(tooltipHost);
}

function getTriggerFromTarget(target: EventTarget | null): TriggerElement | null {
  if (!(target instanceof Element)) {
    return null;
  }

  return target.closest<TriggerElement>(TRIGGER_SELECTOR);
}

function isActiveTriggerFocused(): boolean {
  return Boolean(activeTrigger && document.activeElement === activeTrigger);
}

function scheduleClose(): void {
  clearHoverOpenTimer();
  clearCloseTimer();

  closeTimer = window.setTimeout(() => {
    if (!pointerInsideTooltip && !focusInsideTooltip && hoveredTrigger !== activeTrigger && !isActiveTriggerFocused()) {
      closeTooltip();
    }
  }, CLOSE_DELAY_MS);
}

function openTooltip(trigger: TriggerElement): void {
  ensureTooltipHost();
  clearHoverOpenTimer();
  clearCloseTimer();
  pointerInsideTooltip = false;
  focusInsideTooltip = false;
  lastTooltipInteractionAt = 0;

  if (activeTrigger && activeTrigger !== trigger) {
    setTriggerExpanded(activeTrigger, false);
    stopAudio(true);
  }

  activeTrigger = trigger;
  setTriggerExpanded(activeTrigger, true);

  const verseKey = trigger.dataset.verseKey;
  const requestId = ++currentOpenRequestId;

  tooltipViewState = {
    status: 'loading',
    verseKey,
    triggerLabel: trigger.textContent?.trim() ?? verseKey,
    data: null,
    errorMessage: null,
  };
  renderTooltip();

  void getCachedVerseData(verseKey)
    .then((data) => {
      if (requestId !== currentOpenRequestId || activeTrigger !== trigger) {
        return;
      }

      tooltipViewState = {
        status: 'ready',
        verseKey,
        triggerLabel: trigger.textContent?.trim() ?? verseKey,
        data,
        errorMessage: null,
      };
      renderTooltip();
    })
    .catch((error) => {
      if (requestId !== currentOpenRequestId || activeTrigger !== trigger) {
        return;
      }

      tooltipViewState = {
        status: 'error',
        verseKey,
        triggerLabel: trigger.textContent?.trim() ?? verseKey,
        data: null,
        errorMessage: error instanceof Error ? error.message : 'Unable to load the verse.',
      };
      renderTooltip();
    });
}

function closeTooltip(): void {
  clearHoverOpenTimer();
  clearCloseTimer();
  pointerInsideTooltip = false;
  focusInsideTooltip = false;
  lastTooltipInteractionAt = 0;
  hoveredTrigger = null;
  currentOpenRequestId += 1;
  stopAudio(true);
  setTriggerExpanded(activeTrigger, false);
  activeTrigger = null;
  tooltipViewState = {
    status: 'hidden',
    verseKey: null,
    triggerLabel: '',
    data: null,
    errorMessage: null,
  };
  renderTooltip();
}

function handleDocumentPointerOver(event: PointerEvent): void {
  if (isCoarsePointerDevice()) {
    return;
  }

  const trigger = getTriggerFromTarget(event.target);

  if (!trigger) {
    return;
  }

  hoveredTrigger = trigger;
  clearCloseTimer();
  clearHoverOpenTimer();
  hoverOpenTimer = window.setTimeout(() => openTooltip(trigger), OPEN_DELAY_MS);
}

function handleDocumentPointerOut(event: PointerEvent): void {
  if (isCoarsePointerDevice()) {
    return;
  }

  const trigger = getTriggerFromTarget(event.target);

  if (!trigger) {
    return;
  }

  if (hoveredTrigger === trigger) {
    hoveredTrigger = null;
  }

  const relatedTarget = event.relatedTarget;

  if (relatedTarget instanceof Element) {
    if (relatedTarget.closest(TRIGGER_SELECTOR) === trigger) {
      return;
    }

    if (tooltipRoot?.contains(relatedTarget)) {
      return;
    }
  }

  clearHoverOpenTimer();

  if (activeTrigger === trigger) {
    scheduleClose();
  }
}

function handleDocumentClick(event: MouseEvent): void {
  const trigger = getTriggerFromTarget(event.target);

  if (trigger && isCoarsePointerDevice()) {
    event.preventDefault();

    if (activeTrigger === trigger && tooltipViewState.status !== 'hidden') {
      closeTooltip();
    } else {
      openTooltip(trigger);
    }

    return;
  }

  if (isEventInsideTooltip(event)) {
    markTooltipInteraction();
    clearCloseTimer();
    return;
  }

  if (!trigger && !isEventInsideTooltip(event) && tooltipViewState.status !== 'hidden') {
    closeTooltip();
  }
}

function handleDocumentFocusIn(event: FocusEvent): void {
  const trigger = getTriggerFromTarget(event.target);

  if (trigger) {
    hoveredTrigger = null;
    openTooltip(trigger);
    return;
  }

  if (isEventInsideTooltip(event)) {
    markTooltipInteraction();
    focusInsideTooltip = true;
    clearCloseTimer();
  }
}

function handleDocumentFocusOut(event: FocusEvent): void {
  window.setTimeout(() => {
    focusInsideTooltip = isTooltipFocusActive();

    if (
      hadRecentTooltipInteraction() ||
      focusInsideTooltip ||
      isActiveTriggerFocused() ||
      hoveredTrigger === activeTrigger ||
      isNodeInsideTooltip(event.relatedTarget)
    ) {
      return;
    }

    if (!pointerInsideTooltip) {
      closeTooltip();
    }
  }, 0);
}

function handleDocumentKeyDown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && tooltipViewState.status !== 'hidden') {
    event.preventDefault();
    closeTooltip();
    return;
  }

  const trigger = getTriggerFromTarget(event.target);

  if (!trigger) {
    return;
  }

  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    openTooltip(trigger);
  }
}

function handleWindowResize(): void {
  if (tooltipViewState.status !== 'hidden') {
    positionTooltip();
  }
}

function handleWindowScroll(): void {
  if (tooltipViewState.status !== 'hidden') {
    closeTooltip();
  }
}

function bindDocumentListeners(): void {
  document.addEventListener('pointerover', handleDocumentPointerOver, true);
  document.addEventListener('pointerout', handleDocumentPointerOut, true);
  document.addEventListener('click', handleDocumentClick, true);
  document.addEventListener('focusin', handleDocumentFocusIn, true);
  document.addEventListener('focusout', handleDocumentFocusOut, true);
  document.addEventListener('keydown', handleDocumentKeyDown, true);
  window.addEventListener('resize', handleWindowResize);
  window.addEventListener('scroll', handleWindowScroll, true);
}

function unbindDocumentListeners(): void {
  document.removeEventListener('pointerover', handleDocumentPointerOver, true);
  document.removeEventListener('pointerout', handleDocumentPointerOut, true);
  document.removeEventListener('click', handleDocumentClick, true);
  document.removeEventListener('focusin', handleDocumentFocusIn, true);
  document.removeEventListener('focusout', handleDocumentFocusOut, true);
  document.removeEventListener('keydown', handleDocumentKeyDown, true);
  window.removeEventListener('resize', handleWindowResize);
  window.removeEventListener('scroll', handleWindowScroll, true);
}

function initQuranReferenceLinker(): void {
  if (window.__QRL_WIDGET_INITIALIZED__ || !document.body) {
    return;
  }

  window.__QRL_WIDGET_INITIALIZED__ = true;
  ensureTooltipHost();
  bindDocumentListeners();
  scanRoot(document.body);
  observeDocumentMutations();
}

function destroyQuranReferenceLinker(): void {
  unbindDocumentListeners();
  mutationObserver?.disconnect();
  mutationObserver = null;

  if (mutationScanFrame !== null) {
    window.cancelAnimationFrame(mutationScanFrame);
    mutationScanFrame = null;
  }

  pendingMutationNodes = new Set<Node>();
  clearHoverOpenTimer();
  clearCloseTimer();
  closeTooltip();
  tooltipRoot?.removeEventListener('click', handleTooltipClick);
  tooltipRoot?.removeEventListener('pointerdown', handleTooltipPointerDown);
  tooltipRoot?.removeEventListener('pointerover', handleTooltipPointerOver);
  tooltipRoot?.removeEventListener('pointerout', handleTooltipPointerOut);
  tooltipRoot?.removeEventListener('focusin', handleTooltipFocusIn);
  tooltipRoot?.removeEventListener('focusout', handleTooltipFocusOut);
  tooltipHost?.remove();
  tooltipHost = null;
  tooltipRoot = null;
  tooltipMount = null;
  hoveredTrigger = null;
  activeTrigger = null;
  verseCache.clear();
  stopAudio(true);

  if (sharedAudio) {
    sharedAudio.src = '';
  }

  sharedAudio = null;
  delete window.__QRL_WIDGET_INITIALIZED__;
}

function autoInitialize(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  if (window.__QRL_DISABLE_AUTO_INIT__) {
    return;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initQuranReferenceLinker(), { once: true });
  } else {
    initQuranReferenceLinker();
  }
}

function registerTestHooks(): void {
  const meta = import.meta as ImportMeta & { vitest?: boolean };

  if (!meta.vitest && !window.__QRL_DISABLE_AUTO_INIT__) {
    return;
  }

  Object.assign(globalThis, {
    __QRL_TEST_HOOKS__: {
      collectCitationMatches,
      destroyQuranReferenceLinker,
      fetchVerseData,
      getCachedVerseData,
      getTooltipState: (): TooltipViewState => tooltipViewState,
      initQuranReferenceLinker,
      normalizeAudioUrl,
      parseCitationText,
      resolveSurahNumber,
      scanRoot,
      stripHtmlToPlainText,
      toggleAudioPlayback,
      closeTooltip,
    },
  });
}

registerTestHooks();
autoInitialize();
