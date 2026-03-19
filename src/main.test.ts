import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

interface TestHooks {
  collectCitationMatches(text: string): Array<{ verseKey: string }>;
  destroyQuranReferenceLinker(): void;
  fetchVerseData(verseKey: string): Promise<{
    verseKey: string;
    translationText: string | null;
    translationSource: string | null;
    audioUrl: string | null;
    notes: string[];
  }>;
  getTooltipState(): { status: string; verseKey: string | null };
  initQuranReferenceLinker(): void;
  normalizeAudioUrl(url: string | null | undefined): string | null;
  parseCitationText(text: string, allowBareNumeric: boolean): { verseKey: string } | null;
  resolveSurahNumber(name: string): number | null;
  toggleAudioPlayback(): Promise<void>;
  closeTooltip(): void;
}

declare global {
  var __QRL_TEST_HOOKS__: TestHooks | undefined;
}

class MockAudio {
  public currentTime = 0;
  public paused = true;
  public preload = 'none';
  public src = '';
  public load = vi.fn();
  private readonly listeners = new Map<string, Set<() => void>>();

  addEventListener(type: string, listener: () => void): void {
    const existing = this.listeners.get(type) ?? new Set<() => void>();
    existing.add(listener);
    this.listeners.set(type, existing);
  }

  removeEventListener(type: string, listener: () => void): void {
    this.listeners.get(type)?.delete(listener);
  }

  async play(): Promise<void> {
    this.paused = false;
    this.dispatch('play');
  }

  pause(): void {
    const wasPaused = this.paused;
    this.paused = true;

    if (!wasPaused) {
      this.dispatch('pause');
    }
  }

  dispatch(type: string): void {
    this.listeners.get(type)?.forEach((listener) => listener());
  }
}

let coarsePointer = false;
let hooks: TestHooks;

function setMatchMedia(): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: coarsePointer && query === '(pointer: coarse)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function mockPrimaryResponse(translationText: string | null = null): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      verse: {
        verse_key: '2:255',
        text_uthmani: 'ٱللَّهُ لَآ إِلَـٰهَ إِلَّا هُوَ',
        audio: {
          url: 'Alafasy/mp3/002255.mp3',
        },
        translations: translationText
          ? [
              {
                text: translationText,
                resource_name: 'Requested Translation',
              },
            ]
          : null,
      },
    }),
  } as Response;
}

function mockTranslationResponse(text: string | null, translationName = 'Saheeh International'): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      translations: text ? [{ text }] : [],
      meta: {
        translation_name: translationName,
      },
    }),
  } as Response;
}

beforeAll(async () => {
  window.__QRL_DISABLE_AUTO_INIT__ = true;
  setMatchMedia();
  Object.defineProperty(globalThis, 'Audio', {
    configurable: true,
    writable: true,
    value: MockAudio,
  });

  await import('./main.ts');
  hooks = globalThis.__QRL_TEST_HOOKS__ as TestHooks;
});

