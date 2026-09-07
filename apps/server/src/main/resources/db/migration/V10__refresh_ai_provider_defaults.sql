-- Refresh only values shipped by the previous default configuration.
-- Custom provider settings remain untouched and can still be entered in the UI.
UPDATE ai_provider_settings
SET base_url = 'https://api.deepseek.com',
    model = 'deepseek-v4-flash',
    updated_at = now()
WHERE provider_id = 'deepseek'
  AND base_url = 'https://api.deepseek.com/v1'
  AND model = 'deepseek-chat';

UPDATE ai_provider_settings
SET model = 'Qwen/Qwen3-32B',
    updated_at = now()
WHERE provider_id = 'siliconflow'
  AND model = 'Qwen/Qwen2.5-7B-Instruct';

UPDATE ai_provider_settings
SET model = 'claude-sonnet-4-6',
    updated_at = now()
WHERE provider_id = 'anthropic'
  AND model = 'claude-sonnet-4-20250514';

UPDATE ai_provider_settings
SET model = 'gemini-3.5-flash',
    updated_at = now()
WHERE provider_id = 'gemini'
  AND model = 'gemini-2.5-flash';

UPDATE ai_provider_settings
SET model = 'qwen3',
    updated_at = now()
WHERE provider_id = 'ollama'
  AND model = 'qwen2.5:7b';
