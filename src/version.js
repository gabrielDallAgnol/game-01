// The build's name and when it was bundled, shown on the start screen so a reload is known to have taken (Gabriel to
// Gemini, Oct 24: "add a build version on the initial screen so I'm sure that is the latest version").
// tools/build.mjs stamps `time` into the bundle (Berlin time); the source keeps 'dev' and is never rewritten.
export const BUILD = { version: 'v56', time: 'dev' };
