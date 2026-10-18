import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { deriveRobotState, isAnnouncedState, robotStateLabelKey, ROBOT_STATES } from './companionState.js';

describe('deriveRobotState', () => {
  test('is idle when nothing is happening', () => {
    assert.equal(deriveRobotState(), 'idle');
    assert.equal(deriveRobotState({}), 'idle');
    assert.equal(deriveRobotState({ listening: false, speaking: false, thinking: false }), 'idle');
  });

  test('each fact maps to its own state', () => {
    for (const state of ['listening', 'speaking', 'thinking', 'celebrating', 'error', 'teaching']) {
      assert.equal(deriveRobotState({ [state]: true }), state);
    }
  });

  test('only a literal true counts, so truthy leftovers cannot animate the robot', () => {
    assert.equal(deriveRobotState({ speaking: 'yes', thinking: 1, error: {} }), 'idle');
  });

  test('the student talking beats everything else', () => {
    assert.equal(deriveRobotState({ listening: true, speaking: true, thinking: true, error: true }), 'listening');
  });

  test('live audio and a live request beat a lingering outcome', () => {
    assert.equal(deriveRobotState({ speaking: true, error: true, teaching: true }), 'speaking');
    assert.equal(deriveRobotState({ thinking: true, error: true }), 'thinking');
    assert.equal(deriveRobotState({ thinking: true, celebrating: true }), 'thinking');
  });

  test('a failure stays visible over the teaching glow, and celebrating over a failure', () => {
    assert.equal(deriveRobotState({ error: true, teaching: true }), 'error');
    assert.equal(deriveRobotState({ celebrating: true, error: true }), 'celebrating');
  });

  test('after a failed request nothing keeps it thinking: dropping the thinking fact leaves error', () => {
    assert.equal(deriveRobotState({ thinking: false, error: true }), 'error');
  });

  test('stopping the audio leaves the speaking state immediately', () => {
    assert.equal(deriveRobotState({ speaking: false, teaching: true }), 'teaching');
    assert.equal(deriveRobotState({ speaking: false }), 'idle');
  });
});

describe('state labels', () => {
  test('every state has its own label key and unknown states fall back to idle', () => {
    assert.deepEqual(ROBOT_STATES, ['idle', 'listening', 'thinking', 'speaking', 'teaching', 'celebrating', 'error']);

    for (const state of ROBOT_STATES) {
      assert.equal(robotStateLabelKey(state), `companion.state.${state}`);
    }

    assert.equal(robotStateLabelKey('dancing'), 'companion.state.idle');
  });

  test('idle is not announced, every other state is', () => {
    assert.equal(isAnnouncedState('idle'), false);
    assert.equal(ROBOT_STATES.filter(isAnnouncedState).length, ROBOT_STATES.length - 1);
  });
});
