import {Channel} from "phoenix";
import React from 'react';
import {ChannelEvent} from "../channel/events/ChannelEvent";

interface Props {
	channel: Channel;
	uuid: string,
	peerUuid: string,
}

interface State {
	message: string,
	receivedMessages: string[],

	establishingConnection: boolean;
	connectionEstablished: boolean;
	isSendChannelOpen: boolean;
}

export class RemoteMessaging extends React.Component<Props, State> {
	private peerConnection: RTCPeerConnection | null = null;
	private dataChannel: RTCDataChannel | null = null;

	constructor(props: Props) {
		super(props);

		this.state = {
			message: '',
			receivedMessages: [],

			establishingConnection: false,
			connectionEstablished: false,
			isSendChannelOpen: false,
		};

		this.connectPeers = this.connectPeers.bind(this);
		this.setUpOffererConnection = this.setUpOffererConnection.bind(this);
		this.handleNegotiationNeededEvent = this.handleNegotiationNeededEvent.bind(this);
		this.handlePeerConnectionIceEvent = this.handlePeerConnectionIceEvent.bind(this);
		this.handleDataChannelStatusChange = this.handleDataChannelStatusChange.bind(this);
		this.handleDataChannelEvent = this.handleDataChannelEvent.bind(this);
		this.handleReceiveMessage = this.handleReceiveMessage.bind(this);
		this.disconnectPeers = this.disconnectPeers.bind(this);
		this.sendMessage = this.sendMessage.bind(this);
		this.onMessageInputChange = this.onMessageInputChange.bind(this);
	}

	public componentDidMount() {
		const {channel} = this.props;

		channel.on(ChannelEvent.transferOffer, async (payload) => {
			this.setUpAnswererConnection();

			if (!this.peerConnection) {
				return;
			}

			try {
				const description = new RTCSessionDescription(payload.sdp);
				await this.peerConnection.setRemoteDescription(description)
				const answer = await this.peerConnection.createAnswer();
				await this.peerConnection.setLocalDescription(answer);
				channel.push(ChannelEvent.transferAnswer, {
					offerer: payload.offerer,
					answerer: payload.answerer,
					sdp: this.peerConnection.localDescription,
				})
			} catch (error) {
				console.error(`ERROR OCCURRED WHEN CREATING OFFER - channel message payload: ${payload}`);
				this.reportError(error);
			}
		});

		channel.on(ChannelEvent.transferAnswer, async (payload) => {
			if (!this.peerConnection) {
				return;
			}

			const description = new RTCSessionDescription(payload.sdp);
			try {
				await this.peerConnection.setRemoteDescription(description)
			} catch (error) {
				console.error(`ERROR OCCURRED WHEN RECEIVING ANSWER TO OFFER - channel message payload: ${payload}`);
				this.reportError(error)
			}
		});

		channel.on(ChannelEvent.newIceCandidate, async (payload) => {
			const candidate = new RTCIceCandidate(payload.candidate);

			if (this.peerConnection) {
				try {
					await this.peerConnection.addIceCandidate(candidate);

				} catch(error) {
					console.error(`ERROR OCCURRED AFTER RECEIVING NEW ICE CANDIDATE - received message payload: ${payload}`)
					this.reportError(error)
				}
			}
		});

		channel.on(ChannelEvent.transferCancel, () => {
			this.closeConnection();
		});
	}

	private async connectPeers() {
		this.setState({
			establishingConnection: true,
		})
		this.setUpOffererConnection();
	}

	private setUpOffererConnection() {
		this.peerConnection = new RTCPeerConnection({
			iceServers: [     // Information about ICE servers - Use your own!
				{
					urls: "stun:stun.l.google.com:19305"
				}
			],
		});
		this.peerConnection.onnegotiationneeded = this.handleNegotiationNeededEvent;
		this.peerConnection.onicecandidate = this.handlePeerConnectionIceEvent;

		this.dataChannel = this.peerConnection.createDataChannel("dataChannel");
		this.dataChannel.onopen = this.handleDataChannelStatusChange;
		this.dataChannel.onclose = this.handleDataChannelStatusChange;
		this.dataChannel.onmessage = this.handleReceiveMessage;
	}

