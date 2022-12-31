// fillerNotes.js - filler note creation for Notes Together
// Copyright © 2021 Doug Reeder

import {v4 as uuidv4} from "uuid";
import {createMemoryNote} from "./Note";
import {upsertNote} from './storage';


async function seedNotes() {
  console.info("IDB seeding notes");
  const random = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  random[15] = 2;
  await upsertNote({id: uuidv4({random}), content: "<h1>The rain in Spain</h1><p>stays mainly in the plain</p>", mimeType: 'text/html;hint=SEMANTIC'});
  random[15] = 3;
  await upsertNote({
    id: uuidv4({random}),
    content: "<ul><li>H<sub>2</sub>O</li><li>C³I</li><li>2º libro, la Calle 3ª</li><li>grüßen",
    mimeType: 'text/html;hint=SEMANTIC'
  });
  random[15] = 4;
  await upsertNote({
    id: uuidv4({random}), content: `<p>Lincoln's Gettysburg Address</p><blockquote>
    <p><s>Eighty-seven years ago</s>Four score and seven years ago our fathers brought forth on this continent a new nation, conceived in Liberty, and dedicated to the proposition that all men are created equal.</p>

    <p>Now we are engaged in a great civil war, testing whether that nation or any nation so conceived and so dedicated, can long endure. We are met on a great battle-field of that war. We have come to dedicate a portion of that field, as a final resting place for those who here gave their lives that that nation might live. It is altogether fitting and proper that we should do this.

    <p>But, in a larger sense, we can not dedicate—we can not consecrate—we can not hallow—this ground. The brave men, living and dead, who struggled here, have consecrated it, far above our poor power to add or detract. The world will little note, nor long remember what we say here, but it can never forget what they did here. It is for us the living, rather, to be dedicated here to the unfinished work which they who fought here have thus far so nobly advanced. It is rather for us to be here dedicated to the great task remaining before us—that from these honored dead we take increased devotion to that cause for which they gave the last full measure of devotion—that we here highly resolve that these dead shall not have died in vain—that this nation, under God, shall have a new birth of freedom—and that government of the people, by the people, for the people, shall not perish from the earth.`,
    mimeType: 'text/html;hint=SEMANTIC'
  });
  random[15] = 7;
  await upsertNote({id: uuidv4({random}), content: "<dl><dt>Here we go</dt><dd>gathering nuts in May", mimeType: 'text/html;hint=SEMANTIC'});
  random[15] = 8;
  await upsertNote({
    id: uuidv4({random}),
    content: "<pre>The dao that is seen\nis not the true dao\nuntil you bring fresh toner",
    mimeType: 'text/html;hint=SEMANTIC',
    isLocked: true,
  });
  random[15] = 11;
  await upsertNote({
    id: uuidv4({random}),
    content: "These are the times that try men's souls. The summer soldier and the sunshine patriot will, in this crisis, shrink from the service of their country; but he that stands it now, deserves the love and thanks of man and woman."
  });   // no mimeType, like Litewrite
  random[15] = 12;
  await upsertNote({
    id: uuidv4({random}), content: `<p>tensile structures
<svg fill="none" stroke-linecap="square" stroke-miterlimit="10" version="1.1" viewBox="0 0 226.77 226.77" xmlns="http://www.w3.org/2000/svg">
 <g transform="translate(8.964 4.2527)" fill-rule="evenodd" stroke="#000" stroke-linecap="butt" stroke-linejoin="round" stroke-width="4">
  <path d="m63.02 200.61-43.213-174.94 173.23 49.874z"/>
  <path d="m106.39 50.612 21.591 87.496-86.567-24.945z"/>
  <path d="m84.91 125.03-10.724-43.465 43.008 12.346z"/>
  <path d="m63.458 38.153 10.724 43.465-43.008-12.346z"/>
  <path d="m149.47 62.93 10.724 43.465-43.008-12.346z"/>
  <path d="m84.915 125.06 10.724 43.465-43.008-12.346z"/>
 </g>
</svg>
</p>
`, mimeType: 'text/html;hint=SEMANTIC'
  });

  random[15] = 13;
  await upsertNote({
    id: uuidv4({random}),
    content: `{\\rtf1\\ansi{\\fonttbl\\f0\\fswiss Helvetica;}\\f0\\pard
 This is some {\\b RTF} text.\\par
 }`,
    title: 'This is some RTF text.',
    mimeType: 'text/rtf'
  });

  random[15] = 15;
  await upsertNote({
    id: uuidv4({random}),
    content: "<h1>Star Trek II: The Wrath of Khan</h1><p>the best of everything that was best about Star Trek TOS</p><p>adventure, science-fiction</p>",
    mimeType: 'text/html;hint=SEMANTIC'
  });
  random[15] = 16;
  await upsertNote({
    id: uuidv4({random}), content: `<p> The <ruby> 漢 <rp>(</rp><rt>Kan</rt><rp>)</rp> 字 <rp>(</rp><rt>ji</rt><rp>)</rp></ruby> for tomorrow is <ruby> 明日 <rp>(</rp><rt>Ashita</rt><rp>)</rp></ruby> </p>`, mimeType: 'text/html;hint=SEMANTIC'
  });
  random[15] = 19;
  await upsertNote({
    id: uuidv4({random}),
    content: "<h2>Star Trek III: The Search for Spock</h2><p>has difficulties standing on its own; it relies heavily on knowledge of <em>Khan</em>.</p><p>adventure, science-fiction</p>",
    mimeType: 'text/html;hint=SEMANTIC'
  });
  random[15] = 20;
  await upsertNote({
    id: uuidv4({random}),
    content: "<h3>Star Trek IV: The Voyage Home</h3><p>the funniest of all the star trek films due to the fact that it is played totally tongue in cheek</p><p>adventure, science-fiction</p>",
    mimeType: 'text/html;hint=SEMANTIC'
  });
  random[15] = 23;
  await upsertNote({
    id: uuidv4({random}),
    content: "<h4>Star Wars: Episode IV - A New Hope</h4><p>the characters I liked most in this one are old Obi-Wan Kenobi, wonderfully portrayed by Alec Guinness, and Han Solo</p><p>adventure, science-fiction</p>",
    mimeType: 'text/html;hint=SEMANTIC'
  });
}


