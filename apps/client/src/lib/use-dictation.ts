import { useRef, useState } from 'react';

interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: (event: {
    resultIndex: number;
    results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
  }) => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
}

type RecognitionCtor = new () => Recognition;

const Speech =
  (window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor })
    .SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: RecognitionCtor }).webkitSpeechRecognition;

/** Voice dictation (Web Speech API) behind the WhatsApp mic button; appends final phrases. */
export function useDictation(language: string, onText: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const recognition = useRef<Recognition | null>(null);

  const toggle = () => {
    if (!Speech) return;
    if (recognition.current) {
      recognition.current.stop();
      return;
    }
    const instance = new Speech();
    instance.lang = language;
    instance.interimResults = false;
    instance.continuous = true;
    instance.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) onText(event.results[i][0].transcript.trim());
      }
    };
    instance.onend = () => {
      recognition.current = null;
      setListening(false);
    };
    recognition.current = instance;
    instance.start();
    setListening(true);
  };

  return { supported: !!Speech, listening, toggle };
}
