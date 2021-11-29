import {init} from "./storage";
import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';
import './index.css';
import '@fontsource/roboto';
import reportWebVitals from './reportWebVitals';
import {SnackbarProvider} from "notistack";

if (!('requestIdleCallback' in window)) {
  // https://github.com/behnammodi/polyfill/blob/master/window.polyfill.js
  if (!window.requestIdleCallback) {
    window.requestIdleCallback = function (callback, options) {
      options = options || {};
      const relaxation = 1;
      const timeout = options.timeout || relaxation;
      const start = performance.now();
      return setTimeout(function () {
        callback({
          get didTimeout() {
            return options.timeout ? false : (performance.now() - start) - relaxation > timeout;
          },
          timeRemaining: function () {
            return Math.max(0, relaxation + (performance.now() - start));
          },
        });
      }, relaxation);
    };
  }

  if (!window.cancelIdleCallback) {
    window.cancelIdleCallback = function (id) {
      clearTimeout(id);
    };
  }
}

init().then(remoteStorage => {   // init is idempotent
  // console.log("remoteStorage initialized:", remoteStorage);
});

ReactDOM.render(
  <React.StrictMode>
    <SnackbarProvider maxSnack={3} autoHideDuration={8000} dense={true} preventDuplicate={true}>
      <App />
    </SnackbarProvider>
  </React.StrictMode>,
  document.getElementById('root')
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