	private setUpAnswererConnection() {
		this.peerConnection = new RTCPeerConnection({
			iceServers: [     // Information about ICE servers - Use your own!
				{
					urls: "stun:stun.l.google.com:19305"
				}
			],
		});
		this.peerConnection.onnegotiationneeded = this.handleNegotiationNeededEvent;
		this.peerConnection.onicecandidate = this.handlePeerConnectionIceEvent;
		this.peerConnection.ondatachannel = this.handleDataChannelEvent;
	}

	private handleDataChannelEvent(event: RTCDataChannelEvent) {
		this.dataChannel = event.channel;
		this.dataChannel.onmessage = this.handleReceiveMessage;
		this.dataChannel.onopen = this.handleDataChannelStatusChange;
		this.dataChannel.onclose = this.handleDataChannelStatusChange;
		this.setState({
			isSendChannelOpen: true,
			connectionEstablished: true,
			establishingConnection: false,
		})
	}

	private async handleNegotiationNeededEvent() {
		if (!this.peerConnection) {
			return;
		}

		try {
			const {channel, uuid, peerUuid} = this.props;

			const offer = await this.peerConnection.createOffer();
			await this.peerConnection.setLocalDescription(offer);
			channel.push(ChannelEvent.transferOffer, {
				offerer: uuid,
				answerer: peerUuid,
				sdp: this.peerConnection.localDescription,
			});
		} catch (error) {
			console.error(`ERROR OCCURRED WHEN CREATING OFFER`);
			this.reportError(error);
		}
	}

	private handlePeerConnectionIceEvent(peerConnectionIceEvent: RTCPeerConnectionIceEvent) {
		const {channel, peerUuid} = this.props;

		if (peerConnectionIceEvent.candidate) {
			channel.push(ChannelEvent.newIceCandidate, {
				target: peerUuid,
				candidate: peerConnectionIceEvent.candidate
			});
		}
	}

	private handleDataChannelStatusChange() {
		console.log("Data channel's status has changed to " + this.dataChannel?.readyState);

		if (this.dataChannel) {
			const state = this.dataChannel.readyState;

			if (state === "open") {
				this.setState({
					isSendChannelOpen: true,
					connectionEstablished: true,
					establishingConnection: false,
				})
			} else {
				this.setState({
					isSendChannelOpen: false,
					connectionEstablished: false,
					establishingConnection: false,
				})
			}
		}
	}

	private handleReceiveMessage(event: any) {
		console.log(`RECEIVED MESSAGE: ${event.data}`);
		this.setState((prevState) => ({
			receivedMessages: [...prevState.receivedMessages, event.data]
		}))
	}

	private disconnectPeers() {
		const {channel, uuid, peerUuid} = this.props;

		this.closeConnection();

		channel.push(ChannelEvent.transferCancel, {
			name: uuid,
			target: peerUuid,
		});
	}

	private closeConnection() {
		this.dataChannel?.close();
		this.peerConnection?.close();

		this.dataChannel = null;
		this.peerConnection = null;

		this.setState({
			isSendChannelOpen: false,
			connectionEstablished: false,
			establishingConnection: false,
		})
		this.setState({message: ''});
	}

	private sendMessage() {
		if (!this.dataChannel) {
			return;
		}
		this.dataChannel.send(this.state.message);
		this.setState({message: ''});
	}

	private onMessageInputChange(event: any) {
		this.setState({
			message: event.target.value,
		});
	}

	private reportError(error: Error) {
		console.error(error);
	}

	render() {
		return (
			<div>
				<div>
					<button type="button" onClick={this.connectPeers} disabled={this.state.establishingConnection || this.state.connectionEstablished}>Connect</button>
					<button type="button" onClick={this.disconnectPeers} disabled={!this.state.connectionEstablished}>Disconnect</button>
				</div>
				<div>
					<label htmlFor="message">
						Enter a message:
						<input
							type="text"
							id="message"
							disabled={!this.state.isSendChannelOpen}
							value={this.state.message}
							onChange={this.onMessageInputChange}
						/>
					</label>
					<button type="button" onClick={this.sendMessage} disabled={!this.state.isSendChannelOpen}>Send</button>
				</div>
				<div id="receivebox">
					<p>Messages received:</p>
					{this.state.receivedMessages.map((receivedMessage, index) => (
						<p key={index}>{receivedMessage}</p>
					))}
				</div>
			</div>
		);
	}
}
