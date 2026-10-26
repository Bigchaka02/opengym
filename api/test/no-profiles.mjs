// Coach/client fork (PROJECT.md): the server creates the client profiles on boot unless told not
// to. The upstream suites count the profiles on an instance, so they run with the feature off;
// test/profiles.test.js turns it back on for itself. Loaded with --import by `npm test`, and
// inherited by every server a test spawns with { ...process.env }.
process.env.PROFILES ||= 'off'
