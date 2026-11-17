'use client';
// Development-only test call: talks to the AI voice agent from this browser's microphone over LiveKit. It is not a
// phone call and dials nothing. POST /api/voice/sessions creates the LiveKit room, dispatches the voice worker
// and returns a short-lived join token; livekit-client is loaded only when a call starts.
import { Headphones, Mic, MicOff, Phone, PhoneOff } from 'lucide-react';
import type { LocalAudioTrack, Room } from 'livekit-client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Badge, Banner, Button, Card, Field, Input, KeyValue, PageHeader, Select } from '@/components/ui';
import { api } from '@/lib/api';
import { languageName } from '@/lib/format';
import { LANGUAGES, type VoiceSession } from '@/lib/types';
import { useSession } from '@/lib/use-api';
import { disconnectMessage, microphoneUnavailable, voiceCallError } from '@/lib/voice-call';

type CallStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
const STATUS: Record<CallStatus, { label: string; tone: 'slate' | 'amber' | 'green' | 'red' }> = {
  disconnected: { label: 'Disconnected', tone: 'slate' },
  connecting: { label: 'Connecting', tone: 'amber' },
  connected: { label: 'Connected', tone: 'green' },
  error: { label: 'Error', tone: 'red' },
};

export default function TestVoiceCallPage() {
  // The API refuses every role but admin (403); the page says so instead of offering a call that would fail.
  const role = useSession().user?.role;
  const [form, setForm] = useState({ fromNumber: '', language: '' });
  const [status, setStatus] = useState<CallStatus>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [agentJoined, setAgentJoined] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [roomName, setRoomName] = useState<string | null>(null);

  const roomRef = useRef<Room | null>(null);
  const micRef = useRef<LocalAudioTrack | null>(null);
  const audioBoxRef = useRef<HTMLDivElement>(null);
  // Bumped by End Call and on leaving the page, so a call that is still connecting stops at its next step.
  const attemptRef = useRef(0);

  /** Stops the microphone, leaves the room and removes the agent's audio elements. Safe to call twice. */
  async function teardown(): Promise<void> {
    const room = roomRef.current;
    const mic = micRef.current;
    roomRef.current = null;
    micRef.current = null;
    mic?.stop();
    await room?.disconnect(true).catch(() => undefined);
    audioBoxRef.current?.replaceChildren();
    setAgentJoined(false);
    setMuted(false);
    setAudioBlocked(false);
  }

  // Leaving the page ends the call.
  useEffect(
    () => () => {
      attemptRef.current++;
      void teardown();
    },
    [],
  );

  async function start(): Promise<void> {
    setError(null);
    setNote(null);
    const unavailable = microphoneUnavailable();
    if (unavailable) {
      setStatus('error');
      setError(unavailable);
      return;
    }
    const attempt = ++attemptRef.current;
    const stale = () => attempt !== attemptRef.current;
    setStatus('connecting');
    try {
      const lk = await import('livekit-client');
      // Microphone permission first: if it is refused, no room is created and no agent is dispatched.
      const mic = await lk.createLocalAudioTrack({ echoCancellation: true, noiseSuppression: true, autoGainControl: true });
      if (stale()) return void mic.stop();
      micRef.current = mic;

      const session = await api<VoiceSession>('/api/voice/sessions', {
        method: 'POST',
        body: { fromNumber: form.fromNumber.trim(), ...(form.language ? { language: form.language } : {}) },
      });
      if (stale()) return void mic.stop();

      const room = new lk.Room();
      roomRef.current = room;
      room
        // The room has two seats, so the only remote participant is the voice agent.
        .on(lk.RoomEvent.ParticipantConnected, () => setAgentJoined(true))
        .on(lk.RoomEvent.ParticipantDisconnected, () => {
          setAgentJoined(false);
          setNote('The voice agent left the call.');
        })
        .on(lk.RoomEvent.TrackSubscribed, (track) => {
          if (track.kind !== lk.Track.Kind.Audio) return;
          setAgentJoined(true);
          audioBoxRef.current?.appendChild(track.attach());
        })
        .on(lk.RoomEvent.TrackUnsubscribed, (track) => track.detach().forEach((el) => el.remove()))
        .on(lk.RoomEvent.AudioPlaybackStatusChanged, () => setAudioBlocked(!room.canPlaybackAudio))
        .on(lk.RoomEvent.MediaDevicesError, (err) => setError(voiceCallError(err)))
        .on(lk.RoomEvent.Reconnecting, () => setStatus('connecting'))
        .on(lk.RoomEvent.Reconnected, () => setStatus('connected'))
        .on(lk.RoomEvent.Disconnected, (reason) => {
          if (roomRef.current !== room) return; // already torn down by End Call
          void teardown();
          setStatus('disconnected');
          setNote(disconnectMessage(reason === undefined ? undefined : lk.DisconnectReason[reason]));
        });

      await room.connect(session.serverUrl, session.participantToken);
      if (stale()) return void teardown();
      await room.localParticipant.publishTrack(mic, { source: lk.Track.Source.Microphone });
      if (stale()) return void teardown();
      setRoomName(session.roomName);
      setAgentJoined(room.remoteParticipants.size > 0);
      setAudioBlocked(!room.canPlaybackAudio);
      setStatus('connected');
    } catch (err) {
      if (stale()) return;
      await teardown();
      setStatus('error');
      setError(voiceCallError(err));
    }
  }

  async function end(): Promise<void> {
    attemptRef.current++;
    await teardown();
    setStatus('disconnected');
  }

  async function toggleMute(): Promise<void> {
    const mic = micRef.current;
    if (!mic) return;
    // Mute keeps the track published (the agent listens to this one track) and only stops sending audio.
    if (muted) await mic.unmute();
    else await mic.mute();
    setMuted(!muted);
  }

  async function enableAudio(): Promise<void> {
    const room = roomRef.current;
    if (!room) return;
    await room.startAudio().catch(() => undefined);
    setAudioBlocked(!room.canPlaybackAudio);
  }

  const inCall = status === 'connecting' || status === 'connected';
  const badge = STATUS[status];

  if (role && role !== 'admin') {
    return (
      <>
        <PageHeader title="Test Voice Call" description="Talk to the AI voice agent from this browser's microphone over LiveKit." />
        <Banner tone="blue">Test voice calls are limited to admins: each one is placed as a customer phone number and records a real draft order.</Banner>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Test Voice Call"
        description="Talk to the AI voice agent from this browser's microphone over LiveKit. Admins only."
        actions={<Badge tone={badge.tone}>{badge.label}</Badge>}
      />
      <div className="space-y-4">
        <Banner>
          <strong>Test call, not a phone call.</strong> No number is dialled: your microphone talks to the voice agent through LiveKit. The agent runs the
          real conversation engine, so the call, any order and its stock reservation are recorded in the database the API uses, marked as a test call. Orders still
          need customer confirmation, stock reservation and staff approval.
        </Banner>

        <Card title="Call">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Call as customer phone number" hint="The agent identifies the customer by this number, as caller ID would on a phone line.">
              <Input
                type="tel"
                inputMode="tel"
                autoComplete="off"
                placeholder="+91XXXXXXXXXX"
                value={form.fromNumber}
                disabled={inCall}
                onChange={(e) => setForm({ ...form, fromNumber: e.target.value })}
              />
            </Field>
            <Field label="Language" hint="Optional; otherwise the customer's preferred language.">
              <Select
                value={form.language}
                disabled={inCall}
                onChange={(e) => setForm({ ...form, language: e.target.value })}
                placeholder="Default"
                options={LANGUAGES.map((l) => ({ value: l, label: languageName(l) }))}
              />
            </Field>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => void start()} loading={status === 'connecting'} disabled={inCall || !form.fromNumber.trim()}>
              <Phone className="h-4 w-4" aria-hidden /> Start Call
            </Button>
            <Button onClick={() => void toggleMute()} disabled={status !== 'connected'} aria-pressed={muted}>
              {muted ? <MicOff className="h-4 w-4" aria-hidden /> : <Mic className="h-4 w-4" aria-hidden />} {muted ? 'Unmute' : 'Mute'}
            </Button>
            <Button variant="danger" onClick={() => void end()} disabled={!inCall}>
              <PhoneOff className="h-4 w-4" aria-hidden /> End Call
            </Button>
          </div>
        </Card>

        {error && <Banner tone="red">{error}</Banner>}
        {note && !error && <Banner tone="blue">{note}</Banner>}
        {audioBlocked && (
          <Banner tone="blue">
            The browser blocked the agent&apos;s audio until you interact with the page.{' '}
            <Button size="sm" onClick={() => void enableAudio()}>
              <Headphones className="h-4 w-4" aria-hidden /> Enable audio
            </Button>
          </Banner>
        )}

        <Card title="Status">
          <KeyValue
            items={[
              ['Connection', <Badge key="c" tone={badge.tone}>{badge.label}</Badge>],
              ['Voice agent', status === 'connected' ? (agentJoined ? 'In the call' : 'Waiting to join…') : '—'],
              ['Microphone', status === 'connected' ? (muted ? 'Muted' : 'On') : '—'],
              ['Room', roomName ?? '—'],
            ]}
          />
          <p className="mt-3 text-xs text-slate-500">
            The session appears under <Link className="text-blue-700 hover:underline" href="/dashboard/live-calls">Live Calls</Link> while it runs and in{' '}
            <Link className="text-blue-700 hover:underline" href="/dashboard/calls">Call History</Link> afterwards.
          </p>
        </Card>
        {/* The agent's audio elements are attached here; they play without visible controls. */}
        <div ref={audioBoxRef} hidden />
      </div>
    </>
  );
}
