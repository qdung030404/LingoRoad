# syntax=docker/dockerfile:1.7
FROM python:3.12-slim AS wheels
ENV PIP_DISABLE_PIP_VERSION_CHECK=1 PIP_NO_CACHE_DIR=1
WORKDIR /build
COPY requirements.txt .
RUN python -m pip wheel --wheel-dir /wheels --index-url https://download.pytorch.org/whl/cpu torch==2.13.0 \
    && python -m pip wheel --wheel-dir /wheels -r requirements.txt

FROM python:3.12-slim AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    LINGOROAD_ENVIRONMENT=production \
    NLTK_DATA=/opt/nltk_data
WORKDIR /app
RUN groupadd --system --gid 10001 lingoroad \
    && useradd --system --uid 10001 --gid lingoroad --home-dir /app lingoroad
COPY --from=wheels /wheels /wheels
COPY --from=wheels /build/requirements.txt /tmp/requirements.txt
RUN python -m pip install --no-index --find-links=/wheels \
        torch==2.13.0 -r /tmp/requirements.txt \
    && python -m nltk.downloader -d /opt/nltk_data wordnet \
    && rm -rf /wheels /tmp/requirements.txt \
    && chown -R lingoroad:lingoroad /opt/nltk_data
COPY --chown=lingoroad:lingoroad lingoroad_ml ./lingoroad_ml
COPY --chown=lingoroad:lingoroad models ./models
USER 10001:10001
EXPOSE 8001
CMD ["uvicorn", "lingoroad_ml.serving.app:app", "--host", "0.0.0.0", "--port", "8001", "--proxy-headers", "--no-server-header"]
