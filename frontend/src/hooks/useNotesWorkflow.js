import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { getApiErrorMessage, isRequestCancelled } from '../services/apiClient';
import { extractPdfText, summarizeNotes } from '../services/notesService';
import { InvalidNotesResponseError, looksLikePdfContent, validatePdfFile } from '../utils/notes';
import { initialNotesState, notesReducer } from '../utils/notesFlow';

const messageFor = (error, fallback) =>
  error instanceof InvalidNotesResponseError ? error.message : getApiErrorMessage(error, fallback);

/**
 * Drives the notes screen: upload -> read text -> (student chooses) summarise.
 *
 * - The AI is only contacted by `summarize`, which the student triggers explicitly.
 * - Each step has a request id; answers for cancelled or replaced requests are ignored.
 * - In-flight requests are aborted when the screen is left.
 */
export function useNotesWorkflow() {
  const [state, dispatch] = useReducer(notesReducer, initialNotesState);
  const [pickError, setPickError] = useState(null);
  const controllerRef = useRef(null);
  const fileRef = useRef(null);
  const idRef = useRef(0);

  const abortInFlight = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
  }, []);

  useEffect(() => abortInFlight, [abortInFlight]);

  const nextRequest = useCallback(() => {
    abortInFlight();
    idRef.current += 1;
    const controller = new AbortController();
    controllerRef.current = controller;
    return { id: idRef.current, controller };
  }, [abortInFlight]);

  const upload = useCallback(
    async (file) => {
      const check = validatePdfFile(file);

      if (!check.ok) {
        setPickError(check.error);
        return;
      }

      setPickError(null);
      fileRef.current = file;
      const { id, controller } = nextRequest();
      dispatch({ type: 'extractStarted', requestId: id, file });

      if (!(await looksLikePdfContent(file))) {
        if (id === idRef.current) {
          dispatch({
            type: 'extractFailed',
            requestId: id,
            message: 'This file does not look like a real PDF, even though it is named like one.'
          });
        }
        return;
      }

      try {
        const extraction = await extractPdfText(file, { signal: controller.signal });
        dispatch({ type: 'extractSucceeded', requestId: id, extraction });
      } catch (error) {
        if (isRequestCancelled(error)) {
          return;
        }
        dispatch({
          type: 'extractFailed',
          requestId: id,
          message: messageFor(error, 'Could not read this PDF. Please try again.')
        });
      }
    },
    [nextRequest]
  );

  const retryUpload = useCallback(() => {
    if (fileRef.current) {
      upload(fileRef.current);
    }
  }, [upload]);

  const summarize = useCallback(
    async (extraction, title) => {
      if (!extraction) {
        return;
      }

      const { id, controller } = nextRequest();
      dispatch({ type: 'summarizeStarted', requestId: id });

      try {
        const result = await summarizeNotes({ text: extraction.text, title }, { signal: controller.signal });
        dispatch({ type: 'summarizeSucceeded', requestId: id, result });
      } catch (error) {
        if (isRequestCancelled(error)) {
          return;
        }
        dispatch({
          type: 'summarizeFailed',
          requestId: id,
          message: messageFor(error, 'HIMI could not summarise these notes. Please try again.')
        });
      }
    },
    [nextRequest]
  );

  const cancel = useCallback(() => {
    abortInFlight();
    idRef.current += 1;
    dispatch({ type: 'cancel', requestId: idRef.current });
  }, [abortInFlight]);

  const reset = useCallback(() => {
    abortInFlight();
    idRef.current += 1;
    fileRef.current = null;
    setPickError(null);
    dispatch({ type: 'reset', requestId: idRef.current });
  }, [abortInFlight]);

  return { state, pickError, setPickError, upload, retryUpload, summarize, cancel, reset };
}
