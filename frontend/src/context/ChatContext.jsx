import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { sendChatMessage } from '../services/chatService';
import { createMessage, sanitizeMessages } from '../utils/messageModel';
import { DEFAULT_SUBJECT, SUBJECTS } from '../utils/subjects';
import { useToast } from './ToastContext';
import { useUser } from './UserContext';

const CHAT_STORAGE_KEY = 'himi.chat.state';
export const CHAT_ERROR_MESSAGE = "I couldn't process that request. Please try again.";

const ChatContext = createContext(null);

function createInitialChatState() {
  return { selectedSubject: DEFAULT_SUBJECT, messages: [] };
}

function readInitialChatState() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(CHAT_STORAGE_KEY));

    if (!stored) {
      return createInitialChatState();
    }

    return {
      selectedSubject: SUBJECTS.includes(stored.selectedSubject) ? stored.selectedSubject : DEFAULT_SUBJECT,
      messages: sanitizeMessages(stored.messages)
    };
  } catch {
    window.localStorage.removeItem(CHAT_STORAGE_KEY);
    return createInitialChatState();
  }
}

export function ChatProvider({ children }) {
  const { user } = useUser();
  const toast = useToast();
  const [state, setState] = useState(readInitialChatState);
  const [loading, setLoading] = useState(false);
  const inFlightRef = useRef(false);
  const userName = user?.name ?? 'Student';

  useEffect(() => {
    window.localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const appendMessage = useCallback((message) => {
    setState((current) => ({ ...current, messages: [...current.messages, message] }));
  }, []);

  /**
   * Ask the backend for a reply. Any failure (network, HTTP or a non-success payload status)
   * becomes a friendly error message in the conversation plus a toast.
   */
  const requestReply = useCallback(
    async (content, subject) => {
      inFlightRef.current = true;
      setLoading(true);

      try {
        const data = await sendChatMessage({ message: content, subject, userName });

        if (data?.status !== 'success' || !data.response) {
          throw new Error('The AI service did not return a successful response.');
        }

        appendMessage(createMessage({ role: 'assistant', content: data.response, subject }));
      } catch {
        appendMessage(createMessage({ role: 'assistant', content: CHAT_ERROR_MESSAGE, subject, error: true }));
        toast.error('Message failed', 'HIMI could not get a reply right now. You can retry the message.');
      } finally {
        inFlightRef.current = false;
        setLoading(false);
      }
    },
    [appendMessage, toast, userName]
  );

  const sendMessage = useCallback(
    async (content) => {
      const trimmed = content.trim();

      if (!trimmed || inFlightRef.current) {
        return false;
      }

      const subject = state.selectedSubject;
      appendMessage(createMessage({ role: 'user', content: trimmed, subject }));
      await requestReply(trimmed, subject);
      return true;
    },
    [appendMessage, requestReply, state.selectedSubject]
  );

  /** Re-send the question that preceded a failed assistant message. */
  const retryMessage = useCallback(
    async (errorMessageId) => {
      if (inFlightRef.current) {
        return;
      }

      const errorIndex = state.messages.findIndex((message) => message.id === errorMessageId);
      const question = state.messages
        .slice(0, Math.max(errorIndex, 0))
        .reverse()
        .find((message) => message.role === 'user');

      if (!question) {
        return;
      }

      setState((current) => ({
        ...current,
        messages: current.messages.filter((message) => message.id !== errorMessageId)
      }));
      await requestReply(question.content, question.subject);
    },
    [requestReply, state.messages]
  );

  const setSelectedSubject = useCallback((subject) => {
    if (SUBJECTS.includes(subject)) {
      setState((current) => ({ ...current, selectedSubject: subject }));
    }
  }, []);

  const clearConversation = useCallback(() => {
    setState(createInitialChatState());
    window.localStorage.removeItem(CHAT_STORAGE_KEY);
  }, []);

  const value = useMemo(
    () => ({
      messages: state.messages,
      selectedSubject: state.selectedSubject,
      loading,
      sendMessage,
      retryMessage,
      setSelectedSubject,
      clearConversation
    }),
    [clearConversation, loading, retryMessage, sendMessage, setSelectedSubject, state.messages, state.selectedSubject]
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const context = useContext(ChatContext);

  if (!context) {
    throw new Error('useChat must be used within ChatProvider');
  }

  return context;
}
