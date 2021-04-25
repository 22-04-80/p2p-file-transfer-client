import {Channel, Socket} from "phoenix";

const URL = process.env.REACT_APP_WS_URL;

export function initChannel(): Channel {
	const socket = new Socket(URL as string);
	socket.connect();
	return socket.channel("signal:relay", {});
}

