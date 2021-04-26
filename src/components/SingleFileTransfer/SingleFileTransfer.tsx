import {Channel} from "phoenix";
import React from 'react';
import {ChannelEvent} from "../../channel/events/ChannelEvent";
import {TransferPanel} from "./TransferPanel/TransferPanel";
import {TransferredFile} from "./TransferredFile";

interface Props {
	channel: Channel;
	uuid: string,
	peerUuid: string,
}

interface State {
	establishingConnection: boolean;
	connectionEstablished: boolean;
	isSendChannelOpen: boolean;

	sendingInProgress: boolean,
	receivingInProgress: boolean,
	nextSendFileIndex: number,
	nextReceiveFileIndex: number,
	sentFiles: TransferredFile[],
	receivedFiles: TransferredFile[],

	sendProgress: number,
}

export class SingleFileTransfer extends React.Component<Props, State> {
	private peerConnection: RTCPeerConnection | null = null;
	private dataChannel: RTCDataChannel | null = null;
	private chunkSize = 16384;

	constructor(props: Props) {
		super(props);

		this.state = {
			establishingConnection: false,
			connectionEstablished: false,
			isSendChannelOpen: false,

			sendingInProgress: false,
			receivingInProgress: false,
			nextSendFileIndex: 0,
			nextReceiveFileIndex: 0,
			sentFiles: [],
			receivedFiles: [],

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

		this.setAllFilesAsSeen = this.setAllFilesAsSeen.bind(this);
		this.setFileNotPristine = this.setFileNotPristine.bind(this);
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
			const fileToReceive: TransferredFile = {
				name: payload.file.name,
				size: payload.file.size,
				seen: false,
				pristine: false,
				progress: 0,
				buffer: [],
			};
			const newReceivedFiles = [...this.state.receivedFiles, fileToReceive];
			this.setState({
				receivedFiles: newReceivedFiles,
			});
		});

		channel.on(ChannelEvent.transferCancel, () => {
			this.closeConnection();
		});
	}

	private async initSendingFile(file: File) {
		const {channel, uuid, peerUuid} = this.props;

		if (!file || file.size === 0) {
			console.log('no file or empty file');
			return;
		}

		const fileToSend: TransferredFile = {
			name: file.name,
			size: file.size,
			seen: false,
			pristine: false,
			progress: 0,
			data: file,
		}
		const newSentFiles = [...this.state.sentFiles, fileToSend];
		this.setState({
			sentFiles: newSentFiles,
		});
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
					sendingInProgress: true,
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
		const {sentFiles, nextSendFileIndex} = this.state;
		const transferredFile = sentFiles[nextSendFileIndex]
		const file = transferredFile.data as File;
		if (!file) {
			this.closeConnection();
			return;
		}
		console.log(`SENDING FILE ${[file.name, file.size, file.type, file.lastModified].join(' ')}`);

		const fileReader = new FileReader();
		let offset = 0;

		fileReader.addEventListener('error', error => console.error('Error reading file:', error));
		fileReader.addEventListener('abort', event => console.log('File reading aborted:', event));
		fileReader.addEventListener('load', (e: ProgressEvent<FileReader>) => {
			console.log('FileRead.onload ', e);
			this.dataChannel?.send((e?.target?.result as ArrayBuffer));
			offset += (e?.target?.result as ArrayBuffer).byteLength;
			transferredFile.progress = offset;
			if (offset === file.size) {
				transferredFile.seen = false;
				transferredFile.pristine = true;
			}
			this.setState({
				sentFiles: [...this.state.sentFiles],
			});
			if (offset < file.size) {
				readSlice(offset);
			} else {
				this.setState({
					sendingInProgress: false,
					nextSendFileIndex: this.state.nextSendFileIndex + 1,
				})
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
					receivingInProgress: true,
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
			const {receivedFiles, nextReceiveFileIndex} = this.state;
			const transferredFile = receivedFiles[nextReceiveFileIndex];

			if (!transferredFile.name && !transferredFile.size) {
				console.error(`Received file data before file metadata`);
				return;
			}

			const updatedReceivedBuffer = [...(transferredFile.buffer as any[])];
			updatedReceivedBuffer.push(receivedData);
			const updatedReceivedSize = transferredFile.progress + receivedData.byteLength;


			if (updatedReceivedSize === transferredFile.size) {
				const receivedFile = new Blob(updatedReceivedBuffer);
				transferredFile.progress = updatedReceivedSize;
				transferredFile.seen = false;
				transferredFile.pristine = true;
				transferredFile.buffer = undefined;
				transferredFile.data = receivedFile;

				this.setState({
					receivedFiles: [...receivedFiles],
					nextReceiveFileIndex: this.state.nextReceiveFileIndex + 1,
				});
				this.closeConnection();
			} else {
				transferredFile.progress = updatedReceivedSize;
				transferredFile.buffer = updatedReceivedBuffer;

				this.setState({
					receivedFiles: [...receivedFiles],
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

			sendingInProgress: false,
			receivingInProgress: false,
		})
	}

	private reportError(error: Error) {
		console.error(error);
	}

	private setAllFilesAsSeen(fileType: 'sent' | 'received') {
		if (fileType === 'sent') {
			this.setState((prevState) => ({
				sentFiles: prevState.sentFiles.map((file) => ({...file, seen: true}))
			}));
		}
		if (fileType === 'received') {
			this.setState((prevState) => ({
				receivedFiles: prevState.receivedFiles.map((file) => ({...file, seen: true}))
			}));
		}
	}

	private setFileNotPristine(fileType: 'sent' | 'received', fileIndex: number) {
		if (fileType === 'sent') {
			this.setState((prevState) => {
				const newSentFiles = [...prevState.sentFiles];
				newSentFiles[fileIndex].pristine = false;
				return {sentFiles: newSentFiles};
			});
		}
		if (fileType === 'received') {
			this.setState((prevState) => {
				const newReceivedFiles = [...prevState.receivedFiles];
				newReceivedFiles[fileIndex].pristine = false;
				return {receivedFiles: newReceivedFiles};
			});
		}
	}

	render() {
		const {receivedFiles, sentFiles, receivingInProgress, sendingInProgress} = this.state;

		return (
			<TransferPanel
				receivingInProgress={receivingInProgress}
				sendingInProgress={sendingInProgress}
				receivedFiles={receivedFiles}
				sentFiles={sentFiles}
				onFileSelected={this.initSendingFile}
				setAllFilesAsSeen={this.setAllFilesAsSeen}
				setFileNotPristine={this.setFileNotPristine}
			/>
		);
	}
}
