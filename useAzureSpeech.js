import { useState, useRef } from 'react';
import * as sdk from 'microsoft-cognitiveservices-speech-sdk';

export const useAzureSpeech = (onFinalTranscript) => {
  const [transcript, setTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const recognizerRef = useRef(null);

  const speechConfig = sdk.SpeechConfig.fromSubscription(
    import.meta.env.VITE_AZURE_SPEECH_KEY,
    import.meta.env.VITE_AZURE_SPEECH_REGION
  );
  speechConfig.speechRecognitionLanguage = 'en-US';

  const startListening = () => {
    if (isListening) return;
    setIsListening(true);

    const audioConfig = sdk.AudioConfig.fromDefaultMicrophoneInput();
    const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);
    recognizerRef.current = recognizer;

    recognizer.recognizing = (_, e) => {
      setTranscript(e.result.text);
    };

    recognizer.recognized = (_, e) => {
      if (e.result.reason === sdk.ResultReason.RecognizedSpeech) {
        setTranscript(e.result.text);
        if (onFinalTranscript) onFinalTranscript(e.result.text);
      }
    };

    recognizer.startContinuousRecognitionAsync();
  };

  const stopListening = () => {
    setIsListening(false);
    recognizerRef.current?.stopContinuousRecognitionAsync();
  };

  return { transcript, isListening, startListening, stopListening };
};
