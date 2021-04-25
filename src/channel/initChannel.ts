import {Channel, Socket} from "phoenix";

export function initChannel(): Channel {
	// const socket = new Socket("wss://limitless-taiga-39396.herokuapp.com/socket");
	const socket = new Socket("ws://localhost:4000/socket");
	socket.connect();
	return socket.channel("signal:relay", {});
}