function randomNote() {
  const random = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, Math.floor(Math.random()*256), Math.floor(Math.random()*256), Math.floor(Math.random()*256)];
  const id = uuidv4({random});
  const content = Math.random() < 0.666 ? movieText() : listText();
  const date = new Date(Date.now() + (Math.random()*32 - 31) * 24*60*60*1000);

  if (/<[a-z]+[^>]*>/.test(content)) {
    return upsertNote(createMemoryNote(id, content, date, 'text/html;hint=SEMANTIC'));
  } else {
    return upsertNote(createMemoryNote(id, content, date));
  }
}

function movieText() {
  let text = '';
  if (Math.random() < 0.5) {
    const titleText = titleA[Math.floor(Math.random() * titleA.length)] + " " +
        titleB[Math.floor(Math.random() * titleB.length)] +
        (Math.random() > 0.85 ? (" " + Math.floor(2 + Math.random() * 2)) : "");
    text = emphasizeTitle(titleText, " (" + Math.floor(1950 + Math.random() * 70) + ")");
  }

  const numParagraphs = Math.floor(Math.exp(Math.random()*1.5));
  for (let i=0; i<numParagraphs; ++i) {
    text += "<p>";
    const numSentences = Math.floor(Math.exp(Math.random()*(2-numParagraphs/10)));
    for (let j=0; j<numSentences; ++j) {
      text += sentences[Math.floor(Math.random() * sentences.length)] + "  ";
    }
    text += "</p>\n";
  }

  return text;
}

function listText() {
  let text = '';

  if (Math.random() < 0.5) {
    const titleText = titleA[Math.floor(Math.random() * titleA.length)] + " " +
        titleB[Math.floor(Math.random() * titleB.length)];
    let suffix = '';
    if (Math.random() < 0.4) {
      suffix = ' ' + titleB[Math.floor(Math.random() * titleB.length)];
    }
    text = emphasizeTitle(titleText, suffix);
  }

  const listType = Math.random() > 0.5 ? '<ol>' : '<ul>';
  text += listType;
  const numItems = 1 + Math.floor(Math.exp(Math.random()*2));
  for (let i=0; i<numItems; ++i) {
    text += '<li>' + sentences[Math.floor(Math.random() * sentences.length)] + '</li>';
  }
  text += listType === '<ol>' ? '</ol>' : '</ul>';

  return text;
}

