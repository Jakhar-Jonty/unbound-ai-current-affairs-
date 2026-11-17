'use strict';
/**
 * Demo content for `npm run seed:demo`. These are explainers on settled, static UPSC
 * topics (no invented news events), so every fact here is true and checkable at the
 * linked official source. Keep it that way if you add more.
 */
module.exports = [
  {
    slug: 'demo-rbi-monetary-policy-committee',
    title: 'How the RBI’s Monetary Policy Committee sets the repo rate',
    summary: 'India’s policy repo rate is decided by a six-member Monetary Policy Committee (MPC) created by a 2016 amendment to the RBI Act, 1934. It works under a flexible inflation-targeting framework: the government sets a CPI inflation target of 4%, with a tolerance band of 2% to 6%. Three members are from the RBI and three are appointed by the Centre.',
    body: `The Monetary Policy Committee (MPC) is the body that decides the policy repo rate, the rate at which the Reserve Bank of India lends overnight to banks. It was set up under Section 45ZB of the RBI Act, 1934, inserted by the Finance Act, 2016, which moved India to a statutory framework of flexible inflation targeting.

Composition. The MPC has six members. Three are from the RBI: the Governor, who chairs it, a Deputy Governor in charge of monetary policy, and one officer nominated by the central board. The other three are external members appointed by the central government. Decisions are taken by majority vote; if the vote is tied, the Governor has a second or casting vote.

The target. The central government, in consultation with the RBI, sets the inflation target once every five years. The current target is 4% consumer price index (CPI) inflation, with a lower tolerance limit of 2% and an upper limit of 6%. If inflation stays outside the band for three consecutive quarters, the RBI must send a report to the government explaining why and what it will do.

How often it meets. The MPC must meet at least four times a year. In practice it meets six times, and the minutes of each meeting are published, including how each member voted.

Why it matters. The repo rate feeds through to bank lending and deposit rates, and so to borrowing, investment and inflation. The committee structure was meant to make rate decisions more predictable and accountable than when the Governor alone decided.`,
    keyPoints: [
      'MPC set up under Section 45ZB of the RBI Act, 1934 (inserted in 2016).',
      'Six members: three from the RBI (Governor chairs) and three appointed by the Centre.',
      'Governor has a casting vote in case of a tie.',
      'Inflation target: 4% CPI, tolerance band 2% to 6%, set by the Centre every five years.',
      'Must meet at least four times a year; minutes and votes are published.',
    ],
    upscRelevance: 'GS Paper III (Indian economy: monetary policy, inflation, mobilisation of resources). Prelims often tests the MPC’s composition, the inflation band and the legal basis.',
    gsPaper: 'GS3',
    subjects: ['economy'],
    keywords: ['MPC', 'repo rate', 'inflation targeting', 'RBI Act'],
    sources: [{ url: 'https://www.rbi.org.in/', publisher: 'Reserve Bank of India', title: 'Reserve Bank of India' }],
    factsToVerify: [
      'MPC constituted under Section 45ZB of the RBI Act, 1934',
      'Six members, three of them external members appointed by the central government',
      'Inflation target 4% CPI with a 2%–6% tolerance band',
      'MPC must meet at least four times a year',
    ],
    questions: [
      {
        stem: 'With reference to the Monetary Policy Committee (MPC) of India, consider the following statements:\n1. It was constituted under the Reserve Bank of India Act, 1934.\n2. All its members are officials of the Reserve Bank of India.\n3. The RBI Governor has a casting vote in case of a tie.\nWhich of the statements given above is/are correct?',
        options: ['1 only', '1 and 3 only', '2 and 3 only', '1, 2 and 3'],
        correctIndex: 1,
        explanation: 'Statement 1 is correct: the MPC was set up under Section 45ZB of the RBI Act, 1934 (inserted in 2016). Statement 2 is wrong: three of the six members are external members appointed by the central government. Statement 3 is correct: the Governor has a second or casting vote if votes are tied.',
        difficulty: 'medium',
      },
      {
        stem: 'Under India’s flexible inflation-targeting framework, what is the inflation target and its tolerance band?',
        options: ['4% CPI inflation, band of 2% to 6%', '4% WPI inflation, band of 2% to 6%', '5% CPI inflation, band of 3% to 7%', '6% CPI inflation, band of 4% to 8%'],
        correctIndex: 0,
        explanation: 'The target is 4% inflation measured by the consumer price index (CPI), with a lower limit of 2% and an upper limit of 6%. The wholesale price index (WPI) is not the target measure, and the other figures are not the notified target.',
        difficulty: 'easy',
      },
    ],
  },
  {
    slug: 'demo-gst-council',
    title: 'The GST Council: India’s experiment in cooperative federalism',
    summary: 'The GST Council is a constitutional body under Article 279A, inserted by the Constitution (101st Amendment) Act, 2016. Chaired by the Union Finance Minister, it recommends GST rates, exemptions and rules. Decisions need a three-fourths majority of weighted votes, with the Centre holding one-third of the weight and the states together two-thirds.',
    body: `The Goods and Services Tax (GST) replaced a range of central and state indirect taxes from 1 July 2017. Because both the Centre and the states levy GST, the Constitution created a joint forum to agree on how it works: the GST Council.

Legal basis. The Council is set up under Article 279A, which was inserted by the Constitution (101st Amendment) Act, 2016. It is a constitutional body.

Members. The Union Finance Minister chairs it. The Union Minister of State in charge of Revenue or Finance is a member, as is the minister in charge of finance or taxation (or another minister nominated) from each state.

Voting. One-half of the members make the quorum. A decision needs a majority of not less than three-fourths of the weighted votes of members present and voting. The Centre’s vote carries one-third of the total weight and all the states together carry two-thirds. This means neither the Centre nor the states can push a decision through alone.

What it decides. The Council recommends the taxes to be subsumed, the goods and services to be taxed or exempted, rates, thresholds and the rules for dispute settlement, among other things.

Are its recommendations binding? In Union of India v. Mohit Minerals (2022), the Supreme Court held that the Council’s recommendations have persuasive value and are not binding on Parliament and the state legislatures, since both can make laws on GST under Article 246A.`,
    keyPoints: [
      'Constitutional body under Article 279A (101st Amendment Act, 2016).',
      'Chaired by the Union Finance Minister; state finance or taxation ministers are members.',
      'Decisions need three-fourths of weighted votes; Centre one-third weight, states two-thirds.',
      'GST came into force on 1 July 2017.',
      'Mohit Minerals (2022): recommendations are persuasive, not binding.',
    ],
    upscRelevance: 'GS Paper II (federal structure, constitutional bodies) and GS Paper III (taxation). Questions often test Article 279A, the voting weights and the Mohit Minerals judgment.',
    gsPaper: 'GS2',
    subjects: ['polity', 'economy'],
    keywords: ['GST Council', 'Article 279A', '101st Amendment', 'cooperative federalism'],
    sources: [{ url: 'https://gstcouncil.gov.in/', publisher: 'GST Council', title: 'GST Council' }],
    factsToVerify: [
      'GST Council established under Article 279A',
      'Article 279A inserted by the Constitution (101st Amendment) Act, 2016',
      'Centre holds one-third of the weighted votes; states two-thirds; decisions need three-fourths',
      'Mohit Minerals (2022) held recommendations are not binding',
    ],
    questions: [
      {
        stem: 'Consider the following statements about the GST Council:\n1. It is a constitutional body under Article 279A.\n2. A decision requires a majority of not less than three-fourths of the weighted votes of members present and voting.\n3. The Centre’s vote carries two-thirds of the total weight.\nWhich of the statements given above is/are correct?',
        options: ['1 only', '1 and 2 only', '2 and 3 only', '1, 2 and 3'],
        correctIndex: 1,
        explanation: 'Statements 1 and 2 are correct. Statement 3 is wrong: the Centre’s vote carries one-third of the weight, and all states together carry two-thirds.',
        difficulty: 'medium',
      },
      {
        stem: 'In Union of India v. Mohit Minerals (2022), the Supreme Court held that the recommendations of the GST Council are:',
        options: ['Binding on Parliament but not on states', 'Binding on both Parliament and state legislatures', 'Of persuasive value and not binding', 'Binding only when passed unanimously'],
        correctIndex: 2,
        explanation: 'The Court held the recommendations have persuasive value only, because Parliament and state legislatures both have power to make GST laws under Article 246A. The other options misstate the judgment.',
        difficulty: 'medium',
      },
    ],
  },
  {
    slug: 'demo-fundamental-duties',
    title: 'Fundamental Duties: what Article 51A asks of every citizen',
    summary: 'Fundamental Duties were added to the Constitution by the 42nd Amendment Act, 1976, on the recommendation of the Swaran Singh Committee. They sit in Part IV-A, Article 51A. There were ten originally; an eleventh, on education for children aged 6 to 14, was added by the 86th Amendment Act, 2002. They are not directly enforceable by courts.',
    body: `The original Constitution had no list of citizens’ duties. In 1976 the Swaran Singh Committee recommended adding them, and the Constitution (42nd Amendment) Act, 1976 created a new Part IV-A with a single article, Article 51A.

What they are. Ten duties were added in 1976. They include respecting the Constitution, the National Flag and the National Anthem; upholding the sovereignty, unity and integrity of India; promoting harmony and renouncing practices derogatory to the dignity of women; protecting the natural environment; developing scientific temper; and safeguarding public property.

The eleventh duty. The Constitution (86th Amendment) Act, 2002 added an eleventh duty: a parent or guardian must provide opportunities for education to their child between six and fourteen years of age. The same amendment inserted Article 21A, making education a fundamental right for that age group.

Inspiration. The idea of fundamental duties is commonly traced to the Constitution of the former USSR.

Enforceability. Like the Directive Principles, Fundamental Duties are non-justiciable: courts cannot directly enforce them. Courts have, however, used them to interpret laws and to judge whether a restriction on a right is reasonable, and Parliament can make laws to give effect to them.

Who they apply to. Fundamental Duties apply only to citizens, unlike some Fundamental Rights that are available to all persons.`,
    keyPoints: [
      'Added by the 42nd Amendment Act, 1976, on the Swaran Singh Committee’s recommendation.',
      'Part IV-A, Article 51A.',
      'Ten originally; the eleventh (education for children aged 6–14) added by the 86th Amendment, 2002.',
      'Concept traced to the Constitution of the former USSR.',
      'Non-justiciable, and apply only to citizens.',
    ],
    upscRelevance: 'GS Paper II (Indian Constitution: features, amendments, significant provisions). A Prelims staple: the amendment, the committee, the number of duties and justiciability.',
    gsPaper: 'GS2',
    subjects: ['polity'],
    keywords: ['Fundamental Duties', 'Article 51A', '42nd Amendment', 'Swaran Singh Committee'],
    sources: [{ url: 'https://legislative.gov.in/constitution-of-india/', publisher: 'Legislative Department, Ministry of Law and Justice', title: 'Constitution of India' }],
    factsToVerify: [
      'Fundamental Duties added by the 42nd Amendment Act, 1976',
      'Recommended by the Swaran Singh Committee',
      'Eleventh duty added by the 86th Amendment Act, 2002',
    ],
    questions: [
      {
        stem: 'Which one of the following added the eleventh Fundamental Duty, relating to education for children aged six to fourteen?',
        options: ['42nd Amendment Act, 1976', '44th Amendment Act, 1978', '86th Amendment Act, 2002', '101st Amendment Act, 2016'],
        correctIndex: 2,
        explanation: 'The 86th Amendment Act, 2002 added the eleventh duty in Article 51A(k) and also inserted Article 21A. The 42nd Amendment added the first ten duties; the 44th Amendment dealt mainly with emergency provisions and property; the 101st Amendment introduced GST.',
        difficulty: 'easy',
      },
      {
        stem: 'Consider the following statements about Fundamental Duties:\n1. They were part of the original Constitution of 1950.\n2. They are contained in Part IV-A of the Constitution.\n3. They can be directly enforced by courts.\nWhich of the statements given above is/are correct?',
        options: ['1 and 2 only', '2 only', '2 and 3 only', '3 only'],
        correctIndex: 1,
        explanation: 'Only statement 2 is correct. Duties were added in 1976 by the 42nd Amendment, not in 1950, and they are non-justiciable, so courts cannot directly enforce them.',
        difficulty: 'easy',
      },
    ],
  },
  {
    slug: 'demo-right-to-privacy',
    title: 'Right to privacy: the Puttaswamy judgment and what followed',
    summary: 'In Justice K.S. Puttaswamy (Retd.) v. Union of India (2017), a nine-judge bench of the Supreme Court unanimously held that privacy is a fundamental right, protected as part of the right to life and personal liberty under Article 21 and the freedoms in Part III. The ruling shaped later debates on Aadhaar and led towards the Digital Personal Data Protection Act, 2023.',
    body: `Is privacy a fundamental right? Earlier benches had given different answers. In M.P. Sharma (1954, eight judges) and Kharak Singh (1962, six judges), the Supreme Court had said the Constitution did not guarantee a right to privacy. The question reached a nine-judge bench during the challenge to the Aadhaar scheme.

The judgment. On 24 August 2017, in Justice K.S. Puttaswamy (Retd.) v. Union of India, the nine-judge bench unanimously held that the right to privacy is a fundamental right. It is protected as an intrinsic part of the right to life and personal liberty under Article 21 and as part of the freedoms guaranteed by Part III. The bench overruled M.P. Sharma and Kharak Singh to the extent they held otherwise.

Not absolute. Like other rights, privacy can be restricted. The judgment set out a test for restrictions: there must be a law, the law must pursue a legitimate aim, and the restriction must be proportionate to that aim.

What followed. In 2018 a five-judge bench upheld the Aadhaar Act with changes, applying the Puttaswamy test. The judgment also recognised informational privacy and called for a data protection law. Parliament later enacted the Digital Personal Data Protection Act, 2023.`,
    keyPoints: [
      'Puttaswamy (2017): nine-judge bench, unanimous.',
      'Privacy is a fundamental right under Article 21 and Part III.',
      'Overruled M.P. Sharma (1954) and Kharak Singh (1962) on this point.',
      'Restrictions need a law, a legitimate aim and proportionality.',
      'Followed by the Digital Personal Data Protection Act, 2023.',
    ],
    upscRelevance: 'GS Paper II (Fundamental Rights, judiciary, significant judgments) and GS Paper IV (ethics and governance). Essential for questions on Article 21, data protection and Aadhaar.',
    gsPaper: 'GS2',
    subjects: ['polity', 'governance'],
    keywords: ['right to privacy', 'Puttaswamy', 'Article 21', 'data protection'],
    sources: [{ url: 'https://www.sci.gov.in/', publisher: 'Supreme Court of India', title: 'Supreme Court of India' }],
    factsToVerify: [
      'Puttaswamy decided by a nine-judge bench in 2017, unanimously',
      'Privacy held to be part of Article 21 and Part III',
      'Digital Personal Data Protection Act enacted in 2023',
    ],
    questions: [
      {
        stem: 'In Justice K.S. Puttaswamy (Retd.) v. Union of India (2017), the Supreme Court held the right to privacy to be:',
        options: [
          'A statutory right under the Information Technology Act, 2000',
          'A fundamental right protected under Article 21 and Part III',
          'A Directive Principle of State Policy',
          'A fundamental right available only to citizens under Article 19',
        ],
        correctIndex: 1,
        explanation: 'The nine-judge bench held privacy to be a fundamental right, intrinsic to life and personal liberty under Article 21 and part of the freedoms in Part III. It is not merely statutory, it is not a Directive Principle, and the ruling did not confine it to Article 19 or to citizens.',
        difficulty: 'easy',
      },
      {
        stem: 'Which earlier judgments did the Puttaswamy bench overrule to the extent they held that privacy is not a fundamental right?',
        options: ['Kesavananda Bharati and Minerva Mills', 'M.P. Sharma and Kharak Singh', 'Maneka Gandhi and A.K. Gopalan', 'Golaknath and Shankari Prasad'],
        correctIndex: 1,
        explanation: 'M.P. Sharma (1954) and Kharak Singh (1962) had said there was no constitutional right to privacy; Puttaswamy overruled them on that point. The other pairs are landmark cases on different questions (basic structure, procedure established by law, amending power).',
        difficulty: 'medium',
      },
    ],
  },
  {
    slug: 'demo-ramsar-convention',
    title: 'Ramsar Convention: how India protects wetlands of international importance',
    summary: 'The Ramsar Convention on Wetlands was signed in 1971 at Ramsar, Iran, and is the oldest of the modern global environmental treaties. India became a party in 1982. Chilika Lake (Odisha) and Keoladeo National Park (Rajasthan) were India’s first Ramsar sites, designated in 1981. World Wetlands Day is observed on 2 February, the date the convention was signed.',
    body: `Wetlands, such as lakes, marshes, mangroves and floodplains, store water, recharge groundwater, buffer floods, hold carbon and support fisheries and birds. The Ramsar Convention is the international treaty for their conservation and wise use.

Origins. The Convention on Wetlands of International Importance was signed on 2 February 1971 at Ramsar, a city in Iran. That date is now marked every year as World Wetlands Day. It is the oldest of the modern global intergovernmental environmental agreements.

How it works. Each party designates at least one wetland of international importance, a Ramsar site, and commits to its conservation and wise use. Sites where ecological character is changing, or is likely to change, because of human activity can be placed on the Montreux Record, a register of sites needing priority attention.

India and Ramsar. India became a party in 1982. Its first two Ramsar sites, Chilika Lake in Odisha and Keoladeo National Park in Rajasthan, were designated in 1981. Keoladeo and Loktak Lake (Manipur) are on the Montreux Record; Chilika was placed on it and later removed after its restoration. India has added many sites in recent years, so check the current count on the Ramsar Sites Information Service before an exam.

At home. In India, wetlands are regulated under the Wetlands (Conservation and Management) Rules, 2017, made under the Environment (Protection) Act, 1986.`,
    keyPoints: [
      'Signed on 2 February 1971 at Ramsar, Iran; World Wetlands Day is 2 February.',
      'India became a party in 1982.',
      'First Indian sites: Chilika Lake and Keoladeo National Park (1981).',
      'Montreux Record lists sites needing priority attention; Keoladeo and Loktak are on it.',
      'Domestic framework: Wetlands (Conservation and Management) Rules, 2017.',
    ],
    upscRelevance: 'GS Paper III (environment, conservation, international conventions) and Prelims environment questions on Ramsar sites, the Montreux Record and wetland rules.',
    gsPaper: 'GS3',
    subjects: ['environment', 'geography'],
    keywords: ['Ramsar Convention', 'wetlands', 'Montreux Record', 'Chilika', 'Keoladeo'],
    sources: [{ url: 'https://www.ramsar.org/', publisher: 'Ramsar Convention Secretariat', title: 'The Convention on Wetlands' }],
    factsToVerify: [
      'Convention signed on 2 February 1971 at Ramsar, Iran',
      'India became a party in 1982',
      'Chilika and Keoladeo designated in 1981 as India’s first Ramsar sites',
      'Keoladeo and Loktak are on the Montreux Record',
    ],
    questions: [
      {
        stem: 'Consider the following statements about the Ramsar Convention:\n1. It was signed in 1971 at Ramsar, Iran.\n2. World Wetlands Day is observed on the anniversary of its signing.\n3. The Montreux Record lists wetlands that have been removed from the Ramsar list.\nWhich of the statements given above is/are correct?',
        options: ['1 only', '1 and 2 only', '2 and 3 only', '1, 2 and 3'],
        correctIndex: 1,
        explanation: 'Statements 1 and 2 are correct: the convention was signed on 2 February 1971 at Ramsar, and 2 February is World Wetlands Day. Statement 3 is wrong: the Montreux Record lists Ramsar sites whose ecological character is changing and that need priority attention; it is not a list of removed sites.',
        difficulty: 'medium',
      },
      {
        stem: 'Which of the following pairs were India’s first two Ramsar sites?',
        options: ['Chilika Lake and Keoladeo National Park', 'Loktak Lake and Wular Lake', 'Sundarbans and Chilika Lake', 'Keoladeo National Park and Sambhar Lake'],
        correctIndex: 0,
        explanation: 'Chilika Lake (Odisha) and Keoladeo National Park (Rajasthan) were designated in 1981. Loktak, Wular, Sambhar and the Sundarbans were all designated later.',
        difficulty: 'easy',
      },
    ],
  },
];
