import QRCode from 'qrcode';
import React, {useContext, useEffect, useRef, useState} from 'react';
import './App.css';
import {ChannelContext} from "./channel/ChannelContext";
import {ChannelEvent} from "./channel/events/ChannelEvent";
import {GetUuidReq} from "./channel/events/GetUuidReq";
import {GetUuidRes} from "./channel/events/GetUuidRes";
import {HandshakeAcceptedPayload} from "./channel/events/HandshakeAcceptedPayload";
import {HandshakeNoTargetPayload} from "./channel/events/HandshakeNoTargetPayload";
import {HandshakePayload} from "./channel/events/HandshakePayload";
import {SingleFileTransfer} from "./components/SingleFileTransfer";

function App() {
	const {channel} = useContext(ChannelContext);
	const [peerInputValue, setPeerInputValue] = useState<string>('');
	const [uuid, setUuid] = useState<string>('');
	const [peerUuid, setPeerUuid] = useState<string>('');
	const [peerReachedError, setPeerReachedError] = useState<HandshakeNoTargetPayload | null>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		channel?.join()
			.receive('ok', () => {
				const payload:GetUuidReq = {};
				channel?.push(ChannelEvent.getUuid, payload);
			})
			.receive('error', (error) => {
				console.log(`ERROR ${error}`);
			});

		channel?.on(ChannelEvent.getUuid, (payload:GetUuidRes) => {
			setUuid(payload.uuid);
			setPeerUuid('');
			QRCode.toCanvas(canvasRef.current, payload.uuid, (error) => {if (error) console.log("canvas", error);});
		});

		channel?.on(ChannelEvent.handshake, (payload:HandshakePayload) => {
			setPeerUuid(payload.source);
			const handshakeAcceptedPayload:HandshakeAcceptedPayload = {source: payload.source, target: payload.target};
			channel?.push(ChannelEvent.handshakeAccepted, handshakeAcceptedPayload);
		});

		channel?.on(ChannelEvent.handshakeAccepted, (payload:HandshakeAcceptedPayload) => {
			setPeerUuid(payload.target);
		});

		channel?.on(ChannelEvent.handshakeNoTarget, (payload) => {
			setPeerUuid('');
			setPeerReachedError(payload);
		});
	}, [channel]);

	const startHandshake = () => {
		const handhakePayload: HandshakePayload = {
			target: peerInputValue,
			source: uuid,
		};
		channel?.push(ChannelEvent.handshake, handhakePayload);
		setPeerInputValue('');
	}

	return (
		<div className="App">
			<header className="App-header">
				<div>
					<input
						type="text"
						value={peerInputValue}
						onChange={(event) => setPeerInputValue(event.target.value)}
						onKeyDown={(event => {
							if (event.key === 'enter') startHandshake();
						})}
					/>
					<button type="button" onClick={startHandshake}>Go</button>
				</div>
				<div>
					<span>My uuid</span> <span>{uuid}</span>
					<div>
						<canvas ref={canvasRef}/>
					</div>
				</div>
				{peerUuid && (
					<div>
						<span>Peer uuid</span> <span>{peerUuid}</span>
					</div>
				)}
				{uuid && peerUuid && channel && (
					<SingleFileTransfer channel={channel} uuid={uuid} peerUuid={peerUuid} />
				)}
				{peerReachedError && (
					<div>Couldn't reach {peerReachedError?.target}</div>
				)}
			</header>
		</div>
	);
}

export default App;
