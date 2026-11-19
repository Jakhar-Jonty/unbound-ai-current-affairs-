/**
 * Brand palette. Every colour in the app comes from here.
 *   #151515 black · #F5F2EC ivory · #777777 grey · #FF7928 orange
 * Contrast notes (WCAG): black on ivory 16.3:1, black on orange 7.0:1,
 * orange on black 7.0:1. Orange is too light for text on ivory (2.3:1), so on
 * light backgrounds it is only used as a fill (with black text) or for large shapes.
 */
export const palette = {
  black: '#151515',
  ivory: '#F5F2EC',
  grey: '#777777',
  orange: '#FF7928',
  // Small-text greys: #777777 is 4.0:1 on ivory, slightly under the 4.5:1 needed
  // for small text, so small secondary text uses these close shades.
  greyOnIvory: '#6A6A6A', // 4.8:1
  greyOnBlack: '#8F8F8F', // 5.7:1
  // Quiz feedback only, always paired with a ✓ / ✗ icon.
  correct: '#2E7D4F', // 4.5:1 on ivory
  incorrect: '#B42318', // 5.9:1 on ivory
  correctOnBlack: '#5FBF8A',
  incorrectOnBlack: '#FF7B6E',
};

export const light = {
  scheme: 'light',
  background: palette.ivory,
  surface: '#FCFAF6', // cards: a touch lighter than the page
  text: palette.black,
  textSecondary: palette.greyOnIvory,
  textMuted: palette.grey, // large text / icons only
  border: 'rgba(21, 21, 21, 0.12)',
  borderStrong: 'rgba(21, 21, 21, 0.28)',
  accent: palette.orange,
  onAccent: palette.black,
  accentSoft: 'rgba(255, 121, 40, 0.14)',
  inverse: palette.black,
  onInverse: palette.ivory,
  correct: palette.correct,
  incorrect: palette.incorrect,
  correctSoft: 'rgba(46, 125, 79, 0.10)',
  incorrectSoft: 'rgba(180, 35, 24, 0.08)',
  link: palette.black,
};

export const dark = {
  scheme: 'dark',
  background: palette.black,
  surface: '#1D1D1D', // cards: a touch lighter than the page
  text: palette.ivory,
  textSecondary: palette.greyOnBlack,
  textMuted: palette.grey,
  border: 'rgba(245, 242, 236, 0.14)',
  borderStrong: 'rgba(245, 242, 236, 0.32)',
  accent: palette.orange,
  onAccent: palette.black,
  accentSoft: 'rgba(255, 121, 40, 0.18)',
  inverse: palette.ivory,
  onInverse: palette.black,
  correct: palette.correctOnBlack,
  incorrect: palette.incorrectOnBlack,
  correctSoft: 'rgba(95, 191, 138, 0.12)',
  incorrectSoft: 'rgba(255, 123, 110, 0.12)',
  link: palette.orange,
};
