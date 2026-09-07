import { MAX_TEXT_WORDS, countWords } from '../../utils/tokenUtils';
import { summarizeText } from '../../utils/userData';

global.fetch = jest.fn();

describe('countWords', () => {
  test('counts whitespace-separated words like the backend', () => {
    expect(countWords('')).toBe(0);
    expect(countWords('   ')).toBe(0);
    expect(countWords('one two\tthree\nfour  five')).toBe(5);
  });

  test('the limit is 3000 words', () => {
    expect(MAX_TEXT_WORDS).toBe(3000);
  });
});

describe('summarizeText', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('posts the text as JSON and returns the summary', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ summary: 'Short.', word_count: 1 }),
    });

    const result = await summarizeText('A very long prompt.');

    expect(result).toEqual({
      data: { summary: 'Short.', word_count: 1 },
      status: 200,
    });
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('/api/v1/user/summarize');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ text: 'A very long prompt.' });
  });

  test('returns an error when the backend fails', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 502,
      statusText: 'Bad Gateway',
    });

    const result = await summarizeText('text');

    expect(result).toEqual({
      error: 'Failed to summarize text: 502 Bad Gateway',
      status: 502,
    });
  });
});
