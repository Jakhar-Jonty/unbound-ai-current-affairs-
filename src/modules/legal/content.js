'use strict';
/**
 * Text of the public legal pages, in English and Hindi. `v.x` inserts a value from
 * config.legal (or a visible "not set" marker). English is the binding version.
 *
 * Keep this in step with what the code actually does. If you add analytics, ads,
 * a new processor or start sending user data anywhere new, update the privacy
 * policy AND the Play Store Data safety form (docs/store/data-safety.md).
 */

const en = {
  home: (v) => ({
    title: v.app,
    lead: `Daily current affairs for UPSC aspirants, in English and Hindi. Short explainers mapped to the syllabus, a daily quiz, practice questions and a weekly mock test.`,
    sections: [
      { h: 'What you get', ul: [
        'Daily articles from reliable public sources, checked by an editor before they are published.',
        'Each story tagged by GS paper and subject, with key points and sources.',
        'A daily 10-question quiz, a weekly mock test with UPSC marking and a weekly leaderboard.',
        'Practice questions by subject, bookmarks, offline reading and an audio briefing.',
      ] },
      { h: 'Get the app', p: [v.storeLink] },
    ],
  }),

  privacy: (v) => ({
    title: 'Privacy Policy',
    lead: `This policy explains what ${v.app} ("the app", "we") collects, why, and the choices you have. ${v.app} is run by ${v.operator}. Effective ${v.date}.`,
    sections: [
      { h: '1. Summary', ul: [
        'You can read articles without an account. We collect personal data only when you create one.',
        'We use your data to run the app: your account, quiz results, streaks, bookmarks and reminders.',
        'We do not sell your data, show ads, or use advertising or analytics trackers.',
        'You can delete your account and its data at any time, in the app or on the web.',
      ] },
      { h: '2. What we collect', ul: [
        '<b>Account:</b> name, email address, and a password (stored only as a secure hash). If you sign in with Google or Apple, we receive your name, email and an account ID from them. Apple may give us a relay email instead of your real one.',
        '<b>Your activity in the app:</b> quiz and mock-test answers, scores, times and ranks; practice answers; bookmarks; streaks.',
        '<b>Settings:</b> preferred language, subjects you follow, notification choices, and whether you appear on the leaderboard.',
        '<b>Push notification token:</b> if you allow notifications, a device token so we can send reminders, plus the device platform (Android or iOS).',
        '<b>Payments (Premium only):</b> plan, subscription status, dates and Razorpay payment and subscription IDs. Card, UPI and bank details go directly to Razorpay; we never see or store them.',
        '<b>Technical logs:</b> our server records requests (IP address, time, address requested, errors) to keep the service secure and working. These logs are kept for up to 30 days.',
      ] },
      { h: '3. What stays on your phone', p: [
        'Your sign-in session, language, theme, onboarding choices, saved offline articles and an in-progress mock test are stored on your device. They are removed when you uninstall the app or sign out (offline articles) and are not sent to us except as described above.',
      ] },
      { h: '4. How we use it', ul: [
        'To create and secure your account, and to sign you in.',
        'To show your scores, streaks, history and rank, and to run the weekly leaderboard.',
        'To send emails you need: verification codes, password reset and account deletion codes.',
        'To send push reminders you can switch off: the morning quiz, an evening streak reminder and mock-test reminders.',
        'To provide Premium and handle billing, if you subscribe.',
        'To prevent abuse, fix problems and keep the service secure.',
      ], p: [
        'We process this data because it is needed to provide the service you asked for, or with your consent (for example notifications), as allowed by the Digital Personal Data Protection Act, 2023.',
      ] },
      { h: '5. Leaderboard', p: [
        'If you take the daily quiz or the weekly mock test, your first name and the initial of your last name (for example "Asha K.") may appear on the leaderboard with your score. You can turn this off in Profile at any time.',
      ] },
      { h: '6. AI and content', p: [
        'Articles and questions are written with the help of AI from public news sources and are reviewed by an editor before publishing. Your personal data is never sent to AI providers.',
      ] },
      { h: '7. Who we share data with', p: [
        'Only these service providers, and only what each needs to do its job for us:',
      ], ul: [
        '<b>Hosting and database:</b> our cloud server and MongoDB database providers store the app data.',
        '<b>Email:</b> our email delivery provider sends codes to your address.',
        '<b>Push notifications:</b> Expo, Google Firebase Cloud Messaging and Apple Push Notification service deliver notifications to your device.',
        '<b>Sign-in:</b> Google and Apple, if you choose to sign in with them.',
        '<b>Payments:</b> Razorpay, if you subscribe to Premium.',
      ], p2: [
        'We may also disclose data when the law requires it. Some providers may process data outside India, with safeguards required by law.',
      ] },
      { h: '8. How long we keep it', ul: [
        'Account data, activity and settings: until you delete your account.',
        'Email codes: 15 minutes. Notification send records: 30 days. Server logs: up to 30 days. Backups: up to 30 days.',
        'Subscription and payment records: kept after account deletion for as long as tax and accounting laws require (generally 8 years), without your quiz history or other activity.',
      ] },
      { h: '9. Deleting your account', p: [
        `In the app: Profile → Delete account. On the web: <a href="/delete-account">${v.base}/delete-account</a>, where we email you a code to confirm. Deletion is immediate and permanent: your account, quiz and mock-test history, practice answers, bookmarks, settings and notification tokens are erased. Any active subscription is cancelled first. Copies in backups are overwritten within 30 days.`,
      ] },
      { h: '10. Your rights', p: [
        `You can access and correct your data in the app, withdraw consent for notifications in Profile or your phone settings, delete your account, and nominate someone to act for you. For anything else, or to raise a concern, write to ${v.email}. If you are not satisfied with our answer you may complain to the Data Protection Board of India.`,
      ] },
      { h: '11. Security', p: [
        'Connections are encrypted (HTTPS). Passwords are hashed, codes are single-use and expire, and access to the admin panel is limited to authorised editors. No system is perfectly secure; if a breach affects you we will tell you and the authorities as the law requires.',
      ] },
      { h: '12. Age', p: [
        `${v.app} is meant for people aged 18 and over. We do not knowingly collect data from children. If you believe a child has created an account, contact us and we will delete it.`,
      ] },
      { h: '13. Changes', p: [
        'If we change this policy we will update the date above and, for important changes, tell you in the app or by email.',
      ] },
      { h: '14. Contact and Grievance Officer', p: [
        `${v.operator}<br>${v.address}<br>Email: ${v.email}<br>Grievance Officer: ${v.officer} (${v.email}). We acknowledge complaints within 24 hours and resolve them within 15 days.`,
      ] },
    ],
  }),

  terms: (v) => ({
    title: 'Terms of Use',
    lead: `These terms apply when you use ${v.app}, run by ${v.operator}. By using the app you agree to them. Effective ${v.date}.`,
    sections: [
      { h: '1. The service', p: [
        `${v.app} provides current-affairs articles, quizzes, practice questions and mock tests to help with UPSC and other exam preparation. It is an independent study aid and is not affiliated with the Union Public Service Commission or any government body.`,
      ] },
      { h: '2. Accuracy', p: [
        'Content is prepared with the help of AI from public news sources and checked by editors, but it may contain errors or become outdated. Always confirm important facts from official sources. We are not responsible for exam results or decisions made on the basis of the content.',
      ] },
      { h: '3. Your account', ul: [
        'You must be 18 or older and give accurate details.',
        'Keep your password safe. You are responsible for activity on your account.',
        'One person per account. Do not share or sell accounts.',
      ] },
      { h: '4. Fair use', p: [
        'Do not copy, scrape or republish the content in bulk, use bots or multiple accounts to affect leaderboards, try to break or overload the service, or use it for anything unlawful. We may suspend or remove accounts that do, and remove leaderboard entries that look unfair.',
      ] },
      { h: '5. Premium', ul: [
        'Premium is an optional paid subscription (monthly or yearly), charged through Razorpay at the price shown before you pay, including applicable taxes.',
        'It renews automatically until you cancel. You can cancel any time from Profile → Premium; you keep Premium until the end of the period you paid for.',
        'Refunds are covered by our <a href="/refunds">Cancellation and Refund Policy</a>.',
        'We may change prices or features with notice; changes apply from your next renewal.',
      ] },
      { h: '6. Content ownership', p: [
        `The articles, questions, design and code belong to ${v.operator} or its licensors. You may use them for your personal study. News sources remain the property of their publishers and are linked for reference.`,
      ] },
      { h: '7. Availability and liability', p: [
        'We work to keep the app running but provide it "as is", without guarantees that it will always be available or error-free. To the extent the law allows, our total liability to you is limited to the amount you paid us in the 12 months before the claim. Nothing here limits rights you have under consumer law.',
      ] },
      { h: '8. Ending use', p: [
        'You may stop using the app and delete your account at any time. We may suspend or end access if you break these terms.',
      ] },
      { h: '9. Law and disputes', p: [
        `These terms are governed by the laws of India. Disputes are subject to the courts at ${v.city}. Please contact us first at ${v.email}; most issues can be sorted out quickly.`,
      ] },
      { h: '10. Changes', p: [
        'We may update these terms. We will change the date above and, for important changes, tell you in the app. Continuing to use the app means you accept the new terms.',
      ] },
    ],
  }),

  refunds: (v) => ({
    title: 'Cancellation and Refund Policy',
    lead: `For ${v.app} Premium subscriptions. Effective ${v.date}.`,
    sections: [
      { h: 'Cancelling', p: [
        'You can cancel your subscription at any time from Profile → Premium in the app or on the Premium page. Cancelling stops future renewals; you keep Premium until the end of the period already paid for. Deleting your account also cancels it.',
      ] },
      { h: 'Refunds', ul: [
        'Payments for a period that has started are not refundable, except as below or where the law requires.',
        'If you were charged twice, charged after cancelling, or paid but did not get Premium, write to us within 30 days and we will refund the charge in full.',
        'If a renewal went through by mistake and you have not used Premium since, write to us within 7 days of the renewal for a full refund.',
        `Approved refunds go back to the original payment method within 5–7 working days. Write to ${v.email} with your account email and the Razorpay payment ID.`,
      ] },
      { h: 'Delivery', p: [
        'Premium is a digital service. It is activated on your account right after payment is confirmed; nothing is shipped.',
      ] },
    ],
  }),

  contact: (v) => ({
    title: 'Contact us',
    lead: 'Questions, corrections in an article, billing issues or privacy requests: we usually reply within 2 working days.',
    sections: [
      { h: 'Support', p: [`Email: ${v.email}`] },
      { h: 'Grievance Officer', p: [`${v.officer}<br>Email: ${v.email}`] },
      { h: 'Address', p: [`${v.operator}<br>${v.address}`] },
    ],
  }),

  deleteAccount: (v) => ({
    title: 'Delete your account',
    lead: `You can delete your ${v.app} account here, or in the app under Profile → Delete account.`,
    sections: [
      { h: 'What gets deleted', ul: [
        'Your account: name, email and password or Google/Apple sign-in.',
        'Quiz, mock-test and practice history, scores, streaks and leaderboard entries.',
        'Bookmarks, settings and notification tokens.',
      ] },
      { h: 'What we keep', p: [
        'If you subscribed to Premium, the subscription and payment records (plan, dates, Razorpay IDs) are kept as long as tax law requires, without any of your activity. Any active subscription is cancelled first. Backups are overwritten within 30 days.',
      ] },
    ],
    form: true,
  }),

  ui: {
    lang: 'हिंदी', langHref: '?lang=hi', notSet: 'not set', updated: 'Effective',
    nav: { privacy: 'Privacy', terms: 'Terms', refunds: 'Refunds', contact: 'Contact', deleteAccount: 'Delete account' },
    form: {
      email: 'Account email', send: 'Email me a code', code: '6-digit code', confirm: 'Delete my account permanently',
      sent: 'If an account uses this email, we have sent it a code. It expires in 15 minutes.',
      done: 'Your account has been deleted.', warn: 'This cannot be undone.', failed: 'Something went wrong. Try again.',
    },
    binding: '',
  },
};

