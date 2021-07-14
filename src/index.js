import {init} from "./storage";
import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';
import './index.css';
import '@fontsource/roboto';
import reportWebVitals from './reportWebVitals';
import {SnackbarProvider} from "notistack";

init().then(remoteStorage => {   // init is idempotent
  // console.log("remoteStorage initialized:", remoteStorage);
});

ReactDOM.render(
  <React.StrictMode>
    <SnackbarProvider maxSnack={3} dense={true} preventDuplicate={true}>
      <App />
    </SnackbarProvider>
  </React.StrictMode>,
  document.getElementById('root')
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
