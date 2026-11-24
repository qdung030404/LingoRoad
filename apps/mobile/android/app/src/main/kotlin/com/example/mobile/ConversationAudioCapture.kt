package com.example.mobile

import com.cloudwebrtc.webrtc.FlutterWebRTCPlugin
import com.cloudwebrtc.webrtc.audio.LocalAudioTrack
import org.webrtc.AudioTrackSink
import java.io.ByteArrayOutputStream
import java.io.File
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.abs
import kotlin.math.log10

/** Taps the existing microphone track. Remote playback never enters this sink. */
class ConversationAudioCapture(private val cache: File) {
    private var track: LocalAudioTrack? = null
    private val lock = Any()
    private var pcm = ByteArrayOutputStream()
    private data class Span(val itemId: String, val start: Int, val end: Int)
    private val spans = mutableListOf<Span>()
    private var speechItemId: String? = null
    private var speechStart: Int? = null
    private var muted = false
    private var inputStart = 0
    private var inputEnd = 0
    private var peak = 0
    private var phase = 0
    private var sum = 0L
    private var count = 0
    private var invalidFormat = false
    private val sink = AudioTrackSink { data, bits, rate, channels, frames, _ ->
        synchronized(lock) {
            if (bits != 16 || rate < 16000 || channels < 1) {
                invalidFormat = true
            } else if (pcm.size() < 240 * 32000) {
                val input = data.duplicate().order(ByteOrder.LITTLE_ENDIAN)
                repeat(minOf(frames, input.remaining() / (2 * channels))) {
                    var sample = 0L
                    repeat(channels) { sample += input.short.toLong() }
                    sum += if (muted) 0 else sample / channels
                    count++
                    phase += 16000
                    if (phase >= rate) {
                        val output = (sum / count).toInt().coerceIn(-32768, 32767)
                        peak = maxOf(peak, abs(output))
                        pcm.write(output and 255)
                        pcm.write((output shr 8) and 255)
                        phase -= rate
                        sum = 0
                        count = 0
                    }
                }
            }
        }
    }

    fun start(trackId: String, initiallyMuted: Boolean) {
        cancel()
        val local = FlutterWebRTCPlugin.sharedSingleton.getLocalTrack(trackId) as? LocalAudioTrack
            ?: error("Microphone track unavailable")
        track = local
        synchronized(lock) { muted = initiallyMuted }
        local.addSink(sink)
    }

    fun speech(started: Boolean, itemId: String?) = synchronized(lock) {
        if (started && speechStart == null) {
            // VAD can arrive after the learner has already stopped recording.
            if (itemId.isNullOrBlank()) return@synchronized
            val end = if (muted) inputEnd else pcm.size()
            val preRoll = if (muted) inputStart else end - 19200
            val start = maxOf(inputStart, spans.lastOrNull()?.end ?: 0, preRoll)
            if (end <= start) return@synchronized
            speechItemId = itemId
            speechStart = start
        } else if (!started) {
            closeSpan()
        }
    }

    fun mute(value: Boolean) = synchronized(lock) {
        if (muted == value) return@synchronized
        if (value) {
            inputEnd = pcm.size()
            closeSpan()
        } else {
            // Complete any late VAD span before opening the next microphone window.
            closeSpan()
            inputStart = pcm.size()
        }
        peak = 0
        muted = value
    }

    fun amplitudeDb(): Double = synchronized(lock) {
        val level = peak / 32768.0
        peak = 0
        if (level <= 0 || muted) -60.0 else (20 * log10(level)).coerceAtLeast(-60.0)
    }

    private fun closeSpan() {
        val start = speechStart ?: return
        val item = speechItemId ?: return
        speechStart = null
        speechItemId = null
        val end = if (muted) inputEnd else pcm.size()
        if (end <= start) return
        val previous = spans.lastOrNull()
        if (previous != null && previous.itemId == item && start <= previous.end) {
            spans[spans.lastIndex] = Span(item, previous.start, end)
        } else spans.add(Span(item, start, end))
    }

    fun stop(): Map<String, Any>? {
        track?.removeSink(sink)
        track = null
        return synchronized(lock) {
            closeSpan()
            try {
                check(!invalidFormat) { "Unsupported microphone PCM format" }
                val source = pcm.toByteArray()
                val selected = ByteArrayOutputStream()
                val segments = mutableListOf<Map<String, Any>>()
                for ((itemId, start, end) in spans) {
                    // Keep turn boundaries separate without retaining AI response delays.
                    if (selected.size() > 0) selected.write(ByteArray(8000))
                    segments.add(mapOf("itemId" to itemId, "offsetMs" to selected.size() / 32.0,
                        "durationMs" to (end - start) / 32.0))
                    selected.write(source, start, end - start)
                }
                val bytes = selected.toByteArray()
                if (bytes.isEmpty()) return@synchronized null
                check(bytes.size <= 180 * 32000) { "Speech exceeds three minutes" }
                val header = ByteBuffer.allocate(44).order(ByteOrder.LITTLE_ENDIAN)
                header.put("RIFF".toByteArray()).putInt(bytes.size + 36)
                header.put("WAVEfmt ".toByteArray()).putInt(16)
                header.putShort(1).putShort(1).putInt(16000).putInt(32000)
                header.putShort(2).putShort(16).put("data".toByteArray()).putInt(bytes.size)
                val folder = File(cache, "lingoroad-speaking/voice").apply { mkdirs() }
                val file = File.createTempFile("conversation-", ".wav", folder)
                file.outputStream().use { it.write(header.array()); it.write(bytes) }
                mapOf("path" to file.absolutePath, "segments" to segments)
            } finally {
                reset()
            }
        }
    }

    fun cancel() {
        track?.removeSink(sink)
        track = null
        synchronized(lock) { reset() }
    }

    private fun reset() {
        pcm = ByteArrayOutputStream()
        spans.clear()
        speechStart = null
        speechItemId = null
        muted = false
        inputStart = 0
        inputEnd = 0
        peak = 0
        phase = 0
        sum = 0
        count = 0
        invalidFormat = false
    }
}
