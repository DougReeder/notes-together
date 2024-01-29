Notes Together
==============

Free your mind from mundane details! Toss in text, pictures, links and files Shared from native apps. Be confident you can find any note on any device. Take control of your data with remoteStorage. Never spend time tidying up — unless you want to!

A web app for taking notes (or copied snippets of text or pictures) and recalling them by context:
any words in them, or the date.
It applies the same styles to typed and pasted text, so your notes look professional.
It really shines when you have hundreds or thousands of notes.

Data is synced with other devices using the [remoteStorage](https://remotestorage.io) protocol, so you control where your data is stored.


Using
-----
[Surf to https://notestogether.hominidsoftware.com/](https://notestogether.hominidsoftware.com/)


Development Setup
-----------------

Ensure your version of Node is v16 or later, and npm is v8 or later.

Development
-----------
cd to the project directory, then
`npm install` to retrieve dependencies

`npm run test` to run automated tests

`npm run dev` to run it locally

`npm run build` to build for production and push to the beta-testing server at `notes-together.surge.sh`

`npm run lint` to check for minor source code issues

`npm run preview` to locally preview production build

`npm run deploy` to copy the built version to the production server at `https://notestogether.hominidsoftware.com`

# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh
