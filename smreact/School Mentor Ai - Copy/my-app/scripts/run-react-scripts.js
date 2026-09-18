/*
 * Thin wrapper around the react-scripts CLI.
 *
 * react-scripts 5.0.1 pulls in webpack-dev-server 4 and a few other packages that
 * emit Node DeprecationWarnings on modern Node (18+). They are harmless, but they
 * bury the actual "Compiled successfully!" line in noise on every `npm start`.
 *
 * The react-scripts bin re-spawns a child process, so a `node --no-deprecation`
 * flag on the parent gets dropped. NODE_OPTIONS *is* inherited by the child, so we
 * set that instead and then hand off to the real CLI.
 *
 * Usage: node scripts/run-react-scripts.js <start|build|test|eject> [args...]
 */
'use strict';

const flag = '--no-deprecation';
process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS || ''} ${flag}`.trim();

const cli = require.resolve('react-scripts/bin/react-scripts.js');

// The CLI reads the subcommand from argv[2] and forwards argv[3..] to the script.
process.argv = [process.argv[0], cli, ...process.argv.slice(2)];

require(cli);