beforeEach(() => {
  coarsePointer = false;
  setMatchMedia();
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

afterEach(() => {
  hooks.destroyQuranReferenceLinker();
  document.body.innerHTML = '';
});

describe('citation parsing', () => {
  it('matches supported reference formats and ignores bare numeric text', () => {
    expect(hooks.parseCitationText('2:255', true)?.verseKey).toBe('2:255');
    expect(hooks.parseCitationText('Quran 2:255', false)?.verseKey).toBe('2:255');
    expect(hooks.parseCitationText('Surah Baqarah 2:255', false)?.verseKey).toBe('2:255');
    expect(hooks.parseCitationText('2:255', false)).toBeNull();
    expect(hooks.resolveSurahNumber('Al-Baqarah')).toBe(2);
    expect(hooks.resolveSurahNumber('Baqarah')).toBe(2);
  });

  it('collects bracketed and prefixed matches without overlap', () => {
    const matches = hooks.collectCitationMatches('Read [2:255] and Quran 3:18 today.');
    expect(matches).toHaveLength(2);
    expect(matches[0]?.verseKey).toBe('2:255');
    expect(matches[1]?.verseKey).toBe('3:18');
  });
});

describe('dom scanning', () => {
  it('wraps matches only in eligible text nodes', () => {
    document.body.innerHTML = '<p>Read [2:255] and <a>[3:18]</a>.</p><code>[4:1]</code>';
    hooks.initQuranReferenceLinker();

    const wrapped = document.querySelectorAll('[data-qrl-ref="true"]');
    expect(wrapped).toHaveLength(1);
    expect(wrapped[0]?.textContent).toBe('[2:255]');
    expect(document.querySelector('a [data-qrl-ref="true"]')).toBeNull();
    expect(document.querySelector('code [data-qrl-ref="true"]')).toBeNull();
  });

  it('processes newly inserted nodes through the mutation observer', async () => {
    hooks.initQuranReferenceLinker();
    const dynamicNode = document.createElement('div');
    dynamicNode.textContent = 'Dynamic Quran 2:255 content';
    document.body.append(dynamicNode);

    await new Promise((resolve) => window.setTimeout(resolve, 32));

    expect(dynamicNode.querySelector('[data-qrl-ref="true"]')?.textContent).toBe('Quran 2:255');
  });
});

describe('data fetching', () => {
  it('uses the primary translation when present', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => mockPrimaryResponse('Primary translation')));

    const verse = await hooks.fetchVerseData('2:255');
    expect(verse.translationText).toBe('Primary translation');
    expect(verse.translationSource).toBe('Requested Translation');
    expect(verse.audioUrl).toBe('https://verses.quran.com/Alafasy/mp3/002255.mp3');
    expect(verse.notes).toEqual([]);
  });

  it('falls back to public translation endpoints and strips footnotes', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(mockPrimaryResponse(null))
        .mockResolvedValueOnce(mockTranslationResponse('Fallback <sup foot_note="1">1</sup> text'))
    );

    const verse = await hooks.fetchVerseData('2:255');
    expect(verse.translationText).toBe('Fallback text');
    expect(verse.translationSource).toBe('Saheeh International');
    expect(verse.notes).toEqual([]);
  });

  it('tries the second fallback when the first one is empty', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(mockPrimaryResponse(null))
        .mockResolvedValueOnce(mockTranslationResponse(null))
        .mockResolvedValueOnce(mockTranslationResponse('Secondary fallback', 'M.A.S. Abdel Haleem')),
    );

    const verse = await hooks.fetchVerseData('2:255');
    expect(verse.translationText).toBe('Secondary fallback');
    expect(verse.translationSource).toBe('M.A.S. Abdel Haleem');
  });
});

describe('interaction and audio', () => {
  it('opens after the hover debounce on fine pointers', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(mockPrimaryResponse('Primary translation'))));
    document.body.innerHTML = '<p>Read [2:255]</p>';
    hooks.initQuranReferenceLinker();

    const trigger = document.querySelector<HTMLElement>('[data-qrl-ref="true"]');
    expect(trigger).not.toBeNull();

    trigger?.dispatchEvent(new Event('pointerover', { bubbles: true, composed: true }));
    vi.advanceTimersByTime(299);
    expect(hooks.getTooltipState().status).toBe('hidden');

    vi.advanceTimersByTime(1);
    expect(hooks.getTooltipState().status).toBe('loading');
  });

  it('toggles on tap for coarse pointers and stops audio when closed', async () => {
    coarsePointer = true;
    setMatchMedia();
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(mockPrimaryResponse('Primary translation'))));
    document.body.innerHTML = '<p>Read [2:255]</p>';
    hooks.initQuranReferenceLinker();

    const trigger = document.querySelector<HTMLElement>('[data-qrl-ref="true"]');
    trigger?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    await Promise.resolve();
    await Promise.resolve();

    expect(hooks.getTooltipState().status).toMatch(/loading|ready/);

    await new Promise((resolve) => window.setTimeout(resolve, 0));
    await hooks.toggleAudioPlayback();

    hooks.closeTooltip();

    expect(hooks.getTooltipState().status).toBe('hidden');
  });

  it('keeps the tooltip open when the audio button is clicked', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(mockPrimaryResponse('Primary translation'))));
    document.body.innerHTML = '<p>Read [2:255]</p>';
    hooks.initQuranReferenceLinker();

    const trigger = document.querySelector<HTMLElement>('[data-qrl-ref="true"]');
    trigger?.dispatchEvent(new Event('pointerover', { bubbles: true, composed: true }));
    vi.advanceTimersByTime(300);
    await vi.runAllTimersAsync();
    await Promise.resolve();

    expect(hooks.getTooltipState().status).toBe('ready');

    const tooltipHost = document.querySelector<HTMLElement>('[data-qrl-tooltip-host="true"]');
    const playButton = tooltipHost?.shadowRoot?.querySelector<HTMLButtonElement>('[data-qrl-action="toggle-audio"]');

    expect(playButton).not.toBeNull();

    const pointerDownEvent =
      typeof PointerEvent === 'function'
        ? new PointerEvent('pointerdown', { bubbles: true, composed: true })
        : new MouseEvent('pointerdown', { bubbles: true, composed: true });

    playButton?.dispatchEvent(pointerDownEvent);
    playButton?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    await Promise.resolve();

    expect(hooks.getTooltipState().status).toBe('ready');
  });
});
