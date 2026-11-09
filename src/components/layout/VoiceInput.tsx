import { useEffect, useRef, useState } from 'react';

/**
 * Browser-native voice capture using SpeechRecognition (Chrome/Edge).
 *
 *   - Click the mic button → start listening (pt-BR).
 *   - The transcript is shown live as the user speaks.
 *   - On a final result, `onResult(text)` fires once with the recognised
 *     phrase. The caller passes that to the command parser.
 *   - If the browser doesn't expose SpeechRecognition (Firefox / Safari
 *     on older versions), the button shows a tooltip explaining and
 *     stays disabled.
 */
interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: { results: SpeechRecognitionResults }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionResults {
  length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  0: { transcript: string };
}

type SRConstructor = new () => SpeechRecognitionInstance;

export function VoiceInput({
  onResult,
  onLiveTranscript,
}: {
  onResult: (text: string) => void;
  onLiveTranscript?: (text: string) => void;
}) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const recRef = useRef<SpeechRecognitionInstance | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const w = window as unknown as {
      SpeechRecognition?: SRConstructor;
      webkitSpeechRecognition?: SRConstructor;
    };
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SR) {
      setSupported(false);
      return;
    }
    const rec = new SR();
    rec.lang = 'pt-BR';
    rec.continuous = false;
    rec.interimResults = true;
    rec.onresult = (event) => {
      const results = event.results;
      const last = results[results.length - 1];
      const transcript = last[0].transcript;
      if (last.isFinal) {
        onResult(transcript);
        setListening(false);
      } else if (onLiveTranscript) {
        onLiveTranscript(transcript);
      }
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recRef.current = rec;
    return () => { rec.onresult = null; rec.onerror = null; rec.onend = null; };
  }, [onResult, onLiveTranscript]);

  const toggle = () => {
    if (!recRef.current) return;
    if (listening) {
      try { recRef.current.stop(); } catch { /* ignore */ }
      setListening(false);
    } else {
      try { recRef.current.start(); setListening(true); } catch { /* mic blocked */ }
    }
  };

  return (
    <button
      type="button"
      className={`voice-input${listening ? ' is-listening' : ''}${!supported ? ' is-disabled' : ''}`}
      onClick={toggle}
      disabled={!supported}
      title={
        !supported
          ? 'Reconhecimento de voz não disponível neste navegador'
          : listening
            ? 'Parar (clique ou aguarde a frase terminar)'
            : 'Ditar comando por voz (pt-BR)'
      }
    >
      {listening ? (
        <>
          <span className="voice-input__dot" />
          Ouvindo…
        </>
      ) : (
        <>🎤 Falar</>
      )}
    </button>
  );
}
