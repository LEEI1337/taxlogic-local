/**
 * TaxLogic.local - Interview Page
 *
 * Main tax interview interface with AI-powered conversation.
 * Shows question metadata (helpText, type, validation), progress indicator,
 * and type-specific input controls (boolean buttons, choice options, number input).
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAppStore } from '../stores/appStore';

// ========================================
// Type Definitions
// ========================================

interface InterviewQuestion {
  id: string;
  question: string;
  type: 'text' | 'number' | 'choice' | 'date' | 'boolean';
  options?: string[];
  validation?: {
    type: string;
    min?: number;
    max?: number;
    pattern?: string;
    errorMessage: string;
  };
  helpText?: string;
  required: boolean;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  question?: InterviewQuestion | null;
}

// ========================================
// Response Extraction
// ========================================

/** Extract message string and question metadata from IPC response */
function extractResponse(response: unknown): { message: string; question: InterviewQuestion | null; isComplete: boolean; validationError?: string } {
  if (typeof response === 'string') {
    return { message: response, question: null, isComplete: false };
  }
  if (response && typeof response === 'object') {
    const r = response as Record<string, unknown>;
    const message = typeof r.message === 'string' && r.message
      ? r.message
      : 'Bitte fahren Sie fort.';

    // Extract the question object with full metadata
    let question: InterviewQuestion | null = null;
    if (r.question && typeof r.question === 'object') {
      const q = r.question as Record<string, unknown>;
      question = {
        id: (q.id as string) || '',
        question: (q.question as string) || '',
        type: (q.type as InterviewQuestion['type']) || 'text',
        options: Array.isArray(q.options) ? (q.options as string[]) : undefined,
        validation: q.validation as InterviewQuestion['validation'] | undefined,
        helpText: (q.helpText as string) || undefined,
        required: q.required !== false
      };
    }

    // Also check for nextQuestion (InterviewResponse format)
    if (!question && r.nextQuestion && typeof r.nextQuestion === 'object') {
      const q = r.nextQuestion as Record<string, unknown>;
      question = {
        id: (q.id as string) || '',
        question: (q.question as string) || '',
        type: (q.type as InterviewQuestion['type']) || 'text',
        options: Array.isArray(q.options) ? (q.options as string[]) : undefined,
        validation: q.validation as InterviewQuestion['validation'] | undefined,
        helpText: (q.helpText as string) || undefined,
        required: q.required !== false
      };
    }

    const isComplete = !!(r.isComplete);
    const validationError = typeof r.validationError === 'string' ? r.validationError : undefined;

    return { message, question, isComplete, validationError };
  }
  return { message: 'Bitte fahren Sie fort.', question: null, isComplete: false };
}

// ========================================
// Constants
// ========================================

const TOTAL_QUESTIONS_ESTIMATE = 32;

// ========================================
// Component
// ========================================

