import {Channel} from "phoenix";
import React, {FormEvent} from 'react';
import {ChannelEvent} from "../channel/events/ChannelEvent";

interface Props {
	channel: Channel;
	uuid: string,
	peerUuid: string,
}

interface State {
	establishingConnection: boolean;
	connectionEstablished: boolean;
	isSendChannelOpen: boolean;

	receiveProgress: number,
	receivedBuffer: any[],
	fileMetaData: any,
	receivedFile: Blob | null,

	sendProgress: number,
}

export class SingleFileTransfer extends React.Component<Props, State> {
	private fileInputRef = React.createRef<HTMLInputElement>();
	private peerConnection: RTCPeerConnection | null = null;
	private dataChannel: RTCDataChannel | null = null;
	private chunkSize = 16384;

	constructor(props: Props) {
		super(props);

		this.state = {
			establishingConnection: false,
			connectionEstablished: false,
			isSendChannelOpen: false,

			receiveProgress: 0,
			receivedBuffer: [],
			fileMetaData: {},
			receivedFile: null,

			sendProgress: 0,
		};

		this.initSendingFile = this.initSendingFile.bind(this);
		this.connectPeers = this.connectPeers.bind(this);
		this.setUpOffererConnection = this.setUpOffererConnection.bind(this);
		this.handleOffererDataChannelStatusChange = this.handleOffererDataChannelStatusChange.bind(this);
		this.sendFile = this.sendFile.bind(this);

		this.setUpAnswererConnection = this.setUpAnswererConnection.bind(this);
		this.handleDataChannelEvent = this.handleDataChannelEvent.bind(this);
		this.handleAnswererDataChannelStatusChange = this.handleAnswererDataChannelStatusChange.bind(this);
		this.handleChannelMessage = this.handleChannelMessage.bind(this);

		this.handleNegotiationNeededEvent = this.handleNegotiationNeededEvent.bind(this);
		this.handlePeerConnectionIceEvent = this.handlePeerConnectionIceEvent.bind(this);
		this.disconnectPeers = this.disconnectPeers.bind(this);
		this.closeConnection = this.closeConnection.bind(this);
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

		channel.on(ChannelEvent.transferFileMetadata, (payload) => {
			this.setState({
				fileMetaData: payload.file,
				receiveProgress: 0,
				receivedBuffer: [],
				receivedFile: null,
			});
		});

		channel.on(ChannelEvent.transferCancel, () => {
			this.closeConnection();
		});
	}

	private async initSendingFile(event: FormEvent) {
		event.preventDefault();

		const {channel, uuid, peerUuid} = this.props;
		const files = this.fileInputRef?.current?.files;
		const fileChosen = files ? !!files[0] : false;

		if (!fileChosen) {
			console.log('no file');
			return;
		}

		const file = (files as FileList)[0];
		channel.push(ChannelEvent.transferFileMetadata, {
			offerer: uuid,
			answerer: peerUuid,
			file: {
				name: file.name,
				size: file.size,
			}
		});

		await this.connectPeers();
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
		this.dataChannel.binaryType = 'arraybuffer';
		this.dataChannel.onopen = this.handleOffererDataChannelStatusChange;
		this.dataChannel.onclose = this.handleOffererDataChannelStatusChange;
		// this.dataChannel.onerror = this.reportError;
		// this.dataChannel.onmessage = this.handleReceiveMessage;
	}

	private handleOffererDataChannelStatusChange() {
		console.log("Data channel's status has changed to " + this.dataChannel?.readyState);

		if (this.dataChannel) {
			const state = this.dataChannel.readyState;

			if (state === "open") {
				this.setState({
					isSendChannelOpen: true,
					connectionEstablished: true,
					establishingConnection: false,
				});
				this.sendFile();
			} else {
				this.setState({
					isSendChannelOpen: false,
					connectionEstablished: false,
					establishingConnection: false,
				});
			}
		}
	}

	private sendFile() {
		const files = this.fileInputRef?.current?.files;
		const file = (files as FileList)[0];
		console.log(`SENDING FILE ${[file.name, file.size, file.type, file.lastModified].join(' ')}`);

		if (file.size === 0) {
			console.error('empty file');
			this.closeConnection();
			return;
		}

		this.setState({
			sendProgress: 0,
		});
		const fileReader = new FileReader();
		let offset = 0;

		fileReader.addEventListener('error', error => console.error('Error reading file:', error));
		fileReader.addEventListener('abort', event => console.log('File reading aborted:', event));
		fileReader.addEventListener('load', (e: ProgressEvent<FileReader>) => {
			console.log('FileRead.onload ', e);
			this.dataChannel?.send((e?.target?.result as ArrayBuffer));
			offset += (e?.target?.result as ArrayBuffer).byteLength;
			this.setState({
				sendProgress: offset,
			});
			if (offset < file.size) {
				readSlice(offset);
			}
		});

		const readSlice = (nextOffset: any) => {
			console.log(`readSlice ${nextOffset}`);
			const slice = file.slice(offset, nextOffset + this.chunkSize);
			fileReader.readAsArrayBuffer(slice);
		}
		readSlice(0);
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
		this.dataChannel.onmessage = this.handleChannelMessage;
		this.dataChannel.onopen = this.handleAnswererDataChannelStatusChange;
		this.dataChannel.onclose = this.handleAnswererDataChannelStatusChange;
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

	private handleAnswererDataChannelStatusChange() {
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

	private async handleChannelMessage(event: any) {
		try {
			const receivedData = await event.data.arrayBuffer();
			console.log(`Received Message ${receivedData}`);
			const {fileMetaData, receiveProgress, receivedBuffer} = this.state;

			if (!fileMetaData) {
				console.error(`Received file data before file metadata`);
				return;
			}

			const updatedReceivedBuffer = [...receivedBuffer];
			updatedReceivedBuffer.push(receivedData);
			const updatedReceivedSize = receiveProgress + receivedData.byteLength;


			if (updatedReceivedSize === fileMetaData.size) {
				const receivedFile = new Blob(updatedReceivedBuffer);

				this.setState({
					receivedBuffer: [],
					receiveProgress: updatedReceivedSize,
					receivedFile,
				});
				this.closeConnection();
			} else {
				this.setState({
					receivedBuffer: updatedReceivedBuffer,
					receiveProgress: updatedReceivedSize,
				});
			}
		} catch (error) {
			console.error('handleChannelMessage');
			this.reportError(error);
		}
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
		// this.setState({message: ''});
	}

	private reportError(error: Error) {
		console.error(error);
	}

	render() {
		const {fileMetaData, receivedFile, sendProgress, receiveProgress} = this.state;

		return (
			<div>
				<form onSubmit={this.initSendingFile}>
					<input type="file" ref={this.fileInputRef}/>
					<button type="submit">Send</button>
				</form>
				{Object.keys(fileMetaData).length > 0 && (
					JSON.stringify(fileMetaData)
				)}
				{!!sendProgress && (
					<div>
						<label htmlFor="send-progress">Send progress:</label>
						<progress id="send-progress" max={fileMetaData.size} value={sendProgress}>{sendProgress}%</progress>
					</div>
				)}
				{!!receiveProgress && (
					<div>
						<label htmlFor="receive-progress">Receive progress:</label>
						<progress id="receive-progress" max={fileMetaData.size} value={receiveProgress}>{receiveProgress}%</progress>
					</div>
				)}
				{!!receivedFile && (
					<div>
						<a
							href={URL.createObjectURL(receivedFile)}
							download={fileMetaData.name}
						>
							RECEIVED FILE
						</a>
					</div>
				)}
			</div>
		);
	}
}