function emphasizeTitle(titleText, suffix) {
  suffix = suffix ? suffix : '';

  const r = Math.random();
  if (r < 0.1) {
    return "<p><b>" + titleText + "</b>" + suffix + "</p>\n";
  } else if (r < 0.2) {
    return '<p><i>' + titleText + '</i>' + suffix + '</p>\n';
  } else if (r < 0.4) {
    return '<h1>' + titleText + '<i>' + suffix + '</i></h1>\n';
  } else if (r < 0.6) {
    return '<h2>' + titleText + suffix + '</h2>\n';
  } else if (r < 0.8) {
    return '<h3>' + titleText + suffix + '</h3>\n';
  } else {
    return '<p>' + titleText + suffix + '</p>\n';
  }
}

const titleA = [
  "North",
  "South",
  "East",
  "West",
  "Spring",
  "Summer",
  "Autumn",
  "Winter",
  "Sunset",
  "Dawn",
  "Light",
  "Dark",
  "Shadow",
  "Song of",
  "Resounding",
  "Secret",
  "Silence of",
  "Shining",
  "Scintillating",
  "Cathedral of",
  "Beautiful",
  "Sparkling",
  "Uncommon",
  "Strange",
  "Star",
  "A New",
  "Return of",
  "Revenge of",
  "Phantom",
  "Attack of",
  "The Wrath of",
  "The Search for",
  "Final",
  "Undiscovered",
  "The Lord of the",
  "Fellowship of",
  "One",
  "The Only",
  "Return of the",
  "Absence of",
  "African",
  "Angry",
  "City",
  "City of",
  "Alien",
  "Spirit",
  "Past",
  "Ancient",
  "Medieval",
  "Modern",
  "Future",
  "Return to",
  "Instrument",
  "General",
  "Broken",
  "Dr.",
  "Virtual",
  "Mind",
  "Woman of",
  "Gathering",
  "Infinity",
];

const titleB = [
  "Equinox",
  "Destiny",
  "Sonnet",
  "Lamentation",
  "Living",
  "Echo",
  "Conjunction",
  "Thought",
  "Night",
  "Day",
  "Noon",
  "Watchman",
  "Wars",
  "Trek",
  "Insurrection",
  "Hope",
  "Menace",
  "Frontier",
  "Country",
  "Nemesis",
  "Legacy",
  "King",
  "Malice",
  "Queen",
  "Africa",
  "Redemption",
  "Knight",
  "Samurai",
  "Men",
  "Man",
  "Women",
  "Woman",
  "Girl",
  "Girls",
  "Boy",
  "Boys",
  "Matrix",
  "City",
  "Profession",
  "Memory",
  "Lights",
  "Departed",
  "General",
  "Warrior",
  "Soldier",
  "Gladiator",
  "Avenger",
  "Patriot",
  "Truth",
  "Iron",
  "Maker",
];

