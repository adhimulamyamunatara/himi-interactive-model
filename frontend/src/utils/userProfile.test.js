import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AVATAR_DATA_URL_PREFIX } from './avatar.js';
import { normalizeStoredUser } from './userProfile.js';

const IMAGE = `${AVATAR_DATA_URL_PREFIX}/9j/4AAQSkZJRg==`;

describe('normalizeStoredUser', () => {
  it('keeps users saved before avatars existed and gives them the default colour', () => {
    const user = normalizeStoredUser({ name: 'Asha Rao', email: 'asha@example.com', college: 'JNTU', branch: '', semester: '3', learningGoal: 'Placements' });
    assert.deepEqual(user, {
      name: 'Asha Rao',
      email: 'asha@example.com',
      college: 'JNTU',
      branch: '',
      semester: '3',
      learningGoal: 'Placements',
      avatarColor: 'ocean'
    });
    assert.equal('avatarImage' in user, false);
  });

  it('keeps a valid photo and colour', () => {
    const user = normalizeStoredUser({ name: 'Asha', email: 'a@b.co', avatarImage: IMAGE, avatarColor: 'forest' });
    assert.equal(user.avatarImage, IMAGE);
    assert.equal(user.avatarColor, 'forest');
  });

  it('drops invalid photos and unknown colours but keeps the account', () => {
    for (const avatarImage of ['https://evil.example/x.png', 'data:image/svg+xml;base64,PHN2Zz4=', 12, {}, `${AVATAR_DATA_URL_PREFIX}???`]) {
      const user = normalizeStoredUser({ name: 'Asha', email: 'a@b.co', avatarImage, avatarColor: 'neon' });
      assert.equal(user.name, 'Asha');
      assert.equal('avatarImage' in user, false);
      assert.equal(user.avatarColor, 'ocean');
    }
  });

  it('coerces wrong-typed optional text to empty strings and ignores unknown fields', () => {
    const user = normalizeStoredUser({ name: 'Asha', email: 'a@b.co', college: 5, branch: null, isAdmin: true });
    assert.equal(user.college, '');
    assert.equal(user.branch, '');
    assert.equal('isAdmin' in user, false);
  });

  it('rejects things that are not a usable user', () => {
    for (const bad of [null, undefined, 'x', 7, [], {}, { name: 'A' }, { email: 'a@b.co' }, { name: 3, email: 'a@b.co' }, { name: '   ', email: 'a@b.co' }]) {
      assert.equal(normalizeStoredUser(bad), null);
    }
  });
});