function InterviewPage(): React.ReactElement {
  const navigate = useNavigate();
  const { llmStatus, userProfile, setCurrentStep, addNotification } = useAppStore();

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [interviewStarted, setInterviewStarted] = useState(false);
  const [interviewComplete, setInterviewComplete] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<InterviewQuestion | null>(null);
  const [questionCount, setQuestionCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const hasActiveLLM = llmStatus.ollama || llmStatus.lmStudio || llmStatus.claude;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (interviewStarted && !interviewComplete && inputRef.current) {
      inputRef.current.focus();
    }
  }, [interviewStarted, interviewComplete, isLoading]);

  const submitAnswer = useCallback(async (answer: string): Promise<void> => {
    if (!answer.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: answer.trim(),
      timestamp: new Date()
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      if (window.electronAPI) {
        const response = await window.electronAPI.interview.continue(userMessage.content);
        const { message, question, isComplete, validationError } = extractResponse(response);

        if (validationError) {
          addNotification('warning', validationError);
        }

        if (isComplete) {
          setInterviewComplete(true);
          setCurrentQuestion(null);
        } else {
          setCurrentQuestion(question);
          setQuestionCount((prev) => prev + 1);
        }

        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: message,
            timestamp: new Date(),
            question: question
          }
        ]);
      } else {
        // Fallback for development without Electron
        setTimeout(() => {
          setMessages((prev) => [
            ...prev,
            {
              id: (Date.now() + 1).toString(),
              role: 'assistant',
              content: `Danke fuer Ihre Antwort. Naechste Frage folgt...`,
              timestamp: new Date()
            }
          ]);
          setIsLoading(false);
          setQuestionCount((prev) => prev + 1);
        }, 1000);
        return;
      }
    } catch (error) {
      addNotification('error', 'Fehler bei der Kommunikation mit dem KI-Berater');
      console.error('Message send error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, addNotification]);

  const startInterview = async (): Promise<void> => {
    setInterviewStarted(true);
    setIsLoading(true);

    try {
      if (window.electronAPI) {
        const response = await window.electronAPI.interview.start(userProfile);
        const { message, question } = extractResponse(response);

        setCurrentQuestion(question);
        setQuestionCount(1);

        setMessages([
          {
            id: '1',
            role: 'assistant',
            content: message,
            timestamp: new Date(),
            question: question
          }
        ]);
      } else {
        setMessages([
          {
            id: '1',
            role: 'assistant',
            content: 'Willkommen! Lassen Sie uns mit Ihrer Steuererklaerung beginnen.',
            timestamp: new Date()
          }
        ]);
      }
    } catch (error) {
      addNotification('error', 'Fehler beim Starten des Interviews');
      console.error('Interview start error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async (): Promise<void> => {
    await submitAnswer(inputValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const proceedToDocuments = (): void => {
    setCurrentStep('documents');
    navigate('/documents');
  };

  // Calculate progress percentage
  const progressPercent = Math.min((questionCount / TOTAL_QUESTIONS_ESTIMATE) * 100, 100);

  return (
    <div className="h-full flex flex-col">
      {!interviewStarted ? (
        // Welcome screen before interview starts
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-lg">
            <div className="w-20 h-20 rounded-full bg-accent-500/20 flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-accent-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
            </div>

            <h2 className="text-2xl font-bold text-white mb-4">Steuer-Interview</h2>
            <p className="text-neutral-400 mb-8 leading-relaxed">
              Ich werde Ihnen einige Fragen zu Ihrer finanziellen Situation stellen, um alle moeglichen
              Absetzbetraege zu identifizieren. Das Gespraech dauert etwa 10-15 Minuten.
            </p>

            {!hasActiveLLM && (
              <div className="bg-yellow-900/20 border border-yellow-800 rounded-lg p-4 mb-6 text-left">
                <p className="text-yellow-400 text-sm">
                  <strong>Warnung:</strong> Kein KI-Dienst verfuegbar. Bitte starten Sie Ollama oder LM Studio
                  fuer die beste Erfahrung.
                </p>
              </div>
            )}

            <button onClick={startInterview} className="btn-primary px-8 py-3" disabled={isLoading}>
              Interview starten
            </button>
          </div>
        </div>
      ) : (
        // Interview chat interface
        <>
          {/* Progress bar */}
          <div className="px-4 py-3 border-b border-neutral-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-neutral-400">
                {interviewComplete
                  ? 'Interview abgeschlossen'
                  : `Frage ${questionCount} von ca. ${TOTAL_QUESTIONS_ESTIMATE}`}
              </span>
              {interviewComplete && (
                <span className="text-sm text-green-400 font-medium">Fertig!</span>
              )}
            </div>
            <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  interviewComplete ? 'bg-green-500' : 'bg-accent-500'
                }`}
                style={{ width: `${interviewComplete ? 100 : progressPercent}%` }}
              />
            </div>
          </div>

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[75%] ${
                    message.role === 'user' ? 'chat-message-user' : 'chat-message-assistant'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{message.content}</div>

                  {/* Help text for assistant messages with questions */}
                  {message.role === 'assistant' && message.question?.helpText && (
                    <div className="mt-3 text-xs text-neutral-400 bg-neutral-800/50 rounded-lg px-3 py-2 border border-neutral-700/50">
                      <span className="text-accent-400 font-medium">Hinweis: </span>
                      {message.question.helpText}
                    </div>
                  )}

                  {/* Validation info */}
                  {message.role === 'assistant' && message.question?.validation && (
                    <div className="mt-2 text-xs text-neutral-500">
                      {message.question.validation.type === 'range' && (
                        <span>
                          Wertebereich: {message.question.validation.min ?? '–'} bis {message.question.validation.max ?? '–'}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Required indicator */}
                  {message.role === 'assistant' && message.question && (
                    <div className="mt-1 text-xs text-neutral-600">
                      {message.question.required ? 'Pflichtfrage' : 'Optional'}
                      {message.question.type !== 'text' && (
                        <span className="ml-2">
                          ({message.question.type === 'boolean' ? 'Ja/Nein'
                            : message.question.type === 'choice' ? 'Auswahl'
                            : message.question.type === 'number' ? 'Zahl'
                            : message.question.type === 'date' ? 'Datum'
                            : message.question.type})
                        </span>
                      )}
                    </div>
                  )}

                  <div
                    className={`text-xs mt-2 ${
                      message.role === 'user' ? 'text-accent-200' : 'text-neutral-500'
                    }`}
                  >
                    {message.timestamp.toLocaleTimeString('de-AT', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="chat-message-assistant">
                  <div className="flex items-center gap-2">
                    <div className="spinner" />
                    <span className="text-neutral-400">Denke nach...</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="border-t border-neutral-800 p-4">
            {interviewComplete ? (
              /* Completion state - prominent CTA */
              <div className="text-center py-4">
                <div className="flex items-center justify-center gap-2 text-green-400 mb-4">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-lg font-medium">Interview abgeschlossen!</span>
                </div>
                <p className="text-sm text-neutral-400 mb-4">
                  Alle Fragen wurden beantwortet. Fahren Sie mit dem Hochladen Ihrer Belege fort.
                </p>
                <button onClick={proceedToDocuments} className="btn-primary px-8 py-3">
                  Weiter zu Dokumenten
                  <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            ) : currentQuestion?.type === 'boolean' && !isLoading ? (
              /* Boolean question - Ja/Nein buttons */
              <div className="flex items-center gap-3">
                <button
                  onClick={() => submitAnswer('Ja')}
                  className="btn-primary flex-1 py-3"
                  disabled={isLoading}
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Ja
                </button>
                <button
                  onClick={() => submitAnswer('Nein')}
                  className="btn-secondary flex-1 py-3"
                  disabled={isLoading}
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Nein
                </button>
              </div>
            ) : currentQuestion?.type === 'choice' && currentQuestion.options && !isLoading ? (
              /* Choice question - option buttons */
              <div className="space-y-2">
                <p className="text-xs text-neutral-500 mb-2">Waehlen Sie eine Option:</p>
                <div className="grid gap-2" style={{ gridTemplateColumns: currentQuestion.options.length <= 3 ? `repeat(${currentQuestion.options.length}, 1fr)` : 'repeat(2, 1fr)' }}>
                  {currentQuestion.options.map((option, idx) => (
                    <button
                      key={idx}
                      onClick={() => submitAnswer(option)}
                      className="btn-secondary py-3 text-sm text-left px-4"
                      disabled={isLoading}
                    >
                      <span className="text-accent-400 font-mono mr-2">{idx + 1}.</span>
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* Default text/number/date input */
              <div>
                <div className="flex items-center gap-4">
                  <input
                    ref={inputRef}
                    type={currentQuestion?.type === 'number' ? 'number' : 'text'}
                    min={currentQuestion?.validation?.min}
                    max={currentQuestion?.validation?.max}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={
                      currentQuestion?.type === 'number'
                        ? 'Zahl eingeben...'
                        : currentQuestion?.type === 'date'
                        ? 'Datum eingeben (TT.MM.JJJJ)...'
                        : 'Ihre Antwort eingeben...'
                    }
                    className="input flex-1"
                    disabled={isLoading}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!inputValue.trim() || isLoading}
                    className="btn-primary px-6"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            )}

            {/* Quick actions (when not complete) */}
            {!interviewComplete && (
              <div className="flex items-center justify-between mt-4">
                <div className="flex items-center gap-2 text-sm text-neutral-500">
                  <span>{messages.filter((m) => m.role === 'user').length} Antworten</span>
                </div>

                <button onClick={proceedToDocuments} className="btn-ghost text-sm">
                  Ueberspringen
                  <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default InterviewPage;
