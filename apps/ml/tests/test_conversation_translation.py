from types import SimpleNamespace
from unittest.mock import MagicMock
import pytest
from fastapi import HTTPException
from lingoroad_ml.speech import translation


def test_translation_uses_fixed_instructions_and_preserves_source(monkeypatch):
    monkeypatch.setenv('SPEAKING_CONTENT_MODEL', 'test-model')
    client = MagicMock()
    client.with_options.return_value.chat.completions.create.return_value = SimpleNamespace(
        choices=[SimpleNamespace(message=SimpleNamespace(content='{"translationVi":"Bạn sống ở đâu?"}'))])
    monkeypatch.setattr(translation, '_client', lambda: client)
    assert translation.translate('Where do you live?')['translationVi'] == 'Bạn sống ở đâu?'
    client.with_options.assert_called_once_with(timeout=25, max_retries=0)
    messages = client.with_options.return_value.chat.completions.create.call_args.kwargs['messages']
    assert messages[1]['role'] == 'user'
    assert 'Where do you live?' in messages[1]['content']


@pytest.mark.parametrize('content', ['invalid', '{"translationVi":""}', '{"translationVi":"   "}'])
def test_invalid_translation_is_retryable(monkeypatch, content):
    monkeypatch.setenv('SPEAKING_CONTENT_MODEL', 'test-model')
    client = MagicMock()
    client.with_options.return_value.chat.completions.create.return_value = SimpleNamespace(
        choices=[SimpleNamespace(message=SimpleNamespace(content=content))])
    monkeypatch.setattr(translation, '_client', lambda: client)
    with pytest.raises(HTTPException) as error:
        translation.translate('Hello')
    assert error.value.status_code == 502
