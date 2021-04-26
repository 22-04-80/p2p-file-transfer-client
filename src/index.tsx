import CssBaseline from '@material-ui/core/CssBaseline';
import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';
import './App.css';
import {ChannelContext} from "./channel/ChannelContext";
import {initChannel} from "./channel/initChannel";
import reportWebVitals from './reportWebVitals';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';

const channel = initChannel();

ReactDOM.render(
	<React.StrictMode>
		<ChannelContext.Provider value={{channel}}>
			<CssBaseline/>
			<div className="App">
				<App/>
			</div>
		</ChannelContext.Provider>
	</React.StrictMode>,
	document.getElementById('root'),
);

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://cra.link/PWA
serviceWorkerRegistration.unregister();

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
