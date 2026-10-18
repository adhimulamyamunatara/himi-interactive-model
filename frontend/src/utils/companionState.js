/**
 * What the HIMI robot is doing, derived from what is *actually* happening: the microphone, the pending AI
 * request, the speech engine and the latest outcome. The robot never animates a state that is not real
 * (no "speaking" while the audio is stopped, no endless "thinking" after a failed request), because the
 * state is computed from those facts and nothing else.
 *
 * Pure and framework-free so it is covered by unit tests.
 */

export const ROBOT_STATES = Object.freeze(['idle', 'listening', 'thinking', 'speaking', 'teaching', 'celebrating', 'error']);

/** How long the short, purely visual states last. They end by themselves. */
export const CELEBRATE_MS = 3500;
export const TEACHING_MS = 7000;

/**
 * Priority, highest first. What the student is doing right now (talking) beats everything; a live request or
 * live audio beats a lingering outcome; the failure stays visible until something else happens.
 */
const PRIORITY = ['listening', 'speaking', 'thinking', 'celebrating', 'error', 'teaching'];

/**
 * @param {{listening?: boolean, speaking?: boolean, thinking?: boolean, celebrating?: boolean, error?: boolean, teaching?: boolean}} facts
 * @returns {typeof ROBOT_STATES[number]}
 */
export function deriveRobotState(facts = {}) {
  for (const state of PRIORITY) {
    if (facts[state] === true) {
      return state;
    }
  }

  return 'idle';
}

/** Translation key of the text that names a state, so the state never relies on animation or colour alone. */
export const robotStateLabelKey = (state) => `companion.state.${ROBOT_STATES.includes(state) ? state : 'idle'}`;

/** Whether a state should be announced to screen readers when it begins (idle is silent). */
export const isAnnouncedState = (state) => state !== 'idle';
