import { buildPlanRequest, parsePlanResponse } from '../utils/studyPlanner';
import { getLearningProfileStore } from '../utils/learningProfileStore';
import apiClient from './apiClient';

// The backend allows up to 120s per attempt (larger models can take ~45s for a month-long plan).
const PLAN_REQUEST_TIMEOUT_MS = 260_000;

/**
 * Ask the FastAPI backend (which calls Gemini) to generate a study plan.
 *
 * @param {import('../utils/studyPlanner').PlanConfig} config
 * @param {string} today The student's local date, "YYYY-MM-DD". Sent so both sides use the same calendar day.
 * @param {{signal?: AbortSignal}} [options]
 * @returns {Promise<object>} A validated plan.
 * @throws Axios errors for network/HTTP failures and `InvalidPlanResponseError` for malformed payloads.
 */
export async function generateStudyPlan(config, today, { signal } = {}) {
  const request = getLearningProfileStore().personalize(buildPlanRequest(config, today), 'learning_profile');
  const { data } = await apiClient.post('/api/study-planner/generate', request, {
    signal,
    timeout: PLAN_REQUEST_TIMEOUT_MS
  });

  return parsePlanResponse(data);
}
