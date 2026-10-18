import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { sendChatMessage } from '../services/chatService';
import { createMessage } from '../utils/messageModel';
import { DEFAULT_SUBJECT } from '../utils/subjects';
import { useUser } from './UserContext';

const CHAT_STORAGE_KEY = 'himi.chat.state';
const ChatContext = createContext(null);

function readStoredChatState() {
  if (typeof window === 'undefined') {
    return null;
  }

  const storedValue = window.localStorage.getItem(CHAT_STORAGE_KEY);

  if (!storedValue) {
    return null;
  }

  try {
    return JSON.parse(storedValue);
  } catch {
    window.localStorage.removeItem(CHAT_STORAGE_KEY);
    return null;
  }
}

function createInitialChatState() {
  return {
    selectedSubject: DEFAULT_SUBJECT,
    messages: []
  };
}

export function ChatProvider({ children }) {
  const { user } = useUser();
  const [state, setState] = useState(createInitialChatState);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const storedState = readStoredChatState();

    if (storedState) {
      setState({
        selectedSubject: storedState.selectedSubject ?? DEFAULT_SUBJECT,
        messages: Array.isArray(storedState.messages) ? storedState.messages : []
      });
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const value = useMemo(() => {
    async function sendMessage(content) {
      const trimmedContent = content.trim();

      if (!trimmedContent || loading) {
        return null;
      }

      const subject = state.selectedSubject;
      const userMessage = createMessage({
        role: 'user',
        content: trimmedContent,
        subject
      });

      setState((currentState) => ({
        ...currentState,
        messages: [...currentState.messages, userMessage]
      }));
      setLoading(true);

      try {
        const response = await sendChatMessage({
          message: trimmedContent,
          subject,
          userName: user?.name ?? 'Student'
        });

        const assistantMessage = createMessage({
          role: 'assistant',
          content: response.response,
          subject
        });

        setState((currentState) => ({
          ...currentState,
          messages: [...currentState.messages, assistantMessage]
        }));

        return assistantMessage;
      } catch {
        const assistantMessage = createMessage({
          role: 'assistant',
          content: "I couldn't process that request. Please try again.",
          subject
        });

        setState((currentState) => ({
          ...currentState,
          messages: [...currentState.messages, assistantMessage]
        }));

        return assistantMessage;
      } finally {
        setLoading(false);
      }
    }

    function setSelectedSubject(subject) {
      setState((currentState) => ({
        ...currentState,
        selectedSubject: subject
      }));
    }

    function clearConversation() {
      const nextState = createInitialChatState();
      setState(nextState);
      window.localStorage.removeItem(CHAT_STORAGE_KEY);
    }

    return {
      messages: state.messages,
      selectedSubject: state.selectedSubject,
      loading,
      sendMessage,
      setSelectedSubject,
      clearConversation
    };
  }, [loading, state.messages, state.selectedSubject, user?.name]);

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const context = useContext(ChatContext);

  if (!context) {
    throw new Error('useChat must be used within ChatProvider');
  }

  return context;
}