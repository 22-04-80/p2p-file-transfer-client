import React from 'react';

interface Props {}

interface State {
	message: string,
	receivedMessages: string[],

	establishingConnection: boolean;
	connectionEstablished: boolean;
	isSendChannelOpen: boolean;
}

export class LocalMessaging extends React.Component<Props, State> {
	private localConnection: RTCPeerConnection | null = null;
	private remoteConnection: RTCPeerConnection | null = null;
	private sendChannel: RTCDataChannel | null = null;
	private receiveChannel: RTCDataChannel | null = null;


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
		this.setUpLocalConnection = this.setUpLocalConnection.bind(this);
		this.handleSendChannelStatusChange = this.handleSendChannelStatusChange.bind(this);
		this.setUpRemoteConnection = this.setUpRemoteConnection.bind(this);
		this.receiveChannelCallback = this.receiveChannelCallback.bind(this);
		this.handleReceiveMessage = this.handleReceiveMessage.bind(this);
		this.handleReceiveChannelStatusChange = this.handleReceiveChannelStatusChange.bind(this);
		this.createConnectionOffer = this.createConnectionOffer.bind(this);
		this.disconnectPeers = this.disconnectPeers.bind(this);
		this.sendMessage = this.sendMessage.bind(this);
		this.onMessageInputChange = this.onMessageInputChange.bind(this);
	}

	private async connectPeers() {
		this.setState({
			establishingConnection: true,
		})
		this.setUpLocalConnection();
		this.setUpRemoteConnection()

		await this.createConnectionOffer();
	}

	private setUpLocalConnection() {
		this.localConnection = new RTCPeerConnection();

		this.sendChannel = this.localConnection.createDataChannel("sendChannel");
		this.sendChannel.onopen = this.handleSendChannelStatusChange;
		this.sendChannel.onclose = this.handleSendChannelStatusChange;

		this.localConnection.onicecandidate = (peerConnectionIceEvent) => {
			return !peerConnectionIceEvent.candidate
			|| this.remoteConnection?.addIceCandidate(peerConnectionIceEvent.candidate)
				.catch(this.handleAddCandidateError);
		}
	}

	private handleSendChannelStatusChange() {
		console.log("Send channel's status has changed to " + this.sendChannel?.readyState);

		if (this.sendChannel) {
			const state = this.sendChannel.readyState;

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

	private setUpRemoteConnection() {
		this.remoteConnection = new RTCPeerConnection();
		this.remoteConnection.ondatachannel = this.receiveChannelCallback;

		this.remoteConnection.onicecandidate = (peerConnectionIceEvent) => {
			return !peerConnectionIceEvent.candidate
			|| this.localConnection?.addIceCandidate(peerConnectionIceEvent.candidate)
				.catch(this.handleAddCandidateError);
		}
	}

	private receiveChannelCallback(event: RTCDataChannelEvent) {
		this.receiveChannel = event.channel;
		this.receiveChannel.onmessage = this.handleReceiveMessage;
		this.receiveChannel.onopen = this.handleReceiveChannelStatusChange;
		this.receiveChannel.onclose = this.handleReceiveChannelStatusChange;
	}

	private handleReceiveMessage(event: any) {
		this.setState((prevState) => ({
			receivedMessages: [...prevState.receivedMessages, event.data]
		}))
	}

	private handleReceiveChannelStatusChange() {
		if (this.receiveChannel) {
			console.log("Receive channel's status has changed to " + this.receiveChannel.readyState);
		}
	}

	private async createConnectionOffer() {
		if (!this.localConnection || !this.remoteConnection) {
			return
		}

		try {
			const offer = await this.localConnection.createOffer();
			await this.localConnection.setLocalDescription(offer);
			const localDescription = this.localConnection.localDescription as RTCSessionDescriptionInit;

			await this.remoteConnection.setRemoteDescription(localDescription);
			const answer = await this.remoteConnection.createAnswer();
			await this.remoteConnection.setLocalDescription(answer);
			const remoteDescription = this.remoteConnection.localDescription as RTCSessionDescriptionInit;
			await this.localConnection.setRemoteDescription(remoteDescription)

		} catch (createDescriptionError) {
			this.handleCreateDescriptionError(createDescriptionError);
		}
	}

	private disconnectPeers() {
		this.sendChannel?.close();
		this.receiveChannel?.close();

		this.localConnection?.close();
		this.remoteConnection?.close();

		this.sendChannel = null;
		this.receiveChannel = null;
		this.localConnection = null;
		this.remoteConnection = null;


		this.setState({
			isSendChannelOpen: false,
			connectionEstablished: false,
			establishingConnection: false,
		})
		this.setState({message: ''});
	}

	private sendMessage() {
		if (!this.sendChannel) {
			return;
		}
		this.sendChannel.send(this.state.message);
		this.setState({message: ''});
	}

	private onMessageInputChange(event: any) {
		this.setState({
			message: event.target.value,
		});
	}

	private handleAddCandidateError() {
		console.error('addIceCandidate failed');
	}

	private handleCreateDescriptionError(error: Error) {
		console.log("Unable to create an offer: " + error.toString());
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
