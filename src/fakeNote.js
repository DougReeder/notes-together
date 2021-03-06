// fake notes for testing
// Copyright © 2020 by Doug Reeder

function movieNote() {
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

  return {
    id: Math.ceil((1 - Math.random()) * Number.MAX_SAFE_INTEGER),
    text: text,
    date: new Date(Date.now() + (Math.random()*32 - 31) * 24*60*60*1000)
  }
}

function listNote() {
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

  return {
    id: Math.ceil((1 - Math.random()) * Number.MAX_SAFE_INTEGER),
    text: text,
    date: new Date(Date.now() + (Math.random()*32 - 31) * 24*60*60*1000)
  }
}

function randomNote() {
  if (Math.random() < 0.7) {
    return movieNote();
  } else {
    return listNote();
  }
}

function emphasizeTitle(titleText, suffix) {
  suffix = suffix ? suffix : '';

  const r = Math.random();
  if (r < 0.2) {
    return "<b>" + titleText + "</b>" + suffix + "\n";
  } else if (r < 0.4) {
    return '<i>' + titleText + '</i>' + suffix + '\n';
  } else if (r < 0.5) {
    return '<h2>' + titleText + suffix + '</h2>\n';
  } else if (r < 0.6) {
    return '<h3>' + titleText + suffix + '</h3>\n';
  } else {
    return titleText + suffix + '\n';
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
  "Dr."
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
  "Women",
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
];

const sentences = [
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
  "Several of the books are almagated into this movie.",
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
];

export  {movieNote, listNote, randomNote};
