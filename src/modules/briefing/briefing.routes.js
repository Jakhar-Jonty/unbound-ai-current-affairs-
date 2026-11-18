'use strict';
const express = require('express');
const { optionalAuth } = require('../users/auth.middleware');
const { Article } = require('../content/article.model');
const { articleText, langOf } = require('../content/i18n');
const { isPremium, premiumRequired } = require('../billing/entitlements');
const { formatLongDateIn } = require('./dates');

const router = express.Router();
const MAX_ITEMS = 6;

/** Text written to be read aloud: no brackets of English, no list markers. */
function speakable(s) {
  return String(s || '').replace(/\s*\([^)]*[A-Za-z][^)]*\)/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Today's audio briefing (Premium): up to six recent published articles as a script
 * for the phone's own text-to-speech. In Hindi, only articles with a published
 * Hindi version are included, so the voice never switches language mid-briefing.
 */
router.get('/briefing/today', optionalAuth, async (req, res) => {
  if (!isPremium(req.user)) throw premiumRequired('audio');
  const lang = langOf(req);
  const recent = await Article.find({ status: 'published' }).sort({ publishedAt: -1 }).limit(40).lean();
  const items = recent
    .map((a) => ({ a, t: articleText(a, lang) }))
    .filter(({ t }) => t.lang === lang)
    .slice(0, MAX_ITEMS)
    .map(({ a, t }) => ({
      articleId: a._id,
      title: t.title,
      text: [t.title, t.summary, ...(t.keyPoints || []).slice(0, 3)].map(speakable).join(lang === 'hi' ? '। ' : '. '),
      publishedAt: a.publishedAt,
    }));
  const date = formatLongDateIn(lang);
  const intro = lang === 'hi'
    ? `नमस्ते। यह ${date} की करेंट अफेयर्स ब्रीफिंग है। आज ${items.length} खबरें।`
    : `Hello. This is your current affairs briefing for ${date}. ${items.length} stories today.`;
  const outro = lang === 'hi'
    ? 'आज की ब्रीफिंग यहीं समाप्त होती है। आज का क्विज़ ज़रूर हल करें।'
    : 'That’s the briefing. Don’t forget today’s quiz.';
  const words = [intro, ...items.map((i) => i.text), outro].join(' ').split(/\s+/).length;
  res.set('Cache-Control', 'private, max-age=300');
  res.json({ lang, intro, outro, items, minutes: Math.max(1, Math.round(words / 150)) });
});

module.exports = router;
