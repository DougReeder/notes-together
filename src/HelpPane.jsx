// HelpPane.js - Preferences & HelpPane for Notes Together
// Copyright © 2022 Doug Reeder

import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import {AppBar, Box, IconButton, Toolbar, Typography} from "@mui/material";
import PropTypes from 'prop-types';
import MenuIcon from "@mui/icons-material/Menu";
import {KeyboardVoice, Lock, MoreVert, Redo, Settings, Undo} from "@mui/icons-material";
import "./HelpPane.css";

function HelpPane({setMustShowPanel}) {
  const helpEmail = "mailto:support@hominidsoftware.com?subject=Notes%20Together%20Support&body=" +
      encodeURIComponent(`

${navigator.userAgent}
${navigator.language}
${navigator.userAgentData?.platform || ''}
mobile: ${navigator.userAgentData?.mobile || ''}` +
(navigator.userAgentData?.brands || []).map(item => '\n' + item.brand + ' ' + item.version));
  /* eslint-disable react/no-unescaped-entities */
  return <>
    <AppBar>
      <Toolbar style={{justifyContent: 'flex-start'}}>
        <IconButton title="Out to list pane" className="narrowLayoutOnly"
            edge={false} size="large"
            onClick={setMustShowPanel?.bind(this, 'LIST')}>
          <ArrowBackIcon />
        </IconButton>
        <Typography style={{margin: "1.5ch"}}>
            Help
        </Typography>
      </Toolbar>
    </AppBar>
    <Box className="help" style={{flexGrow: 1, flexShrink: 1, width: '100%', overflowX: 'clip', overflowY: "auto"}}>
      <div style={{padding: '1rem', backgroundColor: 'white'}}>
        <h4>Can I search for notes containing all of two or more words?</h4>
        <p>Yes! Enter them separated by spaces.</p>

        <h4>Can I search for notes containing either of two words?</h4>
        <p>No, but you can quickly search one word. If you don’t find the note you’re looking for, then search for the other word.</p>

        <h4>Can I create categories or tags?</h4>
        <p>Enter a search, then from the application menu <MenuIcon style={{position: 'relative', bottom: '-0.5ex'}}/>, select <b>Save search as tag</b>. Tags are listed before search suggestions in the search dropdown. Your notes are already tagged with every word in them. Tags are synced to all of your devices.</p>
        <p>If searching for the natural name of a category or tag fetches unrelated results (for example, you search for “star” and get notes on celebrities as well as astronomy) you can use two or more words, append an uncommon word like “asterism” to all of the appropriate notes, or coin a word like “StarAstronomy”.</p>
        <p>If a note doesn't contain the tag word or words you need, just add them to the bottom of the note. For example, if you append “movie review” to each of your notes on a movie, you can find them all by searching for either “movie” or “review”.</p>
        <p>Tags can be temporary. While you're working on a project, save the topic as a tag. When you're done with the project, delete the tag, and the obsolete tag won't clutter the interface. If you need the project notes again, just type the topic into the search field!</p>

        <h4>How can I organize large amounts of text?</h4>
        <p>Pick a distinctive 1–3 word topic. Save the topic as a tag. While working, leave the topic selected in the search field. New notes will be tagged with this topic.</p>
        <p>Split long notes into several short notes. Append the topic to each.</p>
        {/*<p>You can export all your notes on a topic with the menu command <strong>Export matching notes to*/}
        {/*  file</strong>. Moving these files off a phone may require creative use of Wi-Fi Direct, Bluetooth, Air*/}
        {/*  Drop, a cloud storage service like Dropbox, messaging or email. When you import one of these exported*/}
        {/*  files, select <strong>Markdown</strong> when asked</p>*/}

        <h4>How do I undo mistakes?</h4>
        <p>From the Editor menu <MoreVert style={{position: 'relative', bottom: '-0.5ex'}}/>, select <b>Undo &nbsp;<Undo/></b>.</p>
        <p>On MacOS and iOS, you can type ⌘Z. On other operating systems, you can type ctrl+Z.</p>

        <h4>How do I use voice dictation/voice typing on a phone or tablet?</h4>
        <ol>
          <li>Tap in the note editor to open the on-screen keyboard.</li>
          <li>Tap the microphone button. <KeyboardVoice style={{position: 'relative', bottom: '-0.5ex'}}/></li>
          <p><i>On Android, you may first need to enable voice dictation in the keyboard Settings.</i> <Settings style={{position: 'relative', bottom: '-0.5ex'}}/></p>
        </ol>

        <h4>How do I sync notes between devices?</h4>
        <p>Create an <a href="https://remotestorage.io/get/" target="_blank" rel="noreferrer">account native to remoteStorage</a> with a third-party provider (or use an existing Dropbox or Google Drive account, with some limitations). Then use the widget in the lower-left of the list panel to connect to it.</p>
        <svg style={{position: 'relative', bottom: '1.2ex'}}
             className="rs-main-logo" id="rs-main-logo-remotestorage" version="1.1" width="0.739008in" height="0.853339in"
             viewBox="0 0 739 853"> <g> <polygon className="rs-logo-shape"
                                                 points="370,754 0,542 0,640 185,747 370,853 554,747 739,640 739,525 739,525 739,476 739,427 739,378 653,427 370,589 86,427 86,427 86,361 185,418 370,524 554,418 653,361 739,311 739,213 739,213 554,107 370,0 185,107 58,180 144,230 228,181 370,100 511,181 652,263 370,425 87,263 87,263 0,213 0,213 0,311 0,378 0,427 0,476 86,525 185,582 370,689 554,582 653,525 653,590 653,592 "></polygon> </g> </svg>
        <p>You can use the same account with <a href="https://remotestorage.io/apps/" target="_blank"  rel="noreferrer">multiple apps</a>.</p>

        <h4>How closely must search words match the text?</h4>
        <ul>
          <li>Upper- and lower-case don’t matter, so “scuba” matches “SCUBA”.</li>
          <li>Dashes, periods, underscores and non-breaking spaces are dropped, so
            <ul>
              <li>“playgroup” matches “play-group”</li>
              <li>“phd” matches “Ph.D.</li>
              <li>“linenumber” matches “__LINE_NUMBER__”</li>
              <li>“14inch” matches “14␣inch” (and “14-inch”) but not “14 inch” (but searching for “14” or “inch” <i>will</i> find a note containing “14 inch”).</li>
            </ul>
          </li>
          <li>Decimal points in numbers <i>are not</i> dropped, so “25” doesn't match “2.5”.</li>
          <li>“Words” consist only of letters, digits and apostrophes, so
            <ul>
              <li>“john@example.com” is two separate words (which match “john” or “examplecom”)</li>
              <li>“614-555-1212” is one word (which matches “6145551212”)</li>
              <li>“ill” doesn’t match “I’ll”</li>
              <li>“和谐” can’t be searched for.</li>
            </ul>
          </li>
          <li>Accented letters match unaccented letters, so
            “cafe” matches “café”, “slychac” matches “słychać” and “ɩωɑννησ” matches “Ἰωάννης”.
          </li>
          <li>“strasse” matches “Straße”, “thath” matches “Það”, “aelfred” matches “Ælfred” and so forth.</li>
          {/*<li>Superscript and subscript digits match normal digits, so “h2o” matches “H₂O”</li>*/}
          <li>If there’s a latin or greek letter that doesn’t match the way it should, please send a support e-mail.</li>
          <li>Synonyms <strong>do not</strong> match.  You may find it useful to add synonyms of key words at the end of your notes.</li>
        </ul>

        <h4>Can I change the order of notes?</h4>
        <p>Click the date in the upper left of the editing panel and set the date earlier or later.  The date can be anything that helps you find the note.</p>

        <h4>How do I avoid altering a note by mistake?</h4>
        <p>From the Editor menu <MoreVert style={{position: 'relative', bottom: '-0.4ex'}}/> select <b>Lock note <Lock style={{position: 'relative', bottom: '-0.4ex'}}/></b>.</p>
        <p>Task List and Sequence items can be checked or cleared, even when a note is locked.</p>

        <h4>What keyboard shortcuts are available?</h4>
        <p>Many common shortcuts do what you'd expect, so they're not listed here!</p>
        <table className="shortcuts">
          <caption>Anywhere</caption>
          <tbody>
            <tr><td>escape ⎋</td><td>navigate out: close dialog, exit editor, show list panel, focus search, then clear search</td></tr>
            <tr><td>ctrl+shift+plus or ​⇧⌘+</td><td>increase application text size</td></tr>
            <tr><td>ctrl+minus or ⌘-</td><td>decrease application text size</td></tr>
          </tbody>
        </table>
        <table className="shortcuts">
          <caption>Search field</caption>
          <tbody>
          <tr><td>enter/return ⏎</td><td>finish search (On phone or tablet, the on-screen keyboard is dismissed. On desktop, down- and up-arrow can then be used.)</td></tr>
          </tbody>
        </table>
        <table className="shortcuts">
          <caption>Outside editor</caption>
          <tbody>
            <tr><td>down-arrow ⬇️</td><td>select next note</td></tr>
            <tr><td>shift-down-arrow ⇧⬇️</td><td>skip 5 down through the list</td></tr>
            <tr><td>alt-down-arrow ⌥⬇️</td><td>skip 25 down through the list</td></tr>
            <tr><td>Page Down ⇟</td><td>skip 10 down through the list</td></tr>
            <tr><td>End ↘ or ctrl-down-arrow ⎈⬇️</td><td>skip to end of list</td></tr>
            <tr><td>up-arrow ⬆️</td><td>select previous note</td></tr>
            <tr><td>shift-up-arrow ⇧⬆️️</td><td>skip 5 up through the list</td></tr>
            <tr><td>alt-up-arrow️ ⌥⬆️</td><td>skip 25 up through the list</td></tr>
            <tr><td>Page Up ⇞</td><td>skip 10 up through the list</td></tr>
            <tr><td>Home ↖ or ctrl-up-arrow ⎈⬆️</td><td>skip to beginning of list</td></tr>
            {/*<tr><td>carriage return</td><td>edit selected note</td></tr>*/}
          </tbody>
        </table>
        <table className="shortcuts">
          <caption>Single-panel mode, outside editor</caption>
          <tbody>
            <tr><td>left-arrow ⬅️</td><td>out to list panel</td></tr>
            <tr><td>right-arrow ➡️</td><td>in to editor panel of selected note</td></tr>
          </tbody>
        </table>
        <table className="shortcuts">
          <caption>Inside search field or editor</caption>
          <tbody>
            <tr><td>ctrl+Z or ​⌘Z</td><td>undo <Undo/></td></tr>
            <tr><td>ctrl‑Y or ⇧​⌘Z</td><td>redo <Redo/></td></tr>
            <tr><td>ctrl+A or ​⌘A</td><td>select all</td></tr>
          </tbody>
        </table>
        <table className="shortcuts">
          <caption>Inside editor</caption>
          <tbody>
            <tr><td>ctrl+return or ⌘⏎</td><td>line break</td></tr>
            <tr><td>shift+space ⇧␠</td><td>toggle checkbox</td></tr>
            <tr><td>ctrl+B or ⌘B</td><td>bold text</td></tr>
            <tr><td>ctrl+I or ⌘I</td><td>italic text</td></tr>
            <tr><td>ctrl+` or ⌘`</td><td>monospaced phrase</td></tr>
            <tr><td>shift+ctrl+` or ⇧⌘`</td><td>monospaced block</td></tr>
            <tr><td>ctrl+8 or shift+ctrl+* or ctrl+- or shift-ctrl+-<br/>or ⌘8 or ⇧⌘* or ⌘- or ⇧⌘-</td><td>bulleted list</td></tr>
            <tr><td>ctrl+1 or shift+ctrl+1 or ⌘1 or ⇧⌘1</td><td>numbered list</td></tr>
            <tr><td>ctrl+[ or shift+ctrl+[ or ⌘[</td><td>task list</td></tr>
            <tr><td>ctrl+] or shift+ctrl+] or ⌘]</td><td>sequence</td></tr>
            <tr><td>shift+ctrl+T or ⇧⌘T (except in Chrome)</td><td>title</td></tr>
            <tr><td>shift+ctrl+H or ⇧⌘H</td><td>heading</td></tr>
            <tr><td>shift+ctrl+S or ⇧⌘S</td><td>subheading</td></tr>
            <tr><td>ctrl+' or shift+ctrl+' or ⌘' or ⇧⌘'</td><td>block quote</td></tr>
            <tr><td>tab ⇥</td><td><ul style={{paddingInlineStart: '20px'}}>
              <li>moves list item to child list</li>
              <li>moves cursor to next cell in table</li>
              <li>inserts spaces to move to next tab stop</li></ul></td></tr>
            <tr><td>shift-tab ⇧⇥</td><td><ul style={{paddingInlineStart: '20px'}}>
              <li>moves list item to parent list</li>
              <li>moves cursor to previous cell in table</li>
              <li>deletes characters to move to previous tab stop</li>
            </ul></td></tr>
          </tbody>
        </table>

        <h4>How do I add pictures and diagrams?</h4>
        <ul>
          <li><p>To create new notes from graphics, from the application menu <MenuIcon style={{position: 'relative', bottom: '-0.5ex'}}/> select <b>Import one note per file</b> and select the graphic files.  Or, drag the files to the list panel.</p>
            <p>If you don't need text related to the graphic, at least add several key words, so you can find it by search.</p>
          </li>
          <li><p>To add graphics to an existing note, drag the files to the editor, or copy and paste them.</p>
            <p>On a phone or tablet, from the Editor menu <MoreVert style={{position: 'relative', bottom: '-0.5ex'}}/> select <b>Paste files...</b>. That's also how you insert a picture with the camera.</p>
          </li>
        </ul>

        <h4>How do I import text or graphics from a PDF or office document?</h4>
        <ol>
          <li>Open the document in an appropriate app.</li>
          <li>Select and copy the text or graphic.</li>
          <li>Paste into the Notes Together editor pane.</li>
        </ol>
        <p>Or, select the text or graphic in the other app, and drag it into the editor pane.</p>
        <p><i>Note that PDFs and office documents are designed to place ink on a page. They don't necessarily contain semantic markup that can be imported.</i></p>

        <h4>How many graphics can I add to a note?</h4>
        <p>Not more than a couple photos — each takes up as much storage as <em>ten thousand</em> words! A half-dozen SVGs or diagrams should be fine.</p>

        <h4>What formatting is supported for imported files and pasted text?</h4>
        <p>Headings, paragraphs, lists, tables, graphics and other semantic HTML are imported, but not custom styles.</p>
        <p><a href="https://commonmark.org/help/" target="_blank" rel="noreferrer">Markdown notation (CommonMark 1.0)</a> plus GFM <a href="https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/organizing-information-with-tables" target="_blank" rel="noreferrer">tables</a>, <a href="https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/about-task-lists#creating-task-lists" target="_blank" rel="noreferrer">checklists</a> and <a href="https://github.github.com/gfm/#strikethrough-extension-" target="_blank" rel="noreferrer">strikethrough</a> is supported in files with the extension <code>.md</code> or (optionally) text files. (<code>&lt;sup&gt; &lt;sub&gt; &lt;u&gt; &lt;del&gt;</code> and <code>&lt;ins&gt;</code> tags can be used for superscript, subscript, underline, delete and insert text styles, as usual in Markdown.)</p>
        <p>When using <b>Import multiple notes per file</b> (from the application menu <MenuIcon style={{position: 'relative', bottom: '-0.5ex'}}/>), three blank lines separate one note from the next.</p>

        <h4>How do I add a link?</h4>
        <p>Surf to the page in a web browser. From the browser's URL bar, drag the URL (or the icon next to it) to the Notes Together editor.</p>

        <h4>How do I follow a link, in a Rich Text note?</h4>
        <p>Right-click the link, then select <b>Open link in new tab</b>.</p>

        <h4>Does the editor behave differently when editing a Markdown note?</h4>
        <p>When rich text and graphics are pasted, they are converted to Markdown. If a Markdown note is converted to Rich Text, or vice versa, the markup is translated to the closest available.</p>

        <a href="https://hominidsoftware.com/notes-together/"><img alt="Notes Together" src="icons/NotesTogether-Icon-96x96.png" style={{float: 'right', maxWidth: '30%'}}/></a>
        <h2>Notes Together</h2>
        <p>Questions? Contact <a href={helpEmail}>support@hominidsoftware.com</a></p>
        <p>Copyright © 2021-2023 <a href="https://hominidsoftware.com/">Hominid Software</a></p>
        <p>&nbsp;</p>
      </div>
    </Box>
  </>;
  /* eslint-enable react/no-unescaped-entities */
}

HelpPane.propTypes = {
  setMustShowPanel: PropTypes.func.isRequired
}

export default HelpPane;
