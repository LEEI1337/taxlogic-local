/**
 * TaxLogic.local - Interview Page
 *
 * Main tax interview interface with AI-powered conversation.
 */

import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAppStore } from '../stores/appStore';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

function InterviewPage(): React.ReactElement {
  const navigate = useNavigate();
  const { llmStatus, userProfile, setCurrentStep, addNotification } = useAppStore();

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [interviewStarted, setInterviewStarted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const hasActiveLLM = llmStatus.ollama || llmStatus.lmStudio || llmStatus.claude;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (interviewStarted && inputRef.current) {
      inputRef.current.focus();
    }
  }, [interviewStarted, isLoading]);

  const startInterview = async (): Promise<void> => {
    setInterviewStarted(true);
    setIsLoading(true);

    try {
      if (window.electronAPI) {
        const response = await window.electronAPI.interview.start(userProfile);
        setMessages([
          {
            id: '1',
            role: 'assistant',
            content: response,
            timestamp: new Date()
          }
        ]);
      } else {
        // Fallback for development without Electron
        setMessages([
          {
            id: '1',
            role: 'assistant',
            content: `Willkommen, ${userProfile.profession || 'geschatzter Steuerzahler'}! Ich bin Ihr personlicher Steuerberater und werde Ihnen helfen, Ihre Steuererklarung fur das Jahr ${new Date().getFullYear() - 1} zu erstellen.\n\nLassen Sie uns mit einigen Fragen zu Ihrer beruflichen Situation beginnen:\n\n**Wie viele Kilometer pendeln Sie taglich zur Arbeit (einfache Strecke)?**`,
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
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date()
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      if (window.electronAPI) {
        const response = await window.electronAPI.interview.continue(userMessage.content);
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: response,
            timestamp: new Date()
          }
        ]);
      } else {
        // Fallback response for development
        setTimeout(() => {
          setMessages((prev) => [
            ...prev,
            {
              id: (Date.now() + 1).toString(),
              role: 'assistant',
              content: `Danke fur Ihre Antwort: "${userMessage.content}"\n\nIch habe das notiert. Haben Sie im Jahr ${new Date().getFullYear() - 1} ein Home-Office genutzt? Wenn ja, an wie vielen Tagen pro Monat haben Sie von zu Hause gearbeitet?`,
              timestamp: new Date()
            }
          ]);
          setIsLoading(false);
        }, 1500);
        return;
      }
    } catch (error) {
      addNotification('error', 'Fehler bei der Kommunikation mit dem KI-Berater');
      console.error('Message send error:', error);
    } finally {
      setIsLoading(false);
    }
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
              Ich werde Ihnen einige Fragen zu Ihrer finanziellen Situation stellen, um alle moglichen
              Absetzbetraege zu identifizieren. Das Gesprach dauert etwa 10-15 Minuten.
            </p>

            {!hasActiveLLM && (
              <div className="bg-yellow-900/20 border border-yellow-800 rounded-lg p-4 mb-6 text-left">
                <p className="text-yellow-400 text-sm">
                  <strong>Warnung:</strong> Kein KI-Dienst verfugbar. Bitte starten Sie Ollama oder LM Studio
                  fur die beste Erfahrung.
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
            <div className="flex items-center gap-4">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ihre Antwort eingeben..."
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

            {/* Quick actions */}
            <div className="flex items-center justify-between mt-4">
              <div className="flex items-center gap-2 text-sm text-neutral-500">
                <span>{messages.filter((m) => m.role === 'user').length} Antworten</span>
              </div>

              <button onClick={proceedToDocuments} className="btn-ghost text-sm">
                Weiter zu Dokumenten
                <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default InterviewPage;
