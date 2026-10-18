import { useCallback, useEffect, useMemo, useState } from 'react';
import { COMPANION_SPEECH_PREFIX, companionSpeechId, useCompanion, useRobotState } from '../context/CompanionContext';
import { MAX_MESSAGE_CHARS } from '../utils/tutor';
import { voiceInputLanguageFor } from '../utils/voice';
import { useAutoRead } from './useAutoRead';
import { useAutoResizeTextarea } from './useAutoResizeTextarea';
import { usePreferences } from './usePreferences';
import { useSpeechInput } from './useSpeechInput';
import { useSpeechOutput, useStopSpeechOnLeave } from './useSpeechOutput';

/**
 * Reads new companion answers aloud (only when the student turned on "Read replies aloud") and stops all
 * speech when the companion goes away or the conversation restarts. Mounted by whichever view shows the
 * companion (the dock or the dashboard stage), never by both, so a reply is never read twice.
 */
export function useCompanionSpeech() {
  const { entries, epoch } = useCompanion();
  const { preferences } = usePreferences();
  const replies = useMemo(
    () => entries.filter((entry) => entry.kind === 'answer').map((entry) => ({ id: companionSpeechId(entry.id), text: entry.text })),
    [entries]
  );

  useStopSpeechOnLeave(epoch);
  useAutoRead({ ownerKey: epoch, replies, voiceEnabled: preferences.voiceEnabled, autoReadReplies: preferences.autoReadReplies });
}

/**
 * Everything a companion view needs besides the shared conversation: the microphone, the composer and the
 * playback controls. The microphone is only requested from the Start button inside the voice panel, which
 * the student has to open first, so nothing listens when a page simply opens.
 */
export function useCompanionView() {
  const companion = useCompanion();
  const { preferences, update } = usePreferences();
  const output = useSpeechOutput();
  const [voiceOpen, setVoiceOpen] = useState(false);
  const textareaRef = useAutoResizeTextarea(companion.draft, 144);

  const { appendToDraft, focusNonce, setDraft, draft, send, status, explanationLanguage } = companion;

  const voice = useSpeechInput({ resetKey: companion.epoch, onTranscript: appendToDraft });
  const listening = voice.status === 'listening';
  const robotState = useRobotState({ listening });
  const speaking = typeof output.speakingId === 'string' && output.speakingId.startsWith(COMPANION_SPEECH_PREFIX);
  const voiceAllowed = preferences.voiceEnabled;
  const showVoice = voiceAllowed && voiceOpen;
  const thinking = status === 'thinking';
  const canSend = draft.trim().length > 0 && !thinking;

  // "Ask HIMI" buttons on other pages put text in the box and ask for focus.
  useEffect(() => {
    if (focusNonce > 0) {
      textareaRef.current?.focus();
    }
  }, [focusNonce, textareaRef]);

  const toggleVoice = useCallback(() => {
    if (voiceOpen) {
      voice.cancel();
    } else {
      // Dictate in the language HIMI is explaining in; the panel still lets the student change it.
      voice.setLanguage(voiceInputLanguageFor(explanationLanguage));
      // The microphone must not hear HIMI's own voice.
      output.stop();
    }

    setVoiceOpen(!voiceOpen);
  }, [explanationLanguage, output, voice, voiceOpen]);

  const closeVoice = useCallback(() => {
    voice.cancel();
    setVoiceOpen(false);
  }, [voice]);

  const submit = useCallback(async () => {
    const text = draft;

    if (!text.trim() || thinking) {
      return { started: false, reason: 'busy' };
    }

    voice.cancel();
    setDraft('');
    const result = await send(text);

    // Only a message that was never sent comes back. A "busy" duplicate must not put the text back, because the
    // first send already took it.
    if (!result.started && result.reason === 'too-long') {
      setDraft(text);
    }

    return result;
  }, [draft, send, setDraft, thinking, voice]);

  const onKeyDown = useCallback(
    (event) => {
      // Enter sends, Shift+Enter adds a line, and a key pressed while composing (IME) is not a send.
      if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent?.isComposing) {
        event.preventDefault();
        submit();
      }
    },
    [submit]
  );

  const toggleReadAloud = useCallback(() => {
    update({ autoReadReplies: !preferences.autoReadReplies });
  }, [preferences.autoReadReplies, update]);

  // The textarea ref travels separately: lint (rightly) refuses to let a ref ride inside an object read during render.
  const view = {
    ...companion,
    maxLength: MAX_MESSAGE_CHARS,
    voice,
    voiceAllowed,
    showVoice,
    toggleVoice,
    closeVoice,
    listening,
    robotState,
    speaking,
    speechSupported: output.supported,
    stopSpeaking: output.stop,
    autoRead: preferences.autoReadReplies,
    toggleReadAloud,
    thinking,
    canSend,
    submit,
    onKeyDown
  };

  return { view, textareaRef };
}
