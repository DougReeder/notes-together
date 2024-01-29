// assembleNote.test.js — automated test for construction of a single note from multiple parts
// Copyright © 2024 Doug Reeder under the MIT License
// noinspection SqlNoDataSourceInspection

import {assembleNote} from "./assembleNote.js";
import {dataURItoFile} from "./util/testUtil.js";

const TEXT1 = `Friends and Citizens:
The period for a new election of a citizen to administer the executive government of the United States being not far distant, and the time actually arrived when your thoughts must be employed in designating the person who is to be clothed with that important trust, it appears to me proper, especially as it may conduce to a more distinct expression of the public voice, that I should now apprise you of the resolution I have formed, to decline being considered among the number of those out of whom a choice is to be made.
I beg you, at the same time, to do me the justice to be assured that this resolution has not been taken without a strict regard to all the considerations appertaining to the relation which binds a dutiful citizen to his country; and that in withdrawing the tender of service, which silence in my situation might imply, I am influenced by no diminution of zeal for your future interest, no deficiency of grateful respect for your past kindness, but am supported by a full conviction that the step is compatible with both. `;

const TEXT2 = `The acceptance of, and continuance hitherto in, the office to which your suffrages have twice called me have been a uniform sacrifice of inclination to the opinion of duty and to a deference for what appeared to be your desire. I constantly hoped that it would have been much earlier in my power, consistently with motives which I was not at liberty to disregard, to return to that retirement from which I had been reluctantly drawn. The strength of my inclination to do this, previous to the last election, had even led to the preparation of an address to declare it to you; but mature reflection on the then perplexed and critical posture of our affairs with foreign nations, and the unanimous advice of persons entitled to my confidence, impelled me to abandon the idea.
I rejoice that the state of your concerns, external as well as internal, no longer renders the pursuit of inclination incompatible with the sentiment of duty or propriety, and am persuaded, whatever partiality may be retained for my services, that, in the present circumstances of our country, you will not disapprove my determination to retire.
The impressions with which I first undertook the arduous trust were explained on the proper occasion. In the discharge of this trust, I will only say that I have, with good intentions, contributed towards the organization and administration of the government the best exertions of which a very fallible judgment was capable. Not unconscious in the outset of the inferiority of my qualifications, experience in my own eyes, perhaps still more in the eyes of others, has strengthened the motives to diffidence of myself; and every day the increasing weight of years admonishes me more and more that the shade of retirement is as necessary to me as it will be welcome. Satisfied that if any circumstances have given peculiar value to my services, they were temporary, I have the consolation to believe that, while choice and prudence invite me to quit the political scene, patriotism does not forbid it.
`;

const YAML = `development:
  adapter: async
test:`;

const HTML = `<h2>Series Name</h2><h1>The Main Title</h1><p>I guess we have to <i>include</i> content.</p>`;

const SVG = `<svg width="300" height="200" xmlns="http://www.w3.org/2000/svg">
<circle cx="150" cy="100" r="80" fill="green" />
</svg>`;
const DATA_URL_SVG = 'data:image/svg+xml;base64,' + btoa(SVG);

const DATA_URL_DOT = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQMAAAAl21bKAAAABlBMVEUAAAD///+l2Z/dAAAACXBIWXMAAAAAAAAAAACdYiYyAAAACklEQVR4nGNgAAAAAgABSK+kcQAAAABJRU5ErkJggg==';

const RTF = `{\\rtf1\\mac\\ansicpg10000\\cocoartf102
{\\fonttbl\\f0\\fswiss\\fcharset77 Helvetica;}
{\\colortbl;\\red255\\green255\\blue255;}
\\margl1440\\margr1440\\vieww9000\\viewh9000\\viewkind0
\\pard\\tx720\\tx1440\\tx2160\\tx2880\\tx3600\\tx4320\\tx5040\\tx5760\\tx6480\\tx7200\\tx7920\\tx8640\\ql\\qnatural

\\f0\\fs24 \\cf0 Guests of many hue//Who do they want to be now?//I am so confused.}`;

