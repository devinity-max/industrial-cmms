import assert from 'node:assert/strict';
import { stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline/promises';

// The caller pins one read request in memory. Only redacted results leave it.
export async function verifyDeactivation(read) {
  assert.ok(stdin.isTTY, 'Run at the local interactive terminal');
  const verifyRead = async () => {
    const result = await read();
    assert.equal(result.status, 200);
    assert.ok(result.hasRows, 'Expected an authorized machine row');
  };
  await verifyRead();
  stdout.write('T08 initial authorized read: HTTP 200, rows present, Viewer JWT unexpired.\n');
  const terminal = createInterface({ input: stdin, output: stdout });
  try {
    const change = await terminal.question('With restoration prepared, disable only the verified replacement Viewer in SQL Editor. Type disabled after confirming one changed row, or type pending if no change was made: ');
    if (change.trim() === 'pending') throw new Error('T08 paused before profile change');
    try {
      assert.ok(change.trim() === 'disabled', 'Profile change was not confirmed');
      const result = await read();
      assert.equal(result.status, 403);
      assert.equal(result.code, '42501');
      stdout.write('T08 disabled read: HTTP 403 / 42501 with the original request.\n');
    } finally {
      const restored = await terminal.question('Restore the same Viewer now, including after any error. Type restored after verifying enabled=true in SQL Editor: ');
      assert.ok(restored.trim() === 'restored', 'Operator confirmation of restoration is missing');
      await verifyRead();
      stdout.write('T08 restored read: HTTP 200, rows present, same unexpired JWT.\n');
    }
  } finally {
    terminal.close();
  }
}
