import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { newEmail, starterProps } from '../src/new-email.mjs';
import { makeProject } from './helpers.mjs';

test('new-email takes its preview data from brand.json, not the sample company', () => {
  const { dir } = makeProject({ brand: { url: 'https://example.test' } });
  newEmail(dir, 'foo', { marketing: true });
  const written = ['emails/foo.mjml', 'emails/foo.props.json', 'emails.json'].map((f) => readFileSync(join(dir, f), 'utf8')).join('\n');
  assert.doesNotMatch(written, /pebblework/i);
  assert.doesNotMatch(written, /Maya/);
  const props = JSON.parse(readFileSync(join(dir, 'emails/foo.props.json'), 'utf8'));
  assert.deepEqual(props, {
    recipient: { email: 'customer@example.test' },
    user: { firstName: 'TODO' },
    actionUrl: 'https://example.test/TODO',
    unsubscribeUrl: 'https://example.test/email/unsubscribe?u=TODO',
  });
  assert.equal(JSON.parse(readFileSync(join(dir, 'emails.json'), 'utf8')).emails.at(-1).type, 'marketing');
  assert.throws(() => newEmail(dir, 'foo'), /already exists/);
  assert.throws(() => newEmail(dir, 'Not An Id'), /kebab-case-id/);
});

test('starter data without a usable brand url falls back to example.com', () => {
  assert.equal(starterProps({ url: 'nonsense' }).recipient.email, 'customer@example.com');
  assert.equal(starterProps({ url: 'https://www.orbitlane.example/' }).recipient.email, 'customer@orbitlane.example');
});