const sentences = [
  "A shallow cash-grab.",
  "Continually surprises.",
  "Familiar tropes combined in unexpected ways.",
  "The settings are stunning.",
  "Flammable — explosive — a must-see.",
  "The whole is less than the sum of the parts.",
  "The characters I liked most in this one are old Oliver, wonderfully portrayed by Alec Guinness, and Hammond.",
  "I never found Oliver's explanation of his lie to be convincing.",
  "The rescue in Texas is great, but didn't we already see an attack on a fort?",
  "Not what I was hoping for, but it's ok action.",
  "George Lucas's puerile script brings the actors to their knees, and his lack of direction makes them stay there.",
  "Starting with fights and ending with politics is a bit of a downer.",
  "Nowhere near as much fun as the sequel.",
  '<span style="font-size:larger">Not as much humour as the prequel.</span>',
  "The best of everything that was best about the franchise",
  "Has difficulties standing on its own; it relies heavily on knowledge of the previous movie.",
  "The funniest of all the films due to the fact that it is played totally tongue in cheek.",
  "A TV plot is stretched to movie length.",
  "Several of the books are amalgamated into this movie.",
  "One song (however good) is not enough to base a movie on.",
  "A film that tries hard but ultimately fails due to poor plotting, sub-par special effects and poor character development.",
  "As the series so often does, the events depicted mirror the glasnost of the late 1980s.",
  "Outside of the uneventful meeting between the two captains, and one's poorly-conceived demise, I find it an enjoyable film to watch.",
  "The on-screen relationship between Pirenne &amp; Lily is totally magic.",
  "Frakes and Sirtis have great chemistry together.",
  "Brent Spiner gets (as usual) too much screen time.",
  "You could look at it as a triumphant return to form, filled with all the action and humanism we've come to expect from these films, or you could look at it as a clumsy rehash of plot elements from the second movie.",
  "A reboot, but it's still much the same.",
  "Mainly a fast paced action film interspersed with scenes of human interest.",
  "A tepid adventure with awesome visuals.",
  "Man goes online to download the girlfriend his father picked out for him.",
  "Considering the budget, for an animated movie, it's not bad.",
  "Never before have I felt so much at home in a movie, it is as if I had taken a walk in the town where I grew up.",
  "The deuteragonist looks so creepy and realistic.",
  "As with the first two, the film is very long, but goes by without you ever truly realizing it.",
  "The two people this film really belongs to are Balaban and Brimley.",
  "The Best of Hepburn and Tracy.",
  "Spencer Tracy, with his confident and relaxed screen presence, paints Adam as a man quite comfortable with his wife's force and ambition.",
  "Merry and witty, tender and bold, impudent, dashing and brightly clad.",
  "Follows the C.S. Forester novel closely.",
  "I'm profoundly moved by this simple and eloquent depiction of hope and friendship and redemption.",
  "Marlon Brando comes across perfectly as the head of the family",
  "More of a companion piece to the original than a sequel.",
  "Carlos has become a bit naive and everyone double-crosses him.",
  "Tarantino put into the film whatever struck his fancy, and somehow the final product is not only coherent but wonderfully textured.",
  "A morality play.",
  "Tries too hard to be gritty.",
  "Fails to live up to the original.",
  "An excellent courtroom drama with a unique twist.",
  "Liam Neeson as Stanley is incredible.",
  "Dark and disturbing, however, it is equally smart and stylistic.",
  "I was surprised at how easily the film surpassed my expectations.",
  "Several sweet twists and unpredictable turns.",
  "A tour de force of breathtaking images, witty scriptwriting, superb acting and realistic violence.",
  "A good blend of action and drama.",
  "Violence has consequences.",
  "Entertaining, but I'm not sure what the point is, if any.",
  "Wouldn't cows be a better heat source? Without the ability to stage a revolt and all, you know.",
  "Characters are absolutely fascinating, very endearing, but also convincingly acted.",
  "Dark visual style.",
  "Intense plot development.",
  "Polished acting.",
  "Jodie Foster's performance holds the movie together.",
  "Sergio Leone singlehandedly redefines the western genre.",
  "A character study, centering on Rick.",
  "By the end, you find out the killer could have easily evaded any suspicion at all, which makes the movie pointless.",
  "Escapist fun at its best!",
  "The illusion of voyeurism holds our attention just as it held Hitchcock's.",
  "Stewart is brilliant as a small-town dreamer who loses and finds his way.",
  "Perkins skillfully crafts his performance.",
  "Perkins's performance is subtle, creepy, cool, and unsettling.",
  "Gripping story with well-crafted characters.",
  "A stunning work of art that splits the Hollywood sign in two and exposes a dream factory for what it really is: a struggle to both gain and keep notoriety in the limelight.",
  "You feel as though you are looking in on someones life in the course of 2 hours.",
  "Offers no answers or conclusions.",
  "Defies categorization.",
  "Dawn attack will always be a Hollywood classic.",
  "Is there a better person to play a robot than Arnold?",
  "The special effects are incredible beyond belief.",
  "A highly intelligent and original brain teaser.",
  "Pretty good historical fiction.",
  "I have heard in my elderly male patients express sentiments similar to what Cpt. Miller was expressing when he announced his ordinariness.",
  "The Little Tramp at his funniest, his bravest, his most romantic, and his most sympathetic.",
  "Makes you laugh at the impending doom of the Cold War.",
  "Every movement of the camera is breathtaking.",
  "The performances build a credible world centuries away.",
  "Breathes life into H.R. Giger's hallucinations.",
  "We discover the world as Chihiro does.",
  "Inhabitants of the fantastic world go about their daily business as usual as full with apathy as us normal folks.",
  "Chaplin at his best.",
  "Plight of the working classes during the Great Depression.",
  "Eva Marie Saint and Cary Grant have sizzling chemistry.",
  "The dialog crackles.",
  "So bad I asked Blockbuster for my money back - they did, but the clerk was appalled.",
  "Showed the cruelty of life and yet managed to shed some light and insight into the beauty of love and life in general.",
  "It was his sled.",
  "An intimidating and somewhat disappointing experience.",
  "The storyline is deceptively simple.",
  "Scared the life out of me.",
  "Surprisingly little violence.",
  "Sanderson is a man that we can all relate to. He is not a hero, he is not a rebel.",
  "Dad couldn't stop talking about how authentic the environment and attitude were.",
  "A masterpiece of visual drama.",
  "Terrific moody ambiance.",
  "Violent encounters are implied.",
  "Intelligent script.",
  "Hitchcock is in his very best form creating hypnotic scenes",
  "Kirk Douglas in his prime.",
  "More anti-arrogance than anti-war.",
  "Funny and warm in equal measure.",
  "It was born out of personal tragedy for Chaplin.",
  "Surprisingly watchable action movie.",
  "A commando raid on the eponymous train during the Civil War (loosely based on a real raid).",
  "The real history of the Roman caesars is melodramatic enough - why does Hollywood insist on making things up?",
  "The British crimefighting duo (not the superheroes).",
  "Not the “Braveheart 1776”  we hoped for.",
  "A fair-for-its-day drama with the aesop that whites and Indians should work together for peace.",
  "Trivializes war by turning it into a music video.",
  "The protagonist and his newfound friends trek across America to find success in Hollywood, but a sinister figure is after him.",
  "He's pedaling on his way to Hollywood.",
  "He embarks on a downward spiral of revolution and bloody crime.",
  "The sets are good, and the modelwork would be excellent with a bit more distressing.",
  "The storyline is ecological science fiction that deserved to be done: the last nature preserves are on space freighters near Saturn.",
  "Sadly, that’s all that’s good about this movie. The writing and acting paint Lowell as a Hollywood hippie - mad about the lack of nature in people’s lives, but a blank beyond that. The other characters are ciphers beyond their jobs (and are quickly offstage).",
  "The editing is incoherent - it’s not clear how much Lowell is responsible for the events that leave him alone with the last nature dome.",
  "The later challenge of dying plants is dumbed down for the audience so much that Lowell not immediately seeing the answer makes him grossly incompetent at his job and passion.",
  "Reviewers at the time gave it as many good reviews as bad. I can only guess that Hollywood, having just discovered environmentalism, lauded the first project coming down the road.",
  "Okay cyberpunk action-adventure, shading toward paramilitary action-adventure at the end.",
  "The characters are not terribly deep, but the two main characters, Cowboy, a smuggler pilot out of the Rockies, and Sarah, a bodyguard based in Florida, have some differences of outlook that carry some interest in the middle section.",
  "Cowboy believes he is living the last free life, while Sarah has had to struggle and compromise her values to survive on the dystopian future Earth.",
  "Williams could have done more with the difference of outlook, and made the movie deeper.",
  "The characters fail to come alive for me, partly because of their conventionality and the conventionality of their problems (Sarah is burdened by her brother Daud).",
  "You may find them more compelling than I.",
  "Cowboy and Sarah's romance is predictable, but competently done.",
  "The novel explicitly echos Zelazny's _Damnation Alley_ in places, and Williams acknowledges this.",
  "The happy ending with the ray of hope for Earth will come as a surprise to few.",
  "In the city of Veritas, everyone tells the truth (surprise!) because they are conditioned against saying anything untrue, or even disingenuous. Sample ad: \"Channel your violent impulses in a salutary direction - become a Marine...\".",
  "Jack Sperry is an art critic, a deconstructionist - he destroys old books, movies, statues and whatever else is not completely truthful.",
  "Martina Coventry writes greeting card messages and such, such as: I find you somewhat interesting, You're not too short or tall, And if you'd be my Valentine, I wouldn't mind at all.",
  "Given this setup, I hope you won't be too shocked when Sperry suddenly finds that he needs to lie to his dying son to keep him happy. (This isn't a spoiler.)",
  "Although the characters are very realistic and believable, <i>City of Truth</i> is more parable than fiction.",
  "Veritas is not a self-consistent future, it's a warped take on our world.",
  "Veritas is a rather grim place and Morrow appears to have a more negative view of people and relationships than I do, but this is saved from grimness by Morrow's wickedly funny honest statements, like the quotes above. It is certainly well-written, given its premise.",
  "I should think most people already realize the point Morrow makes by the end of the work, but I suppose some don't.",
  "It's like an embroidered tennis shoe. I admire the work that went into the stitching, but wonder why it was employed on such a mundane object.",
  "Sheffield piles a number of subplots onto a trite main plot: an experimental cyborg device goes insane, becomes implacably hostile to life, and must be tracked down and destroyed.",
  "Despite being the nominal plot conflict, the problem of the killer Morgan Construct is eventually shuffled off with a one-line rabbit out of a hat.",
  "Also, at the end, there is once again a Morgan Construct on the loose, but no one feels any need to go after it.",
  "It's much concerned with the three known races of aliens. However, they first appear to demand that the search teams for the Morgan Construct be composed of one member from each of the four races and the humans have no military training - an albatross-around-the-neck requirement which is not impossible, granting that aliens think differently, but one which is obviously there for literary reasons, not because it makes sense.",
  "In fact, the problem of humans and aliens learning to work together may be the main conflict of the book and the killer cyborg to be merely background.",
  "If this is what Sheffield intended, the beginning badly clashes with the rest, by presenting the cyborg plot as central. Also, then, the main plot would not start until halfway through the book.",
  "Sheffield's depictions of how the humans and aliens interact varies from believable at first to grossly implausible at the end.",
  "Small group interaction is a fertile ground for fiction; unfortunately toward the end Sheffield makes no attempt to describe anything realistic and postulates mystic alchemical results.",
  "The characters were very stagy: I never cared about what happened to them. This is not through lack of skill or effort - it feels like Sheffield is doing some weird artsy thing. You may be able to relate to them; I couldn't.",
  "However, after the premises are set and before the hunt begins in earnest, everybody is still gearing up and there is a fair amount of material I found enjoyable to read.",
  "Sheffield has put a good deal of effort into this, but his style is artsy and baroque.",
  "If the aforementioned problems do not bother you (they bothered me a great deal), you may enjoy this.",
  "In this future, Communist China is the dominant world power.",
  "Zheng Zhong Shan is an American homosexual engineer whose mother is Hispanic.",
  "He struggles to find a place in a world where he must hide both his sexuality and his ancestry.",
  "There is little in the way of a plot and the narrative switches every twenty minutes or so from Zhang to other viewpoint characters who interact only peripherally with him.",
  "Each of the other characters faces some problem (unrelated to Zhang's), which is resolved by their final sections and well before the end.",
  "Their narratives broaden the picture of the society, but fragment Zhang's story.",
  "Zhang is a very minor character in their stories, which I found most disconcerting, as was trying to remember who was what after hiatuses.",
  "McHugh unfortunately leaves the explanation of how this unexpected society came about until near the end, since the background is more plausible than it may at first seem.",
  "There are several science-fictive elements: direct brain-computer interfaces, Mars colonies, and towering latticework cities, but thematically this is less SF than East-meets-West, with China of a decade past projected onto America of two centuries hence.",
  "The characters are well drawn and the events very realistic, natural, and believable, but I found it difficult to identify with them, perhaps because their problems would not occur (at least to the extent they do) in our society.",
  "They accept their society as a fact of life and don't consider that it might be different, which is a common theme in science fiction and one which many readers will have in their minds.",
  "Economic collapse followed by revolution and the rejection of capitalism is not implausible, but that the U.S. would emulate modern-day China is much, much less so.",
  "I would find her society much more believable if it was set far in the future on some other planet, and did not require the reader to swallow a total reversal of current trends.",
  "Future societies which do not believe in our current values of freedom and tolerance can be fertile ground for fiction, but identifying one with our near future makes it very difficult to accept.",
  "The minimal plot and storyline fragmentation will cause many viewers problems.",
  "If the aforementioned elements do not throw you, you may find this interesting.",
  "A group of humans genetically engineered for free fall by GalacTech, a large corporation, are legally considered \"post-fetal tissue cultures\", i.e. property, not people. Invention of practical antigravity has rendered them obsolete. The 'quaddies' (they have extra arms instead of legs) are led to revolt by Leo Graf, a normal welding and non-destructive testing engineer.",
  "The characters are believable and well drawn, and their problems realistic, but they divide cleanly into good guys and bad guys, save for a few GalacTech employees (who play little role) who are loyal to the company but sympathetic to the quaddies.",
  "Bujold's most basic theme, people obsolescent by their genes, not their skills, is an important and fresh one. It forms the background for the work, but fails to have much impact because the only resultant is the good-guys/bad-guys conflict.",
  "Women with children are ill-represented in adventure stories, and Bujold shows why.",
  "She also shows an engineer at work, instead of having his results appear from offstage.",
  "The only problem I had with the movie was that it fails to develop its material.",
  "Short shrift is given to internal conflicts and disagreements of the quaddies and the divided loyalties of normal employees, to whom the quaddies are both work and friend, but who have little power to help them. (Admittedly, that's not the theme  but...)",
  "I found it a pleasant view, but on the light side.",
  "The setting combines the traditional FTL-spaceship-and-faster-FTL-communication element with a newer one: the world-wide computer network. The combination is surprising at first, but logical, given FTL communication and computers. (I dislike assumption of FTL technology; it's so unimaginative; FTL star-faring civilations look too much like our own.)",
  "This civilization has cut its ties with Earth, and lives in space habitats, except for various Reconstructionist movements (despised by the majority) who seek to reconstruct various cultures from Earth, usually colonizing planets to do so.",
  "The government (The Alliance) is apparently dominated by a small oligarchy who practice nepotism and prejudice against \"Recons\" (Reconstructionists). One the major themes is the tensions between the Recons and the rest of society; unfortunately we see almost nothing of ordinary society; all the significant non-Recon characters are in government Security. HuteNamid is the Recon planet where most of the action takes place, and the Recons there derive there cultural ideas from Native Americans.\n",
  "The characters are realistic; the conflict arises because the characters have differing goals. The oligarchy remains offstage.",
  "Admiral Loren Cantrell and her people of the security force is working to blunt the influence of the oligarchy.",
  "Stephen Ridenow's Recon heritage was hidden when he entered the academy at ten and now, ten very rough years later, is being graduated early for this mission.",
  "Dr. Wesley Smith and Dr. Paul Corlaney are non-Recon researchers on HuteNamid, each with his project to forward.",
  "Governor Sagiimagen Tyeewapi, his daughter Anevai, and Nayati Hatawa are three Recons of HuteNamid with different perspectives on how best to preserve independance of action for their planet.",
  "The plot involves missing data and a paper by Smith that could seriously affect the Net as the characters know it, and only Ridenow recognized its importance. As Cantrell, her team, and Ridenow investigate, more strange things turn up and everything gets complicated.",
  "It is difficult to follow all the information in the opening scenes, but persevere, it becomes clear before long. The setting seems unlikely at first, but makes sense once you get used to it.",
  "The work ends before all the loose ends are tied up; either there is a sequel in the works or Fancher has had to cut down a larger story, this being her first. This didn't bother me overmuch, as I wasn't working too hard at following all the plot lines.",
  "All in all, it's quite good for a first work and is well worth it if you like mature, realistic characters and plots. I will be on the lookout for more of her works.",
  "This has almost no plot. There is a conflict, but it does not develop; it is inherent in the situation at the beginning, though the reader (and characters!) are gradually brought to realize its importance. The characters do not develop or change. What, then is its interest? It shows (shows, not tells!) the viewer an alien race which is human enough to identify with, but not just humans in furry suits. And it does so with a very natural storyline that is much closer to the unpatterned sequence of events of real life (as opposed to the artistic patterning of most plots).",
  "I enjoyed it very much.",
  "The story takes place on an Earthlike planet of the star Sigma Draconis, 18.2 light years from Earth. It is inhabited by iron-age humanoids, the women of whom live in villages and the men of whom dwell alone. A 21st or 22nd century exploration ship from Earth has arrived after a 122 year journey. The ship technology is explained in an appendix, and the rest of the explorers' technology appears to be straightforward extensions of present technology. Western nations had collapsed and their inhabitants reverted to primitivism most of a century before the explorers left, but the Second and Third Worlds had progressed to form a peaceful world civilization.",
  "The main characters are two human anthropologists, Lixia (pronounced Lee-sha) and Derek, and two natives, Nia (Nee-ah) and Voice of the Waterfall, an oracle. The text brings the characters alive, but their motivations remain opaque, as real people so often do. Most of the story is narrated by Lixia, and one gets little bits of her personality, but she is not an initiator of things and comes across as a non-memorable person.",
  "The natural storyline is pleasantly non-predictable and almost entirely free of the trite progressions one is used to. At times this can get somewhat boring, since the \"action\" does not advance.",
  "I usually like a strong (but not stereotyped) plot, but I enjoyed this greatly, which is a tribute to Arnason's skill.",
  "The majority of the narrative is devoted to showing the character and attitudes of the aliens and Derek.",
  "The aliens' psychological makeup differs from humans in several important ways, but Arnason makes it interesting and easy to comprehend. Each of the four has a different attitude toward life. For much of the movie they are all in the same situation as each other; it is fascinating to watch them react differently and perceive events and people differently.",
  "More troubling is the is the lecturing on the evils of capitalism and how it was responsible for all the ecological troubles of the world. The lecturing is reasonable for the characters and their background, and makes sense given the characters' situation. The problem is that there is no character to defend 20th century Western society, which I feel has many positive elements that the characters do not mention. It should be noted that Arnason is not ramming the Daoism, Buddhism, and Marxism down the reader's throat; the main characters express their reservations. I just kept wanting to reply to the charges made by other characters. Furthermore, at the end there is an interesting development which softens the impact of the lecturing.",
  "I applaud Arnason for using a technological background that violates no laws of nature. Too many authors postulate an FTL drive or whatever else they need for convenience. Too much science fiction is unimaginative, postulating that travel around the galaxy will be about the same as travel around twentieth-century Earth.",
  "I recommend this, particularly if you are tired of stale plots and arbitrary technology. It is very refreshing."
];


function hammerStorage() {
  const random = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 255, 255, 255];
  const id = uuidv4({random});
  const fullText = `<p>To be, or not to be, that is the question:<br/>
Whether 'tis nobler in the mind to suffer<br/>
The slings and arrows of outrageous fortune,<br/>
Or to take arms against a sea of troubles<br/>
And by opposing end them.</p>`;
  const date = new Date(Date.now() + 24*60*60*1000);

  let i=0;
  const timer = setInterval(() => {
    // doesn't wait for promise to be fulfilled, as keyboard events don't wait
    upsertNote(createMemoryNote(id, fullText.slice(0, ++i), date, 'text/html;hint=SEMANTIC'));
    if (i>=fullText.length) {
      clearInterval(timer);
    }
  }, 55);
  // 146 ms/char = 82 wpm; average is 41
  // 55 ms/char = 218 wpm; fastest human is 216 wpm
}

export {seedNotes, randomNote, hammerStorage};
