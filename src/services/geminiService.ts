export async function summarizeIncident(description: string, severity: string): Promise<string> {
  try {
    const response = await fetch('/api/gemini/summarize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ description, severity }),
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      return errJson.fallbackText || 'AI generation failed. Please review manually.';
    }

    const data = await response.json();
    return data.text || 'AI generation failed. Please review manually.';
  } catch (error) {
    console.error('Gemini Service Client Error:', error);
    return 'AI generation failed. Please review manually.';
  }
}

