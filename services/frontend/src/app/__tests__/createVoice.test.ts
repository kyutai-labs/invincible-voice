import { createVoice } from '../../utils/userData';

// Mock global fetch
global.fetch = jest.fn();

describe('createVoice', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('sends the audio file, name and language as multipart form data', async () => {
    const created = { uid: 'voice-uid', name: 'user@example.com/My voice' };
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(created),
    });
    const file = new File(['audio'], 'sample.wav', { type: 'audio/wav' });

    const result = await createVoice(file, 'My voice', 'fr');

    expect(result).toEqual({ data: created, status: 200 });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('/api/v1/voices/create');
    expect(init.method).toBe('POST');
    const body = init.body as FormData;
    expect(body.get('name')).toBe('My voice');
    expect(body.get('language')).toBe('fr');
    expect((body.get('audio_file') as File).name).toBe('sample.wav');
  });

  test('returns the status and an error message when the backend rejects the request', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
    });
    const file = new File(['audio'], 'sample.wav', { type: 'audio/wav' });

    const result = await createVoice(file, 'My voice', 'xx');

    expect(result).toEqual({
      error: 'Failed to create voice: 400 Bad Request',
      status: 400,
    });
  });
});