const SQL = `CREATE TABLE APP.CITIES
   (
      CITY_ID          INTEGER NOT NULL constraint cities_pk primary key,
      CITY_NAME        VARCHAR(24) NOT NULL,
      COUNTRY          VARCHAR(26) NOT NULL,
      AIRPORT          VARCHAR(26),
      LANGUAGE         VARCHAR(16),
      COUNTRY_ISO_CODE CHAR(2) 
   );

insert into APP.CITIES VALUES (1,'Amsterdam','Netherlands','AMS','Dutch','NL');
insert into APP.CITIES VALUES (2,'Athens','Greece','ATH','Greek','GR');
insert into APP.CITIES VALUES (3,'Auckland','New Zealand','AKL','English','NZ');
`;

// const PDF = `%PDF-1.4
// %äüöß
// 2 0 obj
// <</Length 3 0 R/Filter/FlateDecode>>`;


describe("assembleNote", () => {
  it("should make each line of the text field a paragraph", async () => {

    const nodeNote = await assembleNote("Washington's Farewell Address", TEXT1, "", []);

    expect(nodeNote.subtype).toMatch(/^html/);
    expect(nodeNote.nodes).toHaveLength(4);
    expect(nodeNote.nodes[0]).toEqual({type: 'heading-one', children: [{text: "Washington's Farewell Address"}]});
    expect(nodeNote.nodes[1]).toEqual({type: 'paragraph', children: [{text: "Friends and Citizens:"}]});
    expect(nodeNote.nodes[2].type).toEqual('paragraph');
    expect(nodeNote.nodes[2].children).toHaveLength(1);
    expect(nodeNote.nodes[2].children[0].text).toMatch(/^The period for a new election/);
    expect(nodeNote.nodes[3].type).toEqual('paragraph');
    expect(nodeNote.nodes[3].children).toHaveLength(1);
    expect(nodeNote.nodes[3].children[0].text).toMatch(/^I beg you/);
  });

  it("should return a link if the text field contains only a URL", async () => {
    const url = 'https://和谐.org/beijing';

    const nodeNote = await assembleNote("", "  " + url + "  ", "", []);

    expect(nodeNote.subtype).toMatch(/^html/);
    expect(nodeNote.nodes).toHaveLength(1);
    expect(nodeNote.nodes[0]).toEqual({type: 'paragraph', children: [
        {text: ""},
        {type: 'link', url: 'https://xn--0trw50k.org/beijing', children: [{text: url}]},
        {text: ""}]});
  });

  it("should not return a link if the text field contains internal whitespace", async () => {
    const text = `  URL: protocol property

The protocol property of the URL interface is a string representing the protocol scheme of the URL, including the final ':'.  `;

    const nodeNote = await assembleNote("", text, "", []);

    expect(nodeNote.subtype).toMatch(/^html/);
    expect(nodeNote.nodes).toHaveLength(3);
    expect(nodeNote.nodes[0]).toEqual({type: 'paragraph', children: [{text: "  URL: protocol property"}]});
    expect(nodeNote.nodes[1]).toEqual({type: 'paragraph', children: [{text: ""}]});
    expect(nodeNote.nodes[2]).toEqual({type: 'paragraph', children: [{text: "The protocol property of the URL interface is a string representing the protocol scheme of the URL, including the final ':'.  "}]});
  });

  it("should replace recognizable URLs in the text field with anchors", async () => {
    const text = `A plan to make www.thingamajig.org the center of action.
The backup plan was to use mailto:contact@abc.edu?subject=Plan%20Progress&body=good%20stuff`;

    const nodeNote = await assembleNote("", text, "", []);

    expect(nodeNote.subtype).toMatch(/^html/);
    expect(nodeNote.nodes).toHaveLength(2);
    expect(nodeNote.nodes[0]).toEqual({type: 'paragraph', children: [
      {text: "A plan to make "},
        {type: 'link', url: 'https://www.thingamajig.org/', children: [{text: 'www.thingamajig.org'}]},
        {text: " the center of action."}]});
    expect(nodeNote.nodes[1]).toEqual({type: 'paragraph', children: [
      {text: "The backup plan was to use "},
        {type: 'link', url: 'mailto:contact@abc.edu?subject=Plan%20Progress&body=good%20stuff',
          children: [{text: 'mailto:contact@abc.edu?subject=Plan%20Progress&body=good%20stuff'}]},
        {text: ""}]});
  });

  it("should not replace URLs in text, when the note will be plain text", async () => {
    const textFile = new File(["the text"], 'some text.txt',{type: 'text/plain'});

    const nodeNote = await assembleNote("", `Read more at https://music.osu.edu/ and on paper`,
      "", [textFile]);

    expect(nodeNote.subtype).toMatch(/^plain/);
    expect(nodeNote.nodes).toHaveLength(2);
    expect(nodeNote.nodes[0]).toEqual({type: 'paragraph',
      children: [{text: "Read more at https://music.osu.edu/ and on paper"}]});
    expect(nodeNote.nodes[1]).toEqual({type: 'paragraph', children: [{text: "the text"}]});
  });

  it("should accept URL in url field (by itself) and create rich text", async () => {
    const url = 'news:comp.infosystems.www.servers.unix/';

    const nodeNote = await assembleNote("", "", "  " + url + "  ", []);

    expect(nodeNote.subtype).toMatch(/^html/);
    expect(nodeNote.nodes).toHaveLength(1);
    expect(nodeNote.nodes[0]).toEqual({type: 'paragraph', children: [{text: ""},
        {type: 'link', url, children: [{text: "  " + url + "  "}]},
        {text: ""}]});
  });

  it("should put normalized URL after text and create rich text", async () => {
    const urlText = '  https://Ἰωάννης.com/  '

    const nodeNote = await assembleNote("Washington's Farewell Address", TEXT1, urlText, []);

    expect(nodeNote.subtype).toMatch(/^html/);
    expect(nodeNote.nodes).toHaveLength(5);
    expect(nodeNote.nodes[0]).toEqual({type: 'heading-one', children: [{text: "Washington's Farewell Address"}]});
    expect(nodeNote.nodes[1]).toEqual({type: 'paragraph', children: [{text: "Friends and Citizens:"}]});
    expect(nodeNote.nodes[2].type).toEqual('paragraph');
    expect(nodeNote.nodes[2].children).toHaveLength(1);
    expect(nodeNote.nodes[2].children[0].text).toMatch(/^The period for a new election/);
    expect(nodeNote.nodes[3].type).toEqual('paragraph');
    expect(nodeNote.nodes[3].children).toHaveLength(1);
    expect(nodeNote.nodes[3].children[0].text).toMatch(/^I beg you/);
    expect(nodeNote.nodes[4]).toEqual({type: 'paragraph', children: [{text: ""},
        {type: 'link', url: 'https://xn--hxawra0a1by402b.com/', children: [{text: urlText}]},
        {text: ""}]});
  });

  it("should accept un-normalized URLs in url field and normalize them", async () => {
    const url = 'mailto:bob@example.org?subject=Hey, there!&body=You need to know...'

    const nodeNote = await assembleNote("Some Cool Share", "", url, []);

    expect(nodeNote.subtype).toMatch(/^html/);
    expect(nodeNote.nodes).toHaveLength(2);
    expect(nodeNote.nodes[0]).toEqual({type: 'heading-one', children: [{text: "Some Cool Share"}]});
    expect(nodeNote.nodes[1]).toEqual({type: 'paragraph', children: [{text: ""},
        {type: 'link', url: 'mailto:bob@example.org?subject=Hey,%20there!&body=You%20need%20to%20know...',
          children: [{text: url}]},
        {text: ""}]});
  });

  it("should make each line of a plain text file a paragraph, and use the file date", async () => {
    const fileDate = new Date(1796, 0, 1).valueOf();
    const file = new File([TEXT2], "farewell", {type: 'text/plain', lastModified: fileDate});

    const nodeNote = await assembleNote("Washington's Farewell Address", "introductory\nlines", "", [file]);

    expect(nodeNote.subtype).toMatch(/^plain/);
    expect(nodeNote.nodes).toHaveLength(7);
    expect(nodeNote.nodes[0]).toEqual({type: 'paragraph', children: [{text: "Washington's Farewell Address"}]});
    expect(nodeNote.nodes[1]).toEqual({type: 'paragraph', children: [{text: "introductory"}]});
    expect(nodeNote.nodes[2]).toEqual({type: 'paragraph', children: [{text: "lines"}]});
    expect(nodeNote.nodes[3].type).toEqual('paragraph');
    expect(nodeNote.nodes[3].children).toHaveLength(1);
    expect(nodeNote.nodes[3].children[0].text).toMatch(/^The acceptance of/);
    expect(nodeNote.nodes[4].type).toEqual('paragraph');
    expect(nodeNote.nodes[4].children).toHaveLength(1);
    expect(nodeNote.nodes[4].children[0].text).toMatch(/^I rejoice that/);
    expect(nodeNote.nodes[5].type).toEqual('paragraph');
    expect(nodeNote.nodes[5].children).toHaveLength(1);
    expect(nodeNote.nodes[5].children[0].text).toMatch(/^The impressions with which I first undertook/);
    expect(nodeNote.nodes[6]).toEqual({type: 'paragraph', children: [{text: ""}]});
    expect(nodeNote.date).toEqual(new Date(fileDate));
  });

  it("should override the file type of plain text if the url field is present", async () => {
    const url = 'https://boomerang.au/list';
    const fileDate = new Date(1796, 0, 1).valueOf();
    const file = new File([TEXT2], "farewell", {type: 'text/plain', lastModified: fileDate});

    const nodeNote = await assembleNote("Washington's Farewell Address", "introductory\nlines", url, [file]);

    expect(nodeNote.subtype).toMatch(/^html/);
    expect(nodeNote.nodes).toHaveLength(8);
    expect(nodeNote.nodes[0]).toEqual({type: 'heading-one', children: [{text: "Washington's Farewell Address"}]});
    expect(nodeNote.nodes[1]).toEqual({type: 'paragraph', children: [{text: "introductory"}]});
    expect(nodeNote.nodes[2]).toEqual({type: 'paragraph', children: [{text: "lines"}]});
    expect(nodeNote.nodes[3]).toEqual({type: 'paragraph', children: [{text: ""},
        {type: 'link', url, children: [{text: url}]},
        {text: ""}]});
    expect(nodeNote.nodes[4].type).toEqual('paragraph');
    expect(nodeNote.nodes[4].children).toHaveLength(1);
    expect(nodeNote.nodes[4].children[0].text).toMatch(/^The acceptance of/);
    expect(nodeNote.nodes[5].type).toEqual('paragraph');
    expect(nodeNote.nodes[5].children).toHaveLength(1);
    expect(nodeNote.nodes[5].children[0].text).toMatch(/^I rejoice that/);
    expect(nodeNote.nodes[6].type).toEqual('paragraph');
    expect(nodeNote.nodes[6].children).toHaveLength(1);
    expect(nodeNote.nodes[6].children[0].text).toMatch(/^The impressions with which I first undertook/);
    expect(nodeNote.nodes[7]).toEqual({type: 'paragraph', children: [{text: ""}]});
    expect(nodeNote.date).toEqual(new Date(fileDate));
  });

  it("should use the subtype of text files", async () => {
    const file = new File([YAML], "cable", {type: 'text/x-yaml'});

    const nodeNote = await assembleNote("", "", "", [file]);

    expect(nodeNote.subtype).toMatch(/^x-yaml/);
    expect(nodeNote.nodes).toHaveLength(3);
  });

  it("should override the file type of text files if the url field is present", async () => {
    const url = 'https://eiffel.fr/';
    const file = new File([YAML], "cable", {type: 'text/x-yaml'});

    const nodeNote = await assembleNote("", "", url, [file]);

    expect(nodeNote.subtype).toMatch(/^html/);
    expect(nodeNote.nodes).toHaveLength(4);
  });

  it("should parse HTML", async () => {
    const url = 'https://unterdenlinden.de/';
    const file = new File([HTML], "some article", {type: 'text/html'});

    const nodeNote = await assembleNote("A Nifty Article", "This is the article:", url, [file]);

    expect(nodeNote.subtype).toMatch(/^html/);
    expect(nodeNote.nodes).toHaveLength(6);
    expect(nodeNote.nodes[0]).toEqual({type: 'heading-one', children: [{text: "A Nifty Article"}]});
    expect(nodeNote.nodes[1]).toEqual({type: 'paragraph', children: [{text: "This is the article:"}]});
    expect(nodeNote.nodes[2]).toEqual({type: 'paragraph', children: [{text: ""},
        {type: 'link', url, children: [{text: url}]},
        {text: ""}]});
    expect(nodeNote.nodes[3]).toEqual({type: 'heading-two', children: [{text: "Series Name"}]});
    expect(nodeNote.nodes[4]).toEqual({type: 'heading-one', children: [{text: "The Main Title"}]});
    expect(nodeNote.nodes[5]).toEqual({type: 'paragraph', children: [
        {text: "I guess we have to "},
        {text: "include", italic: true},
        {text: " content."},
      ]});
  });

  it("should convert a vector graphic to an image element w/ data URL", async () => {
    const url = 'https://aztec.mx/';
    const file = new File([SVG], "circular pattern.svg", {type: 'image/svg+xml'});

    const nodeNote = await assembleNote("An Important Diagram", "This is the vector graphic:", url, [file]);

    expect(nodeNote.subtype).toMatch(/^html/);
    expect(nodeNote.nodes).toHaveLength(6);
    expect(nodeNote.nodes[0]).toEqual({type: 'heading-one', children: [{text: "An Important Diagram"}]});
    expect(nodeNote.nodes[1]).toEqual({type: 'paragraph', children: [{text: "This is the vector graphic:"}]});
    expect(nodeNote.nodes[2]).toEqual({type: 'paragraph', children: [{text: ""},
        {type: 'link', url, children: [{text: url}]},
        {text: ""}]});
    expect(nodeNote.nodes[3]).toEqual({type: 'paragraph', children: [{text: ""}]});
    expect(nodeNote.nodes[4]).toEqual({
      type: 'image',
      url: DATA_URL_SVG,
      children: [{text: "circular pattern.svg"}]});
    expect(nodeNote.nodes[5]).toEqual({type: 'paragraph', children: [{text: ""}]});
  });

  it("should convert a raster graphic to an image element w/ data URL", async () => {
    const pngFile = dataURItoFile(DATA_URL_DOT, 'dot.png', new Date());

    const nodeNote = await assembleNote("A Cat Picture", "This is the raster graphic:", "", [pngFile]);

    expect(nodeNote.subtype).toMatch(/^html/);
    expect(nodeNote.nodes).toHaveLength(5);
    expect(nodeNote.nodes[0]).toEqual({type: 'heading-one', children: [{text: "A Cat Picture"}]});
    expect(nodeNote.nodes[1]).toEqual({type: 'paragraph', children: [{text: "This is the raster graphic:"}]});
    expect(nodeNote.nodes[2]).toEqual({type: 'paragraph', children: [{text: ""}]});
    expect(nodeNote.nodes[3]).toEqual({
      type: 'image',
      url: DATA_URL_DOT,
      children: [{text: "dot.png"}]});
    expect(nodeNote.nodes[4]).toEqual({type: 'paragraph', children: [{text: ""}]});
  });

  it("should use just the title & file name of an unsupported type", async () => {
    const file = new File([RTF], "something dull.rtf", {type: 'text/rtf'});

    const nodeNote = await assembleNote("A Plausible Report Title", "This is the report:", "", [file]);

    expect(nodeNote.subtype).toMatch(/^html/);
    expect(nodeNote.nodes).toHaveLength(5);
    expect(nodeNote.nodes[0]).toEqual({type: 'heading-one', children: [{text: "A Plausible Report Title"}]});
    expect(nodeNote.nodes[1]).toEqual({type: 'paragraph', children: [{text: "This is the report:"}]});
    expect(nodeNote.nodes[2]).toEqual({type: 'paragraph', children: [{text: ""}]});
    expect(nodeNote.nodes[3]).toEqual({type: 'quote', children: [{text: `«${file.name}»`, bold: true}]});
    expect(nodeNote.nodes[4]).toEqual({type: 'paragraph', children: [{text: ""}]});
  });

  it("should presume a file of a non-text, non-graphic type is text (it was passed by the file filter)", async () => {
    const sqlFile = new File([SQL], "cities.sql", {type: 'application/sql'});

    const nodeNote = await assembleNote("", "", "", [sqlFile]);

    expect(nodeNote.subtype).toMatch(/^html/);
    expect(nodeNote.nodes).toHaveLength(14);
    expect(nodeNote.nodes[0]).toEqual({type: 'paragraph', children: [{text: "CREATE TABLE APP.CITIES"}]});
    expect(nodeNote.nodes[1]).toEqual({type: 'paragraph', children: [{text: "   ("}]});
    expect(nodeNote.nodes[2]).toEqual({type: 'paragraph',
      children: [{text: "      CITY_ID          INTEGER NOT NULL constraint cities_pk primary key,"}]});
    expect(nodeNote.nodes[12]).toEqual({type: 'paragraph',
      children: [{text: "insert into APP.CITIES VALUES (3,'Auckland','New Zealand','AKL','English','NZ');"}]});
  });

  it("should concatenate all files, use a compatible subtype, and the latest date", async () => {
    const url = 'https://party.com/';
    const yamlFile = new File([YAML], "config stuff",
      {type: 'text/x-yaml', lastModified: new Date(2005, 7, 21).valueOf()});
    const svgFile = new File([SVG], "circular pattern.svg",
      {type: 'image/svg+xml', lastModified: new Date(2018, 10, 30).valueOf()});
    const textFile = new File([TEXT1], "farewell address",
      {type: 'text/plain', lastModified: new Date(1796, 0, 1).valueOf()});
    const rtfFile = new File([RTF], "something dull.rtf",
      {type: 'application/rtf', lastModified: new Date(2019, 11, 25).valueOf()});
    const htmlFile = new File([HTML], "my conference notes",
      {type: 'text/html', lastModified: new Date(2002, 3, 29).valueOf()});

    const nodeNote = await assembleNote("A Motley Collection", TEXT2, url, [yamlFile, svgFile, textFile, rtfFile, htmlFile]);

    expect(nodeNote.subtype).toMatch(/^html/);
    expect(nodeNote.nodes[0]).toEqual({type: 'heading-one', children: [{text: "A Motley Collection"}]});

    expect(nodeNote.nodes[1].type).toEqual('paragraph');
    expect(nodeNote.nodes[1].children).toHaveLength(1);
    expect(nodeNote.nodes[1].children[0].text).toMatch(/^The acceptance of, and continuance hitherto in/);

    expect(nodeNote.nodes[5]).toEqual({type: 'paragraph', children: [{text: ""},
        {type: 'link', url, children: [{text: url}]},
        {text: ""}]});

    expect(nodeNote.nodes[6]).toEqual({type: 'paragraph', children: [{text: "development:"}]});

    expect(nodeNote.nodes[9]).toEqual({type: 'paragraph', children: [{text: ""}]});
    expect(nodeNote.nodes[10]).toEqual({
      type: 'image',
      url: DATA_URL_SVG,
      children: [{text: "circular pattern.svg"}]});
    expect(nodeNote.nodes[11]).toEqual({type: 'paragraph', children: [{text: ""}]});

    expect(nodeNote.nodes[12]).toEqual({type: 'paragraph', children: [{text: "Friends and Citizens:"}]});

    expect(nodeNote.nodes[15]).toEqual({type: 'paragraph', children: [{text: ""}]});
    expect(nodeNote.nodes[16]).toEqual({type: 'quote', children: [{text: "«something dull.rtf»", bold: true}]});
    expect(nodeNote.nodes[17]).toEqual({type: 'paragraph', children: [{text: ""}]});

    expect(nodeNote.nodes[18]).toEqual({type: 'heading-two', children: [{text: "Series Name"}]});

    expect(nodeNote.nodes).toHaveLength(21);

    expect(nodeNote.date).toEqual(new Date(2018, 10, 30));
  });

  it("should reject if file is empty", async () => {
    const file = new File([""], "empty.txt", {type: 'text/plain'});

    await expect(assembleNote("   ", "   ", "   ", [file])).rejects.toThrow("No usable content");
  });

  it("should reject if no usable content", async () => {
    const file = new File([RTF], "something dull.rtf", {type: 'text/rtf'});

    await expect(assembleNote("   ", "   ", "   ", [file])).rejects.toThrow("No usable content");
  });
});