const hi = {
  home: (v) => ({
    title: v.app,
    lead: 'UPSC अभ्यर्थियों के लिए रोज़ का करेंट अफ़ेयर्स, हिंदी और अंग्रेज़ी में। पाठ्यक्रम से जुड़े छोटे लेख, रोज़ की क्विज़, अभ्यास प्रश्न और साप्ताहिक मॉक टेस्ट।',
    sections: [
      { h: 'ऐप में क्या है', ul: [
        'विश्वसनीय सार्वजनिक स्रोतों से रोज़ के लेख, प्रकाशन से पहले संपादक द्वारा जाँचे गए।',
        'हर ख़बर GS पेपर और विषय के अनुसार, मुख्य बिंदुओं और स्रोतों के साथ।',
        'रोज़ 10 प्रश्नों की क्विज़, UPSC अंकन वाला साप्ताहिक मॉक टेस्ट और साप्ताहिक लीडरबोर्ड।',
        'विषयवार अभ्यास प्रश्न, बुकमार्क, ऑफ़लाइन पढ़ना और ऑडियो ब्रीफ़िंग।',
      ] },
      { h: 'ऐप पाएँ', p: [v.storeLink] },
    ],
  }),

  privacy: (v) => ({
    title: 'गोपनीयता नीति',
    lead: `यह नीति बताती है कि ${v.app} ("ऐप", "हम") कौन-सा डेटा लेता है, क्यों, और आपके पास क्या विकल्प हैं। ${v.app} का संचालन ${v.operator} करते हैं। प्रभावी तिथि ${v.date}।`,
    sections: [
      { h: '1. संक्षेप में', ul: [
        'लेख बिना खाते के पढ़े जा सकते हैं। निजी डेटा केवल खाता बनाने पर लिया जाता है।',
        'आपका डेटा ऐप चलाने के लिए उपयोग होता है: आपका खाता, क्विज़ परिणाम, स्ट्रीक, बुकमार्क और रिमाइंडर।',
        'हम आपका डेटा नहीं बेचते, विज्ञापन नहीं दिखाते, और कोई विज्ञापन या एनालिटिक्स ट्रैकर नहीं लगाते।',
        'आप कभी भी ऐप में या वेब पर अपना खाता और उसका डेटा हटा सकते हैं।',
      ] },
      { h: '2. हम क्या लेते हैं', ul: [
        '<b>खाता:</b> नाम, ईमेल पता और पासवर्ड (केवल सुरक्षित हैश के रूप में)। Google या Apple से साइन इन करने पर उनसे आपका नाम, ईमेल और एक खाता ID मिलती है। Apple आपके असली ईमेल के बजाय रिले ईमेल दे सकता है।',
        '<b>ऐप में आपकी गतिविधि:</b> क्विज़ और मॉक टेस्ट के उत्तर, अंक, समय और रैंक; अभ्यास के उत्तर; बुकमार्क; स्ट्रीक।',
        '<b>सेटिंग्स:</b> भाषा, आपके चुने विषय, सूचना विकल्प, और लीडरबोर्ड पर दिखना है या नहीं।',
        '<b>पुश सूचना टोकन:</b> सूचनाओं की अनुमति देने पर एक डिवाइस टोकन ताकि हम रिमाइंडर भेज सकें, और डिवाइस प्लेटफ़ॉर्म (Android या iOS)।',
        '<b>भुगतान (केवल प्रीमियम):</b> प्लान, सब्सक्रिप्शन स्थिति, तिथियाँ और Razorpay भुगतान व सब्सक्रिप्शन ID। कार्ड, UPI और बैंक विवरण सीधे Razorpay को जाते हैं; हम इन्हें कभी नहीं देखते या रखते।',
        '<b>तकनीकी लॉग:</b> सेवा को सुरक्षित और चालू रखने के लिए हमारा सर्वर अनुरोध दर्ज करता है (IP पता, समय, माँगा गया पता, त्रुटियाँ)। ये लॉग अधिकतम 30 दिन रखे जाते हैं।',
      ] },
      { h: '3. आपके फ़ोन पर क्या रहता है', p: [
        'आपका साइन-इन सत्र, भाषा, थीम, शुरुआती विकल्प, ऑफ़लाइन सहेजे लेख और चल रहा मॉक टेस्ट आपके डिवाइस पर रहते हैं। ऐप हटाने या साइन आउट करने पर (ऑफ़लाइन लेख) ये हट जाते हैं और ऊपर बताए तरीके के अलावा हमें नहीं भेजे जाते।',
      ] },
      { h: '4. हम इसका उपयोग कैसे करते हैं', ul: [
        'आपका खाता बनाने, सुरक्षित रखने और साइन इन कराने के लिए।',
        'आपके अंक, स्ट्रीक, इतिहास और रैंक दिखाने और साप्ताहिक लीडरबोर्ड चलाने के लिए।',
        'ज़रूरी ईमेल भेजने के लिए: सत्यापन कोड, पासवर्ड रीसेट और खाता हटाने के कोड।',
        'पुश रिमाइंडर भेजने के लिए, जिन्हें आप बंद कर सकते हैं: सुबह की क्विज़, शाम का स्ट्रीक रिमाइंडर और मॉक टेस्ट रिमाइंडर।',
        'सब्सक्राइब करने पर प्रीमियम और बिलिंग के लिए।',
        'दुरुपयोग रोकने, समस्याएँ ठीक करने और सेवा सुरक्षित रखने के लिए।',
      ], p: [
        'हम यह डेटा इसलिए संसाधित करते हैं क्योंकि आपकी माँगी सेवा देने के लिए यह ज़रूरी है, या आपकी सहमति से (जैसे सूचनाएँ), जैसा डिजिटल व्यक्तिगत डेटा संरक्षण अधिनियम, 2023 अनुमति देता है।',
      ] },
      { h: '5. लीडरबोर्ड', p: [
        'रोज़ की क्विज़ या साप्ताहिक मॉक टेस्ट देने पर आपका पहला नाम और उपनाम का पहला अक्षर (जैसे "Asha K.") आपके अंकों के साथ लीडरबोर्ड पर दिख सकता है। इसे आप प्रोफ़ाइल में कभी भी बंद कर सकते हैं।',
      ] },
      { h: '6. AI और सामग्री', p: [
        'लेख और प्रश्न सार्वजनिक समाचार स्रोतों से AI की मदद से लिखे जाते हैं और प्रकाशन से पहले संपादक उनकी समीक्षा करते हैं। आपका निजी डेटा कभी AI प्रदाताओं को नहीं भेजा जाता।',
      ] },
      { h: '7. डेटा किसके साथ साझा होता है', p: [
        'केवल इन सेवा प्रदाताओं के साथ, और केवल उतना जितना उनके काम के लिए ज़रूरी है:',
      ], ul: [
        '<b>होस्टिंग और डेटाबेस:</b> हमारे क्लाउड सर्वर और MongoDB डेटाबेस प्रदाता ऐप का डेटा रखते हैं।',
        '<b>ईमेल:</b> हमारा ईमेल प्रदाता आपके पते पर कोड भेजता है।',
        '<b>पुश सूचनाएँ:</b> Expo, Google Firebase Cloud Messaging और Apple Push Notification service आपके डिवाइस तक सूचनाएँ पहुँचाते हैं।',
        '<b>साइन इन:</b> Google और Apple, यदि आप उनसे साइन इन करें।',
        '<b>भुगतान:</b> Razorpay, यदि आप प्रीमियम लें।',
      ], p2: [
        'क़ानून की माँग पर भी हम डेटा दे सकते हैं। कुछ प्रदाता क़ानूनी सुरक्षा उपायों के साथ भारत के बाहर डेटा संसाधित कर सकते हैं।',
      ] },
      { h: '8. हम डेटा कब तक रखते हैं', ul: [
        'खाता, गतिविधि और सेटिंग्स: जब तक आप खाता न हटाएँ।',
        'ईमेल कोड: 15 मिनट। सूचना भेजने के रिकॉर्ड: 30 दिन। सर्वर लॉग: अधिकतम 30 दिन। बैकअप: अधिकतम 30 दिन।',
        'सब्सक्रिप्शन और भुगतान रिकॉर्ड: खाता हटाने के बाद भी कर और लेखा क़ानूनों के अनुसार (सामान्यतः 8 वर्ष), आपके क्विज़ इतिहास या अन्य गतिविधि के बिना।',
      ] },
      { h: '9. खाता हटाना', p: [
        `ऐप में: प्रोफ़ाइल → खाता हटाएँ। वेब पर: <a href="/delete-account?lang=hi">${v.base}/delete-account</a>, जहाँ पुष्टि के लिए हम आपको एक कोड ईमेल करते हैं। खाता तुरंत और स्थायी रूप से हटता है: आपका खाता, क्विज़ और मॉक टेस्ट इतिहास, अभ्यास उत्तर, बुकमार्क, सेटिंग्स और सूचना टोकन मिटा दिए जाते हैं। चालू सब्सक्रिप्शन पहले रद्द किया जाता है। बैकअप की प्रतियाँ 30 दिन में मिट जाती हैं।`,
      ] },
      { h: '10. आपके अधिकार', p: [
        `आप ऐप में अपना डेटा देख और सुधार सकते हैं, प्रोफ़ाइल या फ़ोन की सेटिंग में सूचनाओं की सहमति वापस ले सकते हैं, खाता हटा सकते हैं, और अपनी ओर से किसी को नामित कर सकते हैं। अन्य किसी बात या शिकायत के लिए ${v.email} पर लिखें। हमारे उत्तर से संतुष्ट न होने पर आप भारतीय डेटा संरक्षण बोर्ड में शिकायत कर सकते हैं।`,
      ] },
      { h: '11. सुरक्षा', p: [
        'कनेक्शन एन्क्रिप्टेड (HTTPS) हैं। पासवर्ड हैश किए जाते हैं, कोड एक बार ही चलते हैं और समाप्त हो जाते हैं, और एडमिन पैनल केवल अधिकृत संपादकों के लिए है। कोई भी प्रणाली पूरी तरह सुरक्षित नहीं होती; किसी उल्लंघन से आप प्रभावित हों तो क़ानून के अनुसार हम आपको और अधिकारियों को सूचित करेंगे।',
      ] },
      { h: '12. आयु', p: [
        `${v.app} 18 वर्ष और उससे अधिक आयु के लोगों के लिए है। हम जानबूझकर बच्चों का डेटा नहीं लेते। यदि किसी बच्चे ने खाता बनाया है तो हमसे संपर्क करें, हम उसे हटा देंगे।`,
      ] },
      { h: '13. बदलाव', p: [
        'नीति बदलने पर हम ऊपर की तिथि बदलेंगे और बड़े बदलावों की सूचना ऐप में या ईमेल से देंगे।',
      ] },
      { h: '14. संपर्क और शिकायत अधिकारी', p: [
        `${v.operator}<br>${v.address}<br>ईमेल: ${v.email}<br>शिकायत अधिकारी: ${v.officer} (${v.email})। शिकायतों की पावती 24 घंटे में और समाधान 15 दिन में।`,
      ] },
    ],
  }),

  terms: (v) => ({
    title: 'उपयोग की शर्तें',
    lead: `ये शर्तें ${v.app} के उपयोग पर लागू होती हैं, जिसका संचालन ${v.operator} करते हैं। ऐप का उपयोग करके आप इनसे सहमत होते हैं। प्रभावी तिथि ${v.date}।`,
    sections: [
      { h: '1. सेवा', p: [
        `${v.app} UPSC और अन्य परीक्षाओं की तैयारी के लिए करेंट अफ़ेयर्स लेख, क्विज़, अभ्यास प्रश्न और मॉक टेस्ट देता है। यह एक स्वतंत्र अध्ययन साधन है और संघ लोक सेवा आयोग या किसी सरकारी संस्था से संबद्ध नहीं है।`,
      ] },
      { h: '2. सटीकता', p: [
        'सामग्री सार्वजनिक समाचार स्रोतों से AI की मदद से तैयार और संपादकों द्वारा जाँची जाती है, फिर भी इसमें त्रुटि हो सकती है या यह पुरानी हो सकती है। ज़रूरी तथ्य आधिकारिक स्रोतों से अवश्य जाँचें। परीक्षा परिणाम या सामग्री के आधार पर लिए गए निर्णयों के लिए हम ज़िम्मेदार नहीं हैं।',
      ] },
      { h: '3. आपका खाता', ul: [
        'आपकी आयु 18 वर्ष या अधिक हो और विवरण सही हों।',
        'पासवर्ड सुरक्षित रखें। आपके खाते की गतिविधि के लिए आप ज़िम्मेदार हैं।',
        'एक व्यक्ति, एक खाता। खाते साझा न करें, न बेचें।',
      ] },
      { h: '4. उचित उपयोग', p: [
        'सामग्री की बड़े पैमाने पर नकल, स्क्रैपिंग या पुनर्प्रकाशन न करें; लीडरबोर्ड प्रभावित करने के लिए बॉट या कई खाते न चलाएँ; सेवा को तोड़ने या ओवरलोड करने की कोशिश न करें; और किसी ग़ैरक़ानूनी काम में उपयोग न करें। ऐसा करने वाले खाते हम निलंबित या हटा सकते हैं और अनुचित लगने वाली लीडरबोर्ड प्रविष्टियाँ हटा सकते हैं।',
      ] },
      { h: '5. प्रीमियम', ul: [
        'प्रीमियम एक वैकल्पिक सशुल्क सब्सक्रिप्शन (मासिक या वार्षिक) है, जिसका भुगतान Razorpay से, भुगतान से पहले दिखाई गई कीमत पर (लागू करों सहित) होता है।',
        'रद्द करने तक यह अपने आप नवीनीकृत होता है। प्रोफ़ाइल → प्रीमियम से कभी भी रद्द करें; भुगतान की गई अवधि के अंत तक प्रीमियम चलता रहेगा।',
        'रिफ़ंड हमारी <a href="/refunds?lang=hi">रद्दीकरण और रिफ़ंड नीति</a> के अनुसार।',
        'सूचना देकर हम कीमतें या सुविधाएँ बदल सकते हैं; बदलाव अगले नवीनीकरण से लागू होंगे।',
      ] },
      { h: '6. सामग्री का स्वामित्व', p: [
        `लेख, प्रश्न, डिज़ाइन और कोड ${v.operator} या उसके लाइसेंसदाताओं के हैं। आप इन्हें अपने निजी अध्ययन के लिए उपयोग कर सकते हैं। समाचार स्रोत उनके प्रकाशकों के हैं और संदर्भ के लिए लिंक किए गए हैं।`,
      ] },
      { h: '7. उपलब्धता और दायित्व', p: [
        'हम ऐप चालू रखने का प्रयास करते हैं, पर इसे "जैसा है" के आधार पर देते हैं, बिना इस गारंटी के कि यह हमेशा उपलब्ध या त्रुटिरहित रहेगा। क़ानून जहाँ तक अनुमति दे, आपके प्रति हमारा कुल दायित्व दावे से पहले के 12 महीनों में आपके द्वारा हमें दी गई राशि तक सीमित है। उपभोक्ता क़ानून के आपके अधिकार इससे सीमित नहीं होते।',
      ] },
      { h: '8. उपयोग समाप्त करना', p: [
        'आप कभी भी ऐप का उपयोग बंद कर सकते हैं और खाता हटा सकते हैं। शर्तें तोड़ने पर हम पहुँच निलंबित या समाप्त कर सकते हैं।',
      ] },
      { h: '9. क़ानून और विवाद', p: [
        `ये शर्तें भारत के क़ानूनों के अधीन हैं। विवाद ${v.city} के न्यायालयों के अधिकार क्षेत्र में होंगे। कृपया पहले ${v.email} पर हमसे संपर्क करें; अधिकतर समस्याएँ जल्दी सुलझ जाती हैं।`,
      ] },
      { h: '10. बदलाव', p: [
        'हम ये शर्तें बदल सकते हैं। ऊपर की तिथि बदलेगी और बड़े बदलावों की सूचना ऐप में दी जाएगी। उपयोग जारी रखने का अर्थ है नई शर्तें स्वीकार करना।',
      ] },
    ],
  }),

  refunds: (v) => ({
    title: 'रद्दीकरण और रिफ़ंड नीति',
    lead: `${v.app} प्रीमियम सब्सक्रिप्शन के लिए। प्रभावी तिथि ${v.date}।`,
    sections: [
      { h: 'रद्द करना', p: [
        'आप ऐप में प्रोफ़ाइल → प्रीमियम से या प्रीमियम पेज पर कभी भी सब्सक्रिप्शन रद्द कर सकते हैं। रद्द करने से आगे के नवीनीकरण रुक जाते हैं; भुगतान की गई अवधि के अंत तक प्रीमियम चलता रहता है। खाता हटाने से भी सब्सक्रिप्शन रद्द हो जाता है।',
      ] },
      { h: 'रिफ़ंड', ul: [
        'शुरू हो चुकी अवधि का भुगतान वापस नहीं होता, नीचे बताई स्थितियों या क़ानूनी आवश्यकता को छोड़कर।',
        'दो बार शुल्क कटा हो, रद्द करने के बाद शुल्क कटा हो, या भुगतान के बाद भी प्रीमियम न मिला हो, तो 30 दिन में लिखें, हम पूरा शुल्क लौटाएँगे।',
        'ग़लती से नवीनीकरण हुआ हो और उसके बाद आपने प्रीमियम उपयोग न किया हो, तो नवीनीकरण के 7 दिन में लिखें, पूरा रिफ़ंड मिलेगा।',
        `स्वीकृत रिफ़ंड 5–7 कार्य दिवसों में मूल भुगतान माध्यम में लौटते हैं। अपने खाते के ईमेल और Razorpay भुगतान ID के साथ ${v.email} पर लिखें।`,
      ] },
      { h: 'डिलीवरी', p: [
        'प्रीमियम एक डिजिटल सेवा है। भुगतान की पुष्टि होते ही यह आपके खाते पर चालू हो जाती है; कुछ भी भेजा नहीं जाता।',
      ] },
    ],
  }),

  contact: (v) => ({
    title: 'संपर्क करें',
    lead: 'प्रश्न, किसी लेख में सुधार, बिलिंग समस्या या गोपनीयता अनुरोध: हम आमतौर पर 2 कार्य दिवसों में उत्तर देते हैं।',
    sections: [
      { h: 'सहायता', p: [`ईमेल: ${v.email}`] },
      { h: 'शिकायत अधिकारी', p: [`${v.officer}<br>ईमेल: ${v.email}`] },
      { h: 'पता', p: [`${v.operator}<br>${v.address}`] },
    ],
  }),

  deleteAccount: (v) => ({
    title: 'अपना खाता हटाएँ',
    lead: `आप अपना ${v.app} खाता यहाँ, या ऐप में प्रोफ़ाइल → खाता हटाएँ से हटा सकते हैं।`,
    sections: [
      { h: 'क्या हटेगा', ul: [
        'आपका खाता: नाम, ईमेल और पासवर्ड या Google/Apple साइन-इन।',
        'क्विज़, मॉक टेस्ट और अभ्यास का इतिहास, अंक, स्ट्रीक और लीडरबोर्ड प्रविष्टियाँ।',
        'बुकमार्क, सेटिंग्स और सूचना टोकन।',
      ] },
      { h: 'क्या रखा जाएगा', p: [
        'प्रीमियम लिया हो तो सब्सक्रिप्शन और भुगतान रिकॉर्ड (प्लान, तिथियाँ, Razorpay ID) कर क़ानून के अनुसार रखे जाते हैं, आपकी किसी गतिविधि के बिना। चालू सब्सक्रिप्शन पहले रद्द होता है। बैकअप 30 दिन में मिट जाते हैं।',
      ] },
    ],
    form: true,
  }),

  ui: {
    lang: 'English', langHref: '?', notSet: 'सेट नहीं', updated: 'प्रभावी',
    nav: { privacy: 'गोपनीयता', terms: 'शर्तें', refunds: 'रिफ़ंड', contact: 'संपर्क', deleteAccount: 'खाता हटाएँ' },
    form: {
      email: 'खाते का ईमेल', send: 'मुझे कोड ईमेल करें', code: '6 अंकों का कोड', confirm: 'मेरा खाता स्थायी रूप से हटाएँ',
      sent: 'यदि कोई खाता इस ईमेल से है, तो उस पर कोड भेज दिया गया है। यह 15 मिनट में समाप्त होगा।',
      done: 'आपका खाता हटा दिया गया है।', warn: 'इसे वापस नहीं किया जा सकता।', failed: 'कुछ गड़बड़ हुई। फिर कोशिश करें।',
    },
    binding: 'यह अनुवाद सुविधा के लिए है। किसी अंतर की स्थिति में अंग्रेज़ी संस्करण मान्य होगा।',
  },
};

module.exports = { en, hi };
