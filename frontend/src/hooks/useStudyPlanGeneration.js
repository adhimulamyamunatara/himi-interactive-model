import { useCallback, useEffect, useRef, useState } from 'react';
import { getApiErrorMessage, isRequestCancelled } from '../services/apiClient';
import { generateStudyPlan } from '../services/studyPlannerService';
import { getTodayString, validateConfig } from '../utils/studyPlanner';

const GENERATION_ERROR = "HIMI couldn't build a study plan right now. Please try again.";

/**
 * Runs one plan-generation request at a time.
 *
 * - Duplicate submissions are ignored while a request is running.
 * - The request can be cancelled, and is aborted if the student leaves the page.
 * - A late response from a cancelled request can never overwrite newer state.
 * - It only reports a result. Saving is the caller's job, so a failure never touches saved plans.
 */
export function useStudyPlanGeneration() {
  const [state, setState] = useState({ status: 'idle', error: null });
  const inFlightRef = useRef(false);
  const requestIdRef = useRef(0);
  const controllerRef = useRef(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  /**
   * @returns {Promise<object | null>} the validated plan, or null when it failed, was cancelled or was ignored.
   */
  const generate = useCallback(async (config) => {
    const today = getTodayString();

    if (inFlightRef.current || Object.keys(validateConfig(config, today)).length > 0) {
      return null;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    inFlightRef.current = true;

    const controller = new AbortController();
    controllerRef.current = controller;
    setState({ status: 'generating', error: null });

    try {
      const plan = await generateStudyPlan(config, today, { signal: controller.signal });

      if (controller.signal.aborted) {
        return null;
      }

      setState({ status: 'idle', error: null });
      return plan;
    } catch (error) {
      if (!isRequestCancelled(error) && !controller.signal.aborted) {
        setState({ status: 'error', error: getApiErrorMessage(error, GENERATION_ERROR) });
      }
      return null;
    } finally {
      // Only the latest request may release the lock (a cancelled request can finish late).
      if (requestIdRef.current === requestId) {
        inFlightRef.current = false;
        controllerRef.current = null;
      }
    }
  }, []);

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    inFlightRef.current = false;
    setState({ status: 'idle', error: null });
  }, []);

  const clearError = useCallback(() => {
    setState((current) => (current.status === 'error' ? { status: 'idle', error: null } : current));
  }, []);

  return { status: state.status, error: state.error, generate, cancel, clearError };
}
