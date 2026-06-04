import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface VoiceSearchProps {
  onResult: (text: string) => void;
  onSearch?: (text: string) => void;
}

export function VoiceSearch({ onResult, onSearch }: VoiceSearchProps) {
  const { t, i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true);

  useEffect(() => {
    // Check for browser support
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSupported(false);
    }
  }, []);

  const startListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError(t('voice.notSupported', 'Spraakherkenning wordt niet ondersteund in deze browser'));
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = i18n.language === 'nl' ? 'nl-NL' : 'en-US';
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
      setTranscript('');
    };

    recognition.onresult = (event: any) => {
      const current = event.resultIndex;
      const transcriptText = event.results[current][0].transcript;
      setTranscript(transcriptText);

      if (event.results[current].isFinal) {
        onResult(transcriptText);
        if (onSearch) {
          setTimeout(() => {
            onSearch(transcriptText);
            setIsOpen(false);
          }, 500);
        }
      }
    };

    recognition.onerror = (event: any) => {
      setIsListening(false);
      if (event.error === 'not-allowed') {
        setError(t('voice.permissionDenied', 'Microfoon toegang geweigerd'));
      } else if (event.error === 'no-speech') {
        setError(t('voice.noSpeech', 'Geen spraak gedetecteerd'));
      } else {
        setError(t('voice.error', 'Er ging iets mis'));
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();

    // Store recognition instance for cleanup
    (window as any).currentRecognition = recognition;
  }, [i18n.language, onResult, onSearch, t]);

  const stopListening = () => {
    if ((window as any).currentRecognition) {
      (window as any).currentRecognition.stop();
    }
    setIsListening(false);
  };

  const handleOpen = () => {
    setIsOpen(true);
    setTranscript('');
    setError(null);
    setTimeout(startListening, 300);
  };

  if (!isSupported) {
    return null;
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleOpen}
        className="rounded-full hover:bg-primary/10 text-muted-foreground hover:text-primary"
        title={t('voice.start', 'Spraak zoeken')}
      >
        <Mic className="h-5 w-5" />
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">
              {t('voice.title', 'Spraak zoeken')}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col items-center py-8 space-y-6">
            <motion.div
              animate={isListening ? { scale: [1, 1.1, 1] } : {}}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="relative"
            >
              <Button
                size="lg"
                variant={isListening ? 'destructive' : 'default'}
                className="h-20 w-20 rounded-full"
                onClick={isListening ? stopListening : startListening}
              >
                {isListening ? (
                  <MicOff className="h-8 w-8" />
                ) : (
                  <Mic className="h-8 w-8" />
                )}
              </Button>

              {isListening && (
                <>
                  <motion.div
                    className="absolute inset-0 rounded-full border-2 border-primary"
                    animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                  />
                  <motion.div
                    className="absolute inset-0 rounded-full border-2 border-primary"
                    animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                    transition={{ repeat: Infinity, duration: 1.5, delay: 0.5 }}
                  />
                </>
              )}
            </motion.div>

            <div className="text-center min-h-[60px] w-full px-4">
              <AnimatePresence mode="wait">
                {isListening && !transcript && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-muted-foreground flex items-center justify-center gap-2"
                  >
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('voice.listening', 'Luisteren...')}
                  </motion.p>
                )}

                {transcript && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="space-y-2"
                  >
                    <p className="text-lg font-medium">"{transcript}"</p>
                    <p className="text-sm text-muted-foreground">
                      {t('voice.searching', 'Zoeken naar restaurants...')}
                    </p>
                  </motion.div>
                )}

                {error && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-destructive"
                  >
                    {error}
                  </motion.p>
                )}

                {!isListening && !transcript && !error && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-muted-foreground"
                  >
                    {t('voice.hint', 'Zeg iets als "Waar kan ik de beste ramen eten?"')}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
